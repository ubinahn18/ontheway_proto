import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

const CALLBACK_URL = 'https://eitobfgxasdbimiewjhh.supabase.co/functions/v1/kakao-login-callback';

function errorRedirect(appRedirectUri: string, message: string) {
  const url = `${appRedirectUri}?error=${encodeURIComponent(message)}`;
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response('missing code or state', { status: 400 });
  }

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: Deno.env.get('KAKAO_REST_API_KEY')!,
      client_secret: Deno.env.get('KAKAO_CLIENT_SECRET')!,
      redirect_uri: CALLBACK_URL,
      code,
    }),
  });
  if (!tokenRes.ok) {
    return errorRedirect(state, `kakao token exchange failed: ${await tokenRes.text()}`);
  }
  const { access_token: kakaoAccessToken } = await tokenRes.json();

  const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${kakaoAccessToken}` },
  });
  if (!meRes.ok) {
    return errorRedirect(state, `kakao user info failed: ${await meRes.text()}`);
  }
  const me = await meRes.json();

  const kakaoId = me.id;
  const nickname = me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? null;
  const avatarUrl =
    me.kakao_account?.profile?.profile_image_url ?? me.properties?.profile_image ?? null;
  const email = `kakao_${kakaoId}@kakaouser.invalid`;

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { kakao_id: kakaoId, display_name: nickname, avatar_url: avatarUrl },
  });
  if (createError && !createError.message.includes('already been registered')) {
    return errorRedirect(state, `supabase createUser failed: ${createError.message}`);
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    return errorRedirect(state, `supabase generateLink failed: ${linkError?.message}`);
  }

  const redirectUrl = `${state}?token_hash=${linkData.properties.hashed_token}&type=magiclink`;
  return new Response(null, { status: 302, headers: { Location: redirectUrl } });
});
