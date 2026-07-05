import { supabase } from './supabase';
import { callFunction } from './kakaoFunctions';
import { haversineMeters, type LngLat } from './geo';
import type { Item, Place } from './SearchContext';

// corridor buffer reused as-is from the single-item search
const CORRIDOR_BUFFER_METERS = 20000;

// how many kakao navi calls to run at once
const CONCURRENCY = 5;

// only the most promising combinations (by straight-line estimate) get a
// real (paid) kakao navi call, regardless of how many combinations exist
const MAX_PACKAGE_CANDIDATES = 20;

// top-K single-item candidates to build combinations from, sized so that
// C(K, n) stays in the same ballpark as the single-item search's API budget
const TOP_K_BY_SIZE: Record<number, number> = { 2: 10, 3: 8 };

// a candidate whose own pickup->dropoff hop is already a huge multiple of
// the seeker's own trip distance is never going to be a good match
const MAX_DETOUR_RATIO = 3;

export type Stop = { itemId: string; kind: 'pickup' | 'dropoff'; lng: number; lat: number };

export type ItemBundle = {
  items: Item[];
  stopOrder: Stop[];
  // one entry per leg: origin->stop1, stop1->stop2, ..., stopN->destination
  legDurationsSec: number[];
  totalDetourMinutes: number;
  totalExtraTollFare: number;
  totalExtraDistanceMeters: number;
  totalPrice: number;
  // latest the first stop can happen and still make every item's own
  // delivery_deadline, given this order's leg durations
  latestPickupBy: string | null;
};

type DirectRoute = {
  durationSec: number;
  distanceMeters: number;
  tollFare: number;
  vertices: LngLat[];
};

type NaviResult = {
  diffMinutes: number;
  extraTollFare: number;
  extraDistanceMeters: number;
  legDurationsSec: number[];
};

