import { supabase } from './supabase';

export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `${name} 호출 실패`);
  }
  return res.json();
}
