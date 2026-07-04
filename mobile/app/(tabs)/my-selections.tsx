import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Item } from '../../lib/SearchContext';
import { ItemCard } from '../../components/ItemCard';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
import { colors, radius, shadow, spacing, typography } from '../../lib/theme';

type MyRating = { average: number; count: number };

export default function MySelectionsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [rating, setRating] = useState<MyRating | null>(null);

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

        const { data: ratingData } = await supabase.rpc('get_my_rating');
        if (!cancelled && ratingData?.[0]) {
          setRating({
            average: Number(ratingData[0].average) || 0,
            count: Number(ratingData[0].rating_count) || 0,
          });
        }
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
          <View style={styles.ratingCard}>
            <StarRating value={rating?.average ?? 0} readonly size={22} />
            <Text style={styles.ratingText}>
              {rating && rating.count > 0
                ? `${rating.average.toFixed(1)} (${rating.count}개 평점)`
                : '아직 받은 평점이 없어요'}
            </Text>
          </View>
          <Button title="배송 이력 보기" onPress={() => router.push('/history/deliveries')} />
          <Button title="약관 보기" onPress={() => router.push('/terms')} variant="outline" />
          <Button title="로그아웃" onPress={() => supabase.auth.signOut()} variant="ghost" />
        </View>
      }
      renderItem={({ item }) => (
        <ItemCard item={item} onPress={() => router.push(`/item/${item.id}`)} />
      )}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="bag-check-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.helperText}>선택한 아이템이 없어요</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing.sm,
  },
  ratingCard: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  ratingText: {
    ...typography.subtitle,
    fontSize: 14,
  },
  helperText: {
    ...typography.caption,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
});
