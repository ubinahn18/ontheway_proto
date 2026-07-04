import { corsHeaders } from '../_shared/cors.ts';

// the seeker's own direct route (origin -> destination), independent of any
// item. computed once per search so the corridor buffer and the per-item
// detour calculation (kakao-navi-proxy) don't each re-fetch it.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { originLng, originLat, destLng, destLat } = await req.json();
  if (
    typeof originLng !== 'number' ||
    typeof originLat !== 'number' ||
    typeof destLng !== 'number' ||
    typeof destLat !== 'number'
  ) {
    return new Response(JSON.stringify({ error: 'all coordinates must be numbers' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = { Authorization: `KakaoAK ${Deno.env.get('KAKAO_REST_API_KEY')}` };

  const res = await fetch(
    `https://apis-navi.kakaomobility.com/v1/directions?origin=${originLng},${originLat}&destination=${destLng},${destLat}&road_details=true`,
    { headers: authHeader }
  );

  if (!res.ok) {
    const body = await res.text();
    return new Response(JSON.stringify({ error: 'kakao navi api error', body }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const data = await res.json();
  const route = data.routes?.[0];
  const durationSec = route?.summary?.duration;
  const distanceMeters = route?.summary?.distance;
  const tollFare = route?.summary?.fare?.toll ?? 0;

  if (typeof durationSec !== 'number' || typeof distanceMeters !== 'number') {
    return new Response(JSON.stringify({ error: 'unexpected kakao navi response', data }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const vertices: { lng: number; lat: number }[] = [];
  for (const section of route.sections ?? []) {
    for (const road of section.roads ?? []) {
      const vertexes: number[] = road.vertexes ?? [];
      for (let i = 0; i + 1 < vertexes.length; i += 2) {
        vertices.push({ lng: vertexes[i], lat: vertexes[i + 1] });
      }
    }
  }

  return new Response(
    JSON.stringify({ durationSec, distanceMeters, tollFare, vertices }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
