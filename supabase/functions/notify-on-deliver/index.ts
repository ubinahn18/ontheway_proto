import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { sendExpoPush } from '../_shared/expoPush.ts';

Deno.serve(async (req) => {
  const { itemId } = await req.json();
  if (typeof itemId !== 'string') {
    return new Response(JSON.stringify({ error: 'itemId required' }), { status: 400 });
  }

  const { data: item } = await supabaseAdmin
    .from('items')
    .select('title, uploader_id')
    .eq('id', itemId)
    .single();
  if (!item) return new Response(JSON.stringify({ error: 'item not found' }), { status: 404 });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('expo_push_token')
    .eq('id', item.uploader_id)
    .single();

  if (profile?.expo_push_token) {
    await sendExpoPush(
      profile.expo_push_token,
      '배송이 완료됐어요',
      `"${item.title}"이(가) 배송 완료됐어요. 확인해주세요.`,
      { itemId }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
