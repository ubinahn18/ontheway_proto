import { Button, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function MySelectionsScreen() {
  return (
    <View style={styles.container}>
      <Text>내 선택</Text>
      <Button title="로그아웃" onPress={() => supabase.auth.signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
