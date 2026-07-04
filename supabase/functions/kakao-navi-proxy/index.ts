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
    directDurationSec: providedDirectDurationSec,
    directDistanceMeters: providedDirectDistanceMeters,
    directTollFare: providedDirectTollFare,
  } = await req.json();

  const coords = { originLng, originLat, destLng, destLat, pickupLng, pickupLat, dropoffLng, dropoffLat };
  if (Object.values(coords).some((v) => typeof v !== 'number')) {
    return new Response(JSON.stringify({ error: 'all coordinates must be numbers' }), {
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
      // pickup must precede dropoff: you cannot deliver an item before picking it up
      waypoints: [
        { x: pickupLng, y: pickupLat, name: 'pickup' },
        { x: dropoffLng, y: dropoffLat, name: 'dropoff' },
      ],
      priority: 'RECOMMEND',
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

  return new Response(
    JSON.stringify({
      directDurationSec,
      viaDurationSec,
      diffMinutes: Math.round((viaDurationSec - directDurationSec) / 60),
      // extra distance/toll caused by the detour, not the full via-route totals
      extraDistanceMeters: viaDistanceMeters - directDistanceMeters,
      extraTollFare: viaTollFare - directTollFare,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
