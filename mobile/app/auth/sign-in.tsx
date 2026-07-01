import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { signInWithKakao } from '../../lib/kakaoAuth';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function kakaoSignIn() {
    setSubmitting(true);
    try {
      await signInWithKakao();
    } catch (e) {
      Alert.alert('카카오 로그인 실패', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function signUp() {
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (error) {
      Alert.alert('가입 실패', error.message);
      return;
    }
    if (!data.session) {
      Alert.alert(
        '이메일 확인이 필요해요',
        '가입은 됐지만 이메일 인증 링크를 눌러야 로그인이 완료돼요.'
      );
    }
  }

  async function signIn() {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      Alert.alert('로그인 실패', error.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>이메일로 로그인</Text>
      <TextInput
        style={styles.input}
        placeholder="이메일 주소"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호 (6자 이상)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="로그인" onPress={signIn} disabled={submitting || !email || !password} />
      <Button title="처음이라면: 가입하기" onPress={signUp} disabled={submitting || !email || !password} />

      <Text style={styles.divider}>또는</Text>
      <Button title="카카오로 로그인" onPress={kakaoSignIn} disabled={submitting} />

      {submitting && <ActivityIndicator style={styles.spinner} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
  },
  spinner: {
    marginTop: 8,
  },
  divider: {
    textAlign: 'center',
    color: '#999',
    marginTop: 8,
  },
});