function toRouteWkt(vertices: LngLat[]): string {
  return `LINESTRING(${vertices.map((v) => `${v.lng} ${v.lat}`).join(', ')})`;
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

// finds the min-straight-line-distance visiting order of a combination's
// pickup/dropoff stops (origin -> ...stops... -> destination), subject to
// each item's pickup coming before its own dropoff. branch & bound: explores
// partial orders depth-first and prunes any branch whose accumulated
// distance already exceeds the best complete order found so far.
function bestStopOrder(
  origin: LngLat,
  destination: LngLat,
  items: Item[]
): { order: Stop[]; distanceMeters: number } {
  const stops: Stop[] = items.flatMap((item) => [
    { itemId: item.id, kind: 'pickup' as const, lng: item.pickup_lng, lat: item.pickup_lat },
    { itemId: item.id, kind: 'dropoff' as const, lng: item.dropoff_lng, lat: item.dropoff_lat },
  ]);

  let best: { order: Stop[]; distanceMeters: number } | null = null;

  function visit(remaining: Stop[], path: Stop[], lastPoint: LngLat, distanceSoFar: number) {
    if (best && distanceSoFar >= best.distanceMeters) return; // bound: can't beat the best found so far
    if (remaining.length === 0) {
      const total = distanceSoFar + haversineMeters(lastPoint, destination);
      if (!best || total < best.distanceMeters) best = { order: path, distanceMeters: total };
      return;
    }
    for (const stop of remaining) {
      if (stop.kind === 'dropoff') {
        const pickedUp = path.some((s) => s.itemId === stop.itemId && s.kind === 'pickup');
        if (!pickedUp) continue; // can't deliver before picking up
      }
      visit(
        remaining.filter((s) => s !== stop),
        [...path, stop],
        stop,
        distanceSoFar + haversineMeters(lastPoint, stop)
      );
    }
  }

  visit(stops, [], origin, 0);
  return best!;
}

// walks the chosen order accumulating leg durations, and for every dropoff
// works backward from that item's own delivery_deadline to find how late
// the very first stop could still start — the binding constraint is the
// tightest (earliest) of all of them
function computeLatestPickupBy(order: Stop[], legDurationsSec: number[], items: Item[]): Date | null {
  let cumulativeSec = 0;
  let latestMs: number | null = null;
  for (let k = 0; k < order.length; k++) {
    if (k > 0) cumulativeSec += legDurationsSec[k];
    const stop = order[k];
    if (stop.kind !== 'dropoff') continue;
    const item = items.find((it) => it.id === stop.itemId);
    if (!item?.delivery_deadline) continue;
    const bound = new Date(item.delivery_deadline).getTime() - cumulativeSec * 1000;
    if (latestMs === null || bound < latestMs) latestMs = bound;
  }
  return latestMs === null ? null : new Date(latestMs);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function searchItemBundles(
  origin: Place,
  destination: Place,
  n: 2 | 3
): Promise<ItemBundle[]> {
  const directRoute = await callFunction<DirectRoute>('kakao-direct-route', {
    originLng: origin.lng,
    originLat: origin.lat,
    destLng: destination.lng,
    destLat: destination.lat,
  });

  const { data, error } = await supabase.rpc('items_within_corridor', {
    p_route_wkt: toRouteWkt(directRoute.vertices),
    p_buffer_meters: CORRIDOR_BUFFER_METERS,
  });
  if (error) throw error;

  const originPoint: LngLat = { lng: origin.lng, lat: origin.lat };
  const destPoint: LngLat = { lng: destination.lng, lat: destination.lat };
  const directDistance = haversineMeters(originPoint, destPoint);

  // step 2: straight distance pruning
  const pruned = (data as Item[]).filter((item) => {
    const pickup = { lng: item.pickup_lng, lat: item.pickup_lat };
    const dropoff = { lng: item.dropoff_lng, lat: item.dropoff_lat };
    return haversineMeters(pickup, dropoff) <= directDistance * MAX_DETOUR_RATIO;
  });

  // step 3: single-delivery score — estimated detour if taken alone
  const scored = pruned.map((item) => {
    const pickup = { lng: item.pickup_lng, lat: item.pickup_lat };
    const dropoff = { lng: item.dropoff_lng, lat: item.dropoff_lat };
    const score =
      haversineMeters(originPoint, pickup) +
      haversineMeters(pickup, dropoff) +
      haversineMeters(dropoff, destPoint) -
      directDistance;
    return { item, score };
  });

  // step 4: top-K candidates
  const K = TOP_K_BY_SIZE[n];
  const topK = scored
    .sort((a, b) => a.score - b.score)
    .slice(0, K)
    .map((s) => s.item);

  // step 5: n-combinations
  const combos = combinations(topK, n);

  // step 6: best visiting order per combination (straight-line only)
  const ordered = combos.map((items) => ({
    items,
    ...bestStopOrder(originPoint, destPoint, items),
  }));

  // step 7: only the shortlisted combinations get a real kakao navi call
  const shortlisted = ordered
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_PACKAGE_CANDIDATES);

  const bundles = await mapWithConcurrency(shortlisted, CONCURRENCY, async ({ items, order }) => {
    try {
      const navi = await callFunction<NaviResult>('kakao-navi-proxy', {
        originLng: origin.lng,
        originLat: origin.lat,
        destLng: destination.lng,
        destLat: destination.lat,
        waypoints: order.map((s) => ({ lng: s.lng, lat: s.lat, label: `${s.kind}-${s.itemId}` })),
        directDurationSec: directRoute.durationSec,
        directDistanceMeters: directRoute.distanceMeters,
        directTollFare: directRoute.tollFare,
      });
      const latestPickupBy = computeLatestPickupBy(order, navi.legDurationsSec, items);
      if (latestPickupBy && latestPickupBy.getTime() < Date.now()) return null; // can't make every deadline anymore

      const bundle: ItemBundle = {
        items,
        stopOrder: order,
        legDurationsSec: navi.legDurationsSec,
        totalDetourMinutes: navi.diffMinutes,
        // can legitimately be negative — a detour can avoid a toll the
        // direct route would have taken, genuinely saving money
        totalExtraTollFare: navi.extraTollFare,
        totalExtraDistanceMeters: navi.extraDistanceMeters,
        totalPrice: items.reduce((sum, item) => sum + item.price, 0),
        latestPickupBy: latestPickupBy?.toISOString() ?? null,
      };
      return bundle;
    } catch {
      // kakao navi occasionally rejects a specific waypoint (road incidents
      // etc.) — drop that one combination rather than failing the whole search
      return null;
    }
  });

  // step 9: ascending by total detour
  return bundles
    .filter((b): b is ItemBundle => b !== null)
    .sort((a, b) => a.totalDetourMinutes - b.totalDetourMinutes);
}
