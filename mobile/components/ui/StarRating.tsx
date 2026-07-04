import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../lib/theme';

const STARS = [0, 1, 2, 3, 4];

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 24,
}: {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: number;
}) {
  return (
    <View style={styles.row}>
      {STARS.map((i) => {
        const iconName = readonly
          ? value >= i + 1
            ? 'star'
            : value >= i + 0.5
              ? 'star-half'
              : 'star-outline'
          : value >= i + 1
            ? 'star'
            : 'star-outline';

        if (readonly) {
          return <Ionicons key={i} name={iconName} size={size} color={colors.warning} />;
        }

        return (
          <Pressable key={i} onPress={() => onChange?.(i + 1)} hitSlop={6}>
            <Ionicons name={iconName} size={size} color={colors.warning} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
