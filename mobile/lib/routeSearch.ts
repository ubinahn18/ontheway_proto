import { supabase } from './supabase';
import { callFunction } from './kakaoFunctions';
import type { Item, Place, RouteCandidate } from './SearchContext';

// how far off the seeker's actual route an item's pickup/dropoff may sit and
// still be considered a candidate at all — not user-adjustable, just a cheap
// net to avoid running kakao navi on every available item in the DB
const CORRIDOR_BUFFER_METERS = 20000;

// cap on how many corridor candidates get a real (paid) kakao navi detour
// calculation per search
const MAX_CANDIDATES = 30;

// how many kakao navi calls to run at once for the candidate batch
const CONCURRENCY = 5;

type DirectRoute = {
  durationSec: number;
  distanceMeters: number;
  tollFare: number;
  vertices: { lng: number; lat: number }[];
};

type NaviResult = {
  diffMinutes: number;
  extraTollFare: number;
};

function toRouteWkt(vertices: { lng: number; lat: number }[]): string {
  const points = vertices.map((v) => `${v.lng} ${v.lat}`).join(', ');
  return `LINESTRING(${points})`;
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

export async function searchItemsAlongRoute(
  origin: Place,
  destination: Place
): Promise<RouteCandidate[]> {
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

  const candidates = (data as Item[]).slice(0, MAX_CANDIDATES);

  const withDetour = await mapWithConcurrency(candidates, CONCURRENCY, async (item) => {
    try {
      const navi = await callFunction<NaviResult>('kakao-navi-proxy', {
        originLng: origin.lng,
        originLat: origin.lat,
        destLng: destination.lng,
        destLat: destination.lat,
        pickupLng: item.pickup_lng,
        pickupLat: item.pickup_lat,
        dropoffLng: item.dropoff_lng,
        dropoffLat: item.dropoff_lat,
        directDurationSec: directRoute.durationSec,
        directDistanceMeters: directRoute.distanceMeters,
        directTollFare: directRoute.tollFare,
      });
      return { ...item, detourMinutes: navi.diffMinutes, extraTollFare: navi.extraTollFare };
    } catch {
      // kakao navi occasionally rejects a specific waypoint (road incidents
      // etc.) — drop that one candidate rather than failing the whole search
      return null;
    }
  });

  return withDetour
    .filter((c): c is RouteCandidate => c !== null)
    .sort((a, b) => a.detourMinutes - b.detourMinutes);
}
