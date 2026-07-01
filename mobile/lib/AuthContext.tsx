import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import { createSessionFromUrl } from './kakaoAuth';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    const linkingListener = Linking.addEventListener('url', ({ url }) => {
      createSessionFromUrl(url).catch(() => {});
    });

    Linking.getInitialURL().then((url) => {
      if (url) createSessionFromUrl(url).catch(() => {});
    });

    return () => {
      listener.subscription.unsubscribe();
      linkingListener.remove();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
