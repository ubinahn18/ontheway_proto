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
      '아이템이 선택되었어요',
      `"${item.title}"이(가) 선택되었어요. 결제를 진행해주세요.`,
      { itemId }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
