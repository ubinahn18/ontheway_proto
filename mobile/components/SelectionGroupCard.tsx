import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Item } from '../lib/SearchContext';
import { colors, radius, shadow, spacing, typography } from '../lib/theme';

export type SelectionGroupSummary = {
  id: string;
  total_price: number;
  total_detour_minutes: number;
  total_extra_toll_fare: number;
  total_extra_distance_meters: number;
};

const DONE_STATUSES = new Set(['delivered', 'completed']);

export function SelectionGroupCard({
  group,
  items,
  onPress,
}: {
  group: SelectionGroupSummary;
  items: Item[];
  onPress: () => void;
}) {
  const doneCount = items.filter((item) => DONE_STATUSES.has(item.status)).length;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {items.map((item) => (
        <View key={item.id} style={styles.itemRow}>
          <Ionicons
            name={DONE_STATUSES.has(item.status) ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
            color={DONE_STATUSES.has(item.status) ? colors.success : colors.textSecondary}
          />
          <Text style={styles.itemText} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.price}>{group.total_price.toLocaleString()}원</Text>
        <View style={styles.detourRow}>
          <Ionicons name="time-outline" size={12} color={colors.primary} />
          <Text style={styles.detourText}>
            +{group.total_detour_minutes}분 · 톨비 {group.total_extra_toll_fare.toLocaleString()}원
          </Text>
        </View>
      </View>
      <Text style={styles.progressText}>
        {doneCount}/{items.length} 배송완료
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    ...shadow.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemText: {
    ...typography.body,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  price: {
    ...typography.price,
  },
  detourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detourText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  progressText: {
    ...typography.caption,
    fontWeight: '600',
  },
});
