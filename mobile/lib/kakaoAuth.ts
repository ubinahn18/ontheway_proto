import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const KAKAO_REST_API_KEY = '81870cb8c7f3715b04e38de64b4b5ddf';
const KAKAO_CALLBACK_URL =
  'https://eitobfgxasdbimiewjhh.supabase.co/functions/v1/kakao-login-callback';

export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  if (params.error) throw new Error(params.error);

  if (params.token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: 'magiclink',
    });
    if (error) throw error;
    return;
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
  }
}

export async function signInWithKakao() {
  const appRedirectUri = makeRedirectUri();

  const authorizeUrl =
    `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_CALLBACK_URL)}` +
    `&response_type=code&scope=${encodeURIComponent('profile_nickname profile_image')}` +
    `&state=${encodeURIComponent(appRedirectUri)}`;

  const res = await WebBrowser.openAuthSessionAsync(authorizeUrl, appRedirectUri);
  if (res.type === 'success') {
    await createSessionFromUrl(res.url);
  }
}
