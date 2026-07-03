import { StyleSheet, Text, View } from 'react-native';
import { statusColor, statusLabel } from '../../lib/itemStatus';
import { radius, spacing } from '../../lib/theme';

export function StatusBadge({ status }: { status: string }) {
  const { text, background } = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.text, { color: text }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
