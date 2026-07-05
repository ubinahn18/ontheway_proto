import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Item } from '../../lib/SearchContext';
import type { SelectionGroupSummary } from '../../components/SelectionGroupCard';
import { ItemCard } from '../../components/ItemCard';
import { calcFuelCost } from '../../lib/fuelCost';
import { colors, radius, shadow, spacing, typography } from '../../lib/theme';

export default function SelectionGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<SelectionGroupSummary | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [{ data: groupData }, { data: itemData }] = await Promise.all([
          supabase.from('selection_groups').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('items')
            .select(
              'id, title, description, price, photo_url, pickup_address, pickup_district, dropoff_address, dropoff_district, valid_until, status, uploader_id, selected_by, delivered_at, completed_at'
            )
            .eq('selected_group_id', id)
            .order('created_at', { ascending: true }),
        ]);
        if (!cancelled) {
          setGroup(groupData as SelectionGroupSummary | null);
          setItems((itemData as Item[]) ?? []);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        group && (
          <View style={styles.headerCard}>
            <Text style={styles.title}>배송 {items.length}개 묶음</Text>
            <Text style={styles.price}>{group.total_price.toLocaleString()}원</Text>
            <Text style={styles.helperText}>
              +{group.total_detour_minutes}분 · 톨비 {group.total_extra_toll_fare.toLocaleString()}원 · 주유비
              약 {calcFuelCost(group.total_extra_distance_meters).toLocaleString()}원
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <ItemCard item={item} onPress={() => router.push(`/item/${item.id}`)} />
      )}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.helperText}>묶음을 찾을 수 없어요</Text>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  headerCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  title: {
    ...typography.title,
    fontSize: 18,
  },
  price: {
    ...typography.price,
    color: colors.primary,
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
