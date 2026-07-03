import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { Button } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Item } from '../../lib/SearchContext';
import { ItemCard } from '../../components/ItemCard';

export default function MyItemsScreen() {
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
          .eq('uploader_id', user.id)
          .neq('status', 'completed')
          .order('created_at', { ascending: false });
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
        <>
          <Button title="배송요청 등록" onPress={() => router.push('/item/new')} />
          <Button title="주문 이력 보기" onPress={() => router.push('/history/orders')} />
        </>
      }
      renderItem={({ item }) => (
        <ItemCard item={item} onPress={() => router.push(`/item/${item.id}`)} />
      )}
      ListEmptyComponent={<Text style={styles.helperText}>등록한 아이템이 없어요</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  helperText: {
    color: '#555',
  },
});
