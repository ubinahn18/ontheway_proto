import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing, typography } from '../lib/theme';

// placeholder copy — replace with the actual terms before launch. Needs to
// cover penalties, liability for theft/damage, and the per-item price ceiling.
const PLACEHOLDER_TERMS = `1. (자리표시자) 배송 중 분실·파손에 대한 책임과 배상 범위
2. (자리표시자) 약속 시간 미준수, 배송 취소 등에 대한 패널티
3. (자리표시자) 등록 가능한 물품 가격 상한 및 취급 제한 품목
4. (자리표시자) 분쟁 발생 시 처리 절차

* 이 내용은 임시 자리표시자이며, 실제 약관 문구로 교체될 예정입니다.`;

export default function TermsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="document-text" size={20} color={colors.primary} />
        <Text style={styles.title}>이용약관</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.body}>{PLACEHOLDER_TERMS}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  body: {
    fontSize: 14,
    lineHeight: 24,
    color: colors.textSecondary,
  },
});
