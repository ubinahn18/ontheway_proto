import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Item } from '../../lib/SearchContext';
import { ItemCard } from '../../components/ItemCard';
import { SelectionGroupCard, type SelectionGroupSummary } from '../../components/SelectionGroupCard';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
import { colors, radius, shadow, spacing, typography } from '../../lib/theme';

type MyRating = { average: number; count: number };

type SelectedItem = Item & { selected_at: string };

// items selected together (via select_items) share a selected_group_id, and
// should surface as one banner rather than n separate item rows — legacy
// selections from before this grouping existed have no group id, so those
// still render individually
type ListEntry =
  | { key: string; kind: 'group'; group: SelectionGroupSummary; items: SelectedItem[] }
  | { key: string; kind: 'single'; item: SelectedItem };

export default function MySelectionsScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<ListEntry[]>([]);
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
            'id, title, description, price, photo_url, pickup_address, pickup_district, dropoff_address, dropoff_district, valid_until, status, uploader_id, selected_by, selected_group_id, selected_at, delivered_at, completed_at'
          )
          .eq('selected_by', user.id)
          .in('status', ['selected', 'delivered'])
          .order('selected_at', { ascending: false });
        const items = (data as SelectedItem[]) ?? [];

        const groupIds = [...new Set(items.map((i) => i.selected_group_id).filter(Boolean))];
        const { data: groupData } = groupIds.length
          ? await supabase.from('selection_groups').select('*').in('id', groupIds)
          : { data: [] as SelectionGroupSummary[] };
        const groupsById = new Map((groupData ?? []).map((g) => [g.id, g as SelectionGroupSummary]));

        const itemsByGroup = new Map<string, SelectedItem[]>();
        const singles: SelectedItem[] = [];
        for (const item of items) {
          if (item.selected_group_id && groupsById.has(item.selected_group_id)) {
            const list = itemsByGroup.get(item.selected_group_id) ?? [];
            list.push(item);
            itemsByGroup.set(item.selected_group_id, list);
          } else {
            singles.push(item);
          }
        }

        const groupEntries: ListEntry[] = [...itemsByGroup.entries()].map(([groupId, groupItems]) => ({
          key: groupId,
          kind: 'group',
          group: groupsById.get(groupId)!,
          items: groupItems,
        }));
        const singleEntries: ListEntry[] = singles.map((item) => ({
          key: item.id,
          kind: 'single',
          item,
        }));
        const combined = [...groupEntries, ...singleEntries].sort((a, b) => {
          const aTime = a.kind === 'group' ? a.items[0].selected_at ?? '' : a.item.selected_at ?? '';
          const bTime = b.kind === 'group' ? b.items[0].selected_at ?? '' : b.item.selected_at ?? '';
          return bTime.localeCompare(aTime);
        });
        if (!cancelled) setEntries(combined);

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
      data={entries}
      keyExtractor={(entry) => entry.key}
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
          <Button title="주문 이력 보기" onPress={() => router.push('/history/orders')} />
          <Button title="배송 이력 보기" onPress={() => router.push('/history/deliveries')} />
          <Button title="약관 보기" onPress={() => router.push('/terms')} variant="outline" />
          <Button title="로그아웃" onPress={() => supabase.auth.signOut()} variant="ghost" />
        </View>
      }
      renderItem={({ item: entry }) =>
        entry.kind === 'group' ? (
          <SelectionGroupCard
            group={entry.group}
            items={entry.items}
            onPress={() => router.push(`/selection-group/${entry.group.id}`)}
          />
        ) : (
          <ItemCard item={entry.item} onPress={() => router.push(`/item/${entry.item.id}`)} />
        )
      }
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
