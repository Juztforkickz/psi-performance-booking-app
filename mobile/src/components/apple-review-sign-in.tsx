import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { getSupabaseClient } from '@/lib/supabase';

export function AppleReviewSignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    if (!REVIEW_ENVIRONMENT.enabled || busy) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password) {
      setError('Enter the review email and app password supplied in App Store Connect.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: signInError } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      });
      if (signInError || !data.session) throw new Error('REVIEW_SIGN_IN_FAILED');
    } catch {
      setError('Sign-in did not complete. Check the supplied review credentials and your connection, then try again.');
    } finally {
      setPassword('');
      setBusy(false);
    }
  }

  if (!REVIEW_ENVIRONMENT.enabled) return null;
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>Apple review sign-in</Text>
      <Text style={styles.copy}>Use the dedicated app credentials in the review notes. This isolated environment contains fictional records only. Do not enter a Gmail, Apple or live PSI password.</Text>
      <Field label="Review email">
        <FormInput autoCapitalize="none" autoComplete="username" keyboardType="email-address" maxLength={160} onChangeText={setEmail} value={email} />
      </Field>
      <Field label="Review app password">
        <FormInput autoCapitalize="none" autoComplete="off" maxLength={200} onChangeText={setPassword} secureTextEntry value={password} />
      </Field>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <PrimaryButton label="Sign in to review sandbox" loading={busy} onPress={() => void signIn()} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.ink, borderColor: colors.accent, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  title: { color: colors.white, fontSize: 22, fontWeight: '800' },
  copy: { color: colors.white, fontSize: 15, lineHeight: 22 },
  error: { color: colors.accent, fontSize: 15, lineHeight: 22 },
});
