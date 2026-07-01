import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { query } = await req.json();
  if (typeof query !== 'string' || !query.trim()) {
    return new Response(JSON.stringify({ error: 'query must be a non-empty string' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const kakaoRes = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `KakaoAK ${Deno.env.get('KAKAO_REST_API_KEY')}` } }
  );

  if (!kakaoRes.ok) {
    const body = await kakaoRes.text();
    return new Response(JSON.stringify({ error: 'kakao local api error', body }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const data = await kakaoRes.json();
  const doc = data.documents?.[0];

  if (!doc) {
    return new Response(JSON.stringify({ error: 'no address found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      address: doc.road_address?.address_name ?? doc.address?.address_name ?? doc.address_name,
      district: doc.address?.region_2depth_name ?? null,
      lng: Number(doc.x),
      lat: Number(doc.y),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
