import { useCallback, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Item } from '../../lib/SearchContext';
import { ItemCard } from '../../components/ItemCard';

export default function MySelectionsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from('items')
          .select(
            'id, title, description, price, photo_url, pickup_address, pickup_district, dropoff_address, dropoff_district, valid_until, status, uploader_id, selected_by, delivered_at, completed_at'
          )
          .eq('selected_by', user.id)
          .in('status', ['selected', 'delivered'])
          .order('selected_at', { ascending: false });
        if (!cancelled) setItems((data as Item[]) ?? []);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Button title="배송 이력 보기" onPress={() => router.push('/history/deliveries')} />
          <Button title="약관 보기" onPress={() => router.push('/terms')} />
          <Button title="로그아웃" onPress={() => supabase.auth.signOut()} />
        </View>
      }
      renderItem={({ item }) => (
        <ItemCard item={item} onPress={() => router.push(`/item/${item.id}`)} />
      )}
      ListEmptyComponent={<Text style={styles.helperText}>선택한 아이템이 없어요</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  header: {
    gap: 8,
  },
  helperText: {
    color: '#555',
  },
});
