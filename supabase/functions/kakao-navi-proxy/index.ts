import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const {
    originLng,
    originLat,
    destLng,
    destLat,
    pickupLng,
    pickupLat,
    dropoffLng,
    dropoffLat,
    waypoints: providedWaypoints,
    directDurationSec: providedDirectDurationSec,
    directDistanceMeters: providedDirectDistanceMeters,
    directTollFare: providedDirectTollFare,
  } = await req.json();

  const baseCoords = { originLng, originLat, destLng, destLat };
  if (Object.values(baseCoords).some((v) => typeof v !== 'number')) {
    return new Response(JSON.stringify({ error: 'all coordinates must be numbers' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // multi-item bundles pass an ordered waypoints list; single-item callers
  // keep passing pickup/dropoff directly (kept for backwards compatibility)
  const waypoints: { lng: number; lat: number; label?: string }[] = Array.isArray(providedWaypoints)
    ? providedWaypoints
    : [
        { lng: pickupLng, lat: pickupLat, label: 'pickup' },
        { lng: dropoffLng, lat: dropoffLat, label: 'dropoff' },
      ];

  if (waypoints.some((w) => typeof w.lng !== 'number' || typeof w.lat !== 'number')) {
    return new Response(JSON.stringify({ error: 'all waypoints must have numeric lng/lat' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // the direct (origin -> destination) leg is identical for every item in a
  // given search, so callers comparing many items should compute it once
  // (kakao-direct-route) and pass it in here instead of re-fetching it.
  const hasProvidedDirect =
    typeof providedDirectDurationSec === 'number' && typeof providedDirectDistanceMeters === 'number';

  const authHeader = { Authorization: `KakaoAK ${Deno.env.get('KAKAO_REST_API_KEY')}` };

  const directReq = hasProvidedDirect
    ? Promise.resolve(null)
    : fetch(
        `https://apis-navi.kakaomobility.com/v1/directions?origin=${originLng},${originLat}&destination=${destLng},${destLat}`,
        { headers: authHeader }
      );

  const viaReq = fetch('https://apis-navi.kakaomobility.com/v1/waypoints/directions', {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: { x: originLng, y: originLat },
      destination: { x: destLng, y: destLat },
      // order matters: caller is responsible for each item's pickup preceding
      // its own dropoff (you cannot deliver an item before picking it up)
      waypoints: waypoints.map((w, i) => ({ x: w.lng, y: w.lat, name: w.label ?? `stop${i + 1}` })),
      priority: 'RECOMMEND',
      road_details: true,
    }),
  });

  const [directRes, viaRes] = await Promise.all([directReq, viaReq]);

  if ((directRes && !directRes.ok) || !viaRes.ok) {
    const body = await (viaRes.ok ? directRes!.text() : viaRes.text());
    return new Response(JSON.stringify({ error: 'kakao navi api error', body }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const viaData = await viaRes.json();
  const directData = directRes ? await directRes.json() : null;

  const directDurationSec = hasProvidedDirect
    ? providedDirectDurationSec
    : directData.routes?.[0]?.summary?.duration;
  const viaDurationSec = viaData.routes?.[0]?.summary?.duration;
  const directDistanceMeters = hasProvidedDirect
    ? providedDirectDistanceMeters
    : directData.routes?.[0]?.summary?.distance;
  const viaDistanceMeters = viaData.routes?.[0]?.summary?.distance;
  const directTollFare = hasProvidedDirect
    ? (providedDirectTollFare ?? 0)
    : (directData.routes?.[0]?.summary?.fare?.toll ?? 0);
  const viaTollFare = viaData.routes?.[0]?.summary?.fare?.toll ?? 0;

  if (
    typeof directDurationSec !== 'number' ||
    typeof viaDurationSec !== 'number' ||
    typeof directDistanceMeters !== 'number' ||
    typeof viaDistanceMeters !== 'number'
  ) {
    return new Response(
      JSON.stringify({ error: 'unexpected kakao navi response', directData, viaData }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const sections = viaData.routes?.[0]?.sections ?? [];

  const viaVertices: { lng: number; lat: number }[] = [];
  for (const section of sections) {
    for (const road of section.roads ?? []) {
      const vertexes: number[] = road.vertexes ?? [];
      for (let i = 0; i + 1 < vertexes.length; i += 2) {
        viaVertices.push({ lng: vertexes[i], lat: vertexes[i + 1] });
      }
    }
  }

  // one section per leg: origin->stop1, stop1->stop2, ..., stopN->destination
  // (2n+1 total legs for n items/2n waypoints) — used to auto-fill each
  // stop's estimated pickup/delivery time from a single starting time
  const legDurationsSec: number[] = sections.map((s: { distance: number; duration: number }) => s.duration);

  return new Response(
    JSON.stringify({
      directDurationSec,
      viaDurationSec,
      diffMinutes: Math.round((viaDurationSec - directDurationSec) / 60),
      // extra distance/toll caused by the detour, not the full via-route totals
      extraDistanceMeters: viaDistanceMeters - directDistanceMeters,
      extraTollFare: viaTollFare - directTollFare,
      // full via-route polyline (origin -> ...stops... -> destination), used
      // by the map screen to draw the actual route once an item is selected
      viaVertices,
      legDurationsSec,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
