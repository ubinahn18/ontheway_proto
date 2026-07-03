import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { originLng, originLat, destLng, destLat, pickupLng, pickupLat, dropoffLng, dropoffLat } =
    await req.json();

  const coords = { originLng, originLat, destLng, destLat, pickupLng, pickupLat, dropoffLng, dropoffLat };
  if (Object.values(coords).some((v) => typeof v !== 'number')) {
    return new Response(JSON.stringify({ error: 'all coordinates must be numbers' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = { Authorization: `KakaoAK ${Deno.env.get('KAKAO_REST_API_KEY')}` };

  const directReq = fetch(
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

  if (!directRes.ok || !viaRes.ok) {
    const body = await (directRes.ok ? viaRes : directRes).text();
    return new Response(JSON.stringify({ error: 'kakao navi api error', body }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const directData = await directRes.json();
  const viaData = await viaRes.json();

  const directDurationSec = directData.routes?.[0]?.summary?.duration;
  const viaDurationSec = viaData.routes?.[0]?.summary?.duration;
  const directDistanceMeters = directData.routes?.[0]?.summary?.distance;
  const viaDistanceMeters = viaData.routes?.[0]?.summary?.distance;
  const directTollFare = directData.routes?.[0]?.summary?.fare?.toll ?? 0;
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
