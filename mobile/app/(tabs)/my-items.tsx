import { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Item } from '../../lib/SearchContext';

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
            'id, title, description, price, photo_url, pickup_address, pickup_district, dropoff_address, dropoff_district, valid_until, status, uploader_id'
          )
          .eq('uploader_id', user.id)
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
        <Button title="새 아이템 등록" onPress={() => router.push('/item/new')} />
      }
      renderItem={({ item }) => (
        <View style={styles.card} onTouchEnd={() => router.push(`/item/${item.id}`)}>
          {item.photo_url && <Image source={{ uri: item.photo_url }} style={styles.thumb} />}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text>{item.price.toLocaleString()}원 · {item.status}</Text>
            <Text style={styles.helperText}>
              {item.pickup_district} → {item.dropoff_district}
            </Text>
          </View>
        </View>
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
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginTop: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontWeight: '600',
  },
  helperText: {
    color: '#555',
  },
});
