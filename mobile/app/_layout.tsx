import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { SearchProvider } from '../lib/SearchContext';
import { registerForPushNotificationsAsync } from '../lib/notifications';
import { useItemNotifications } from '../lib/useItemNotifications';
import { colors } from '../lib/theme';

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

  useItemNotifications(session?.user.id ?? null);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const itemId = response.notification.request.content.data?.itemId;
      if (typeof itemId === 'string') router.push(`/item/${itemId}`);
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="item/[id]"
        options={{ headerShown: true, title: '아이템 상세' }}
      />
      <Stack.Screen
        name="item/new"
        options={{ headerShown: true, title: '배송요청 등록' }}
      />
      <Stack.Screen
        name="history/orders"
        options={{ headerShown: true, title: '주문 이력' }}
      />
      <Stack.Screen
        name="history/deliveries"
        options={{ headerShown: true, title: '배송 이력' }}
      />
      <Stack.Screen
        name="auth/sign-in"
        options={{ headerShown: true, title: '로그인' }}
      />
      <Stack.Screen
        name="terms"
        options={{ headerShown: true, title: '이용약관' }}
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
