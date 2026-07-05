import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ItemBundle } from '../lib/bundleSearch';
import { formatDateTime } from '../lib/formatDateTime';
import { colors, radius, shadow, spacing, typography } from '../lib/theme';

export function PackageCard({ bundle, onPress }: { bundle: ItemBundle; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {bundle.stopOrder.map((stop, i) => {
        const item = bundle.items.find((it) => it.id === stop.itemId)!;
        const district = stop.kind === 'pickup' ? item.pickup_district : item.dropoff_district;
        return (
          <View key={`${stop.itemId}-${stop.kind}`} style={styles.stopRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{i + 1}</Text>
            </View>
            <Ionicons
              name={stop.kind === 'pickup' ? 'location' : 'flag'}
              size={14}
              color={stop.kind === 'pickup' ? colors.warning : colors.info}
            />
            <Text style={styles.stopText} numberOfLines={1}>
              {stop.kind === 'pickup' ? '픽업' : '도착'}: {item.title} ({district})
            </Text>
          </View>
        );
      })}

      <View style={styles.footer}>
        <Text style={styles.price}>{bundle.totalPrice.toLocaleString()}원</Text>
        <View style={styles.detourRow}>
          <Ionicons name="time-outline" size={12} color={colors.primary} />
          <Text style={styles.detourText}>
            +{bundle.totalDetourMinutes}분 · 톨비 {bundle.totalExtraTollFare.toLocaleString()}원
          </Text>
        </View>
      </View>
      {bundle.latestPickupBy && (
        <View style={styles.deadlineRow}>
          <Ionicons name="alarm-outline" size={12} color={colors.danger} />
          <Text style={styles.deadlineText}>
            {formatDateTime(bundle.latestPickupBy)} 이전 출발 필요
          </Text>
        </View>
      )}
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
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  stopText: {
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
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deadlineText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
});
