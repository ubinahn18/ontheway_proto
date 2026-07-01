import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { lng, lat } = await req.json();
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    return new Response(JSON.stringify({ error: 'lng and lat must be numbers' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = { Authorization: `KakaoAK ${Deno.env.get('KAKAO_REST_API_KEY')}` };

  const [regionRes, addressRes] = await Promise.all([
    fetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`, {
      headers: authHeader,
    }),
    fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`, {
      headers: authHeader,
    }),
  ]);

  if (!regionRes.ok || !addressRes.ok) {
    const body = await (regionRes.ok ? addressRes : regionRes).text();
    return new Response(JSON.stringify({ error: 'kakao local api error', body }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const regionData = await regionRes.json();
  const addressData = await addressRes.json();

  const region = regionData.documents?.find((d: { region_type: string }) => d.region_type === 'H') ??
    regionData.documents?.[0];
  const addressDoc = addressData.documents?.[0];
  const address =
    addressDoc?.road_address?.address_name ?? addressDoc?.address?.address_name ?? null;

  return new Response(
    JSON.stringify({ district: region?.region_2depth_name ?? null, address }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
