import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Item } from '../lib/SearchContext';
import { formatDateTime } from '../lib/formatDateTime';
import { colors, radius, shadow, spacing, typography } from '../lib/theme';
import { StatusBadge } from './ui/StatusBadge';

export function ItemCard({
  item,
  onPress,
  detourMinutes,
  extraTollFare,
  latestPickupBy,
}: {
  item: Item;
  onPress: () => void;
  detourMinutes?: number;
  extraTollFare?: number;
  latestPickupBy?: string | null;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="cube-outline" size={24} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.price}>{item.price.toLocaleString()}원</Text>
        <View style={styles.routeRow}>
          <Text style={styles.routeText} numberOfLines={1}>
            {item.pickup_district}
          </Text>
          <Ionicons name="arrow-forward" size={12} color={colors.textSecondary} />
          <Text style={styles.routeText} numberOfLines={1}>
            {item.dropoff_district}
          </Text>
        </View>
        {typeof detourMinutes === 'number' && (
          <View style={styles.detourRow}>
            <Ionicons name="time-outline" size={12} color={colors.primary} />
            <Text style={styles.detourText}>
              +{detourMinutes}분
              {typeof extraTollFare === 'number' ? ` · 톨비 ${extraTollFare.toLocaleString()}원` : ''}
            </Text>
          </View>
        )}
        {latestPickupBy && (
          <View style={styles.detourRow}>
            <Ionicons name="alarm-outline" size={12} color={colors.danger} />
            <Text style={styles.deadlineText}>
              {formatDateTime(latestPickupBy)} 이전 출발 필요
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    ...shadow.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  thumbPlaceholder: {
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.subtitle,
    flex: 1,
  },
  price: {
    ...typography.price,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routeText: {
    ...typography.caption,
  },
  detourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs / 2,
  },
  detourText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  deadlineText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
});
