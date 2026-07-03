import { ScrollView, StyleSheet, Text } from 'react-native';

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
      <Text style={styles.title}>이용약관</Text>
      <Text style={styles.body}>{PLACEHOLDER_TERMS}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: '#333',
  },
});
