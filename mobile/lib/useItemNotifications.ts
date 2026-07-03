import { useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import type { Item } from './SearchContext';

// Expo Go can't receive real push notifications (see notifications.ts), so this
// mirrors what notify-on-select / notify-on-deliver would have pushed, in-app,
// via Supabase Realtime — lets both flows be tested without a dev-client build.
export function useItemNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`items-owner-${userId}`)
      .on<Item>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'items', filter: `uploader_id=eq.${userId}` },
        ({ old: oldItem, new: newItem }) => {
          if (oldItem.status === 'available' && newItem.status === 'selected') {
            const etaText = newItem.delivery_eta
              ? ` 예상 도착: ${new Date(newItem.delivery_eta).toLocaleString()}`
              : '';
            Alert.alert('아이템이 선택되었어요', `"${newItem.title}"이(가) 선택되었어요.${etaText}`);
          } else if (oldItem.status === 'selected' && newItem.status === 'delivered') {
            Alert.alert('배송이 완료됐어요', `"${newItem.title}"이(가) 배송 완료됐어요. 확인해주세요.`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
