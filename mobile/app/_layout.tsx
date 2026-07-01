import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { SearchProvider } from '../lib/SearchContext';
import { registerForPushNotificationsAsync } from '../lib/notifications';

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      router.replace('/auth/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  useEffect(() => {
    if (session) registerForPushNotificationsAsync(session.user.id);
  }, [session]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const itemId = response.notification.request.content.data?.itemId;
      if (typeof itemId === 'string') router.push(`/item/${itemId}`);
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="item/[id]"
        options={{ headerShown: true, title: '아이템 상세' }}
      />
      <Stack.Screen
        name="item/new"
        options={{ headerShown: true, title: '아이템 등록' }}
      />
      <Stack.Screen
        name="auth/sign-in"
        options={{ headerShown: true, title: '로그인' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SearchProvider>
          <RootLayoutNav />
        </SearchProvider>
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
