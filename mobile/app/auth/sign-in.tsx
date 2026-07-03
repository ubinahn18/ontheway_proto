import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { signInWithKakao } from '../../lib/kakaoAuth';
import { colors, spacing, typography } from '../../lib/theme';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';

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

  const canSubmit = !submitting && !!email && !!password;

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.appName}>OnTheWay</Text>
        <Text style={styles.tagline}>가는 길에, 필요한 걸 전해주세요</Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="이메일"
          placeholder="이메일 주소"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextField
          label="비밀번호"
          placeholder="비밀번호 (6자 이상)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Button title="로그인" onPress={signIn} disabled={!canSubmit} />
        <Button
          title="처음이라면: 가입하기"
          onPress={signUp}
          disabled={!canSubmit}
          variant="outline"
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        <Button title="카카오로 로그인" onPress={kakaoSignIn} disabled={submitting} variant="kakao" />

        {submitting && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.xxl,
    backgroundColor: colors.background,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    marginBottom: spacing.sm,
  },
  appName: {
    ...typography.title,
    fontSize: 26,
  },
  tagline: {
    ...typography.caption,
  },
  form: {
    gap: spacing.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
  },
  spinner: {
    marginTop: spacing.sm,
  },
});
