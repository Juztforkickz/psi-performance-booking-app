import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function AccountScreen() {
  const router = useRouter();
  const { compact, horizontalPadding, short } = useResponsiveLayout();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [notice, setNotice] = useState('');

  const previewSignIn = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError('Enter a valid email address.');
      setNotice('');
      return;
    }
    setEmailError('');
    setNotice('Managed account sign-in is not connected in this build. No link was sent and your email was not stored.');
  };

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.screen}>
      <View style={[styles.header, compact && styles.headerCompact, { paddingHorizontal: horizontalPadding }]}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text maxFontSizeMultiplier={1.3} style={styles.backArrow}>←</Text>
          <Text maxFontSizeMultiplier={2} style={styles.backText}>Back</Text>
        </Pressable>
        <Image
          accessibilityLabel="PSI Performance Garage"
          resizeMode="contain"
          source={require('../../../assets/images/psi-logo.png')}
          style={styles.logo}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, short && styles.scrollShort, { paddingHorizontal: horizontalPadding }]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <Eyebrow>PSI customer account</Eyebrow>
        <Text maxFontSizeMultiplier={2} style={[styles.title, compact && styles.titleCompact]}>Your cars.{`\n`}Your bookings.</Text>
        <Text style={styles.lead}>
          Account access is designed for saved customer details, vehicles, receipts and booking history through a managed identity provider.
        </Text>

        <View style={[styles.providerNotice, compact && styles.cardCompact]}>
          <Text style={styles.providerKicker}>Provider-ready preview</Text>
          <Text style={styles.providerTitle}>Secure identity connection pending</Text>
          <Text style={styles.providerCopy}>
            Passwords are not collected or stored here. Sign-in links and accounts will only activate after PSI connects a managed authentication service.
          </Text>
        </View>

        <View style={[styles.card, compact && styles.cardCompact]}>
          <Text style={styles.cardTitle}>Sign in with email</Text>
          <Text style={styles.cardCopy}>
            The production experience will send a secure one-time sign-in link—no reusable password required.
          </Text>
          <Field error={emailError} label="Email">
            <FormInput
              autoCapitalize="none"
              autoComplete="email"
              error={emailError}
              keyboardType="email-address"
              maxLength={160}
              onChangeText={(value) => {
                setEmail(value);
                setEmailError('');
                setNotice('');
              }}
              placeholder="you@example.com"
              value={email}
            />
          </Field>
          {notice ? (
            <View accessibilityRole="alert" style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}
          <PrimaryButton label="Check sign-in readiness" onPress={previewSignIn} />
        </View>

        <View style={[styles.createCard, compact && styles.cardCompact]}>
          <View style={styles.createCopy}>
            <Text style={styles.createTitle}>New to PSI?</Text>
            <Text style={styles.createText}>Preview the account setup for your details and primary vehicle.</Text>
          </View>
          <PrimaryButton label="Preview account setup →" onPress={() => router.push('/account/sign-up')} variant="outline" />
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.guestLink, pressed && styles.pressed]}>
          <Text style={styles.guestLinkText}>Continue without an account</Text>
          <Text maxFontSizeMultiplier={1.3} style={styles.guestArrow}>→</Text>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.ink },
  header: {
    width: '100%',
    maxWidth: 720,
    minHeight: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerCompact: { minHeight: 62 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backArrow: { color: colors.gold, fontSize: 22 },
  backText: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  logo: { width: 106, height: 38 },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingTop: spacing.xl, paddingBottom: 64 },
  scrollShort: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { marginTop: spacing.md, color: colors.white, fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 43, textTransform: 'uppercase' },
  titleCompact: { fontSize: 34, letterSpacing: -1.3, lineHeight: 37 },
  lead: { marginTop: spacing.lg, color: colors.muted, fontSize: 15, lineHeight: 24 },
  providerNotice: { gap: spacing.sm, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: colors.gold, backgroundColor: colors.panel, padding: spacing.lg },
  cardCompact: { padding: spacing.md },
  providerKicker: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  providerTitle: { color: colors.white, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  providerCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  card: { gap: spacing.lg, marginTop: spacing.xl, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: spacing.lg },
  cardTitle: { color: colors.white, fontSize: 22, fontWeight: '900', textTransform: 'uppercase' },
  cardCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  notice: { borderLeftWidth: 3, borderLeftColor: colors.gold, backgroundColor: colors.inkSoft, padding: spacing.md },
  noticeText: { color: colors.cream, fontSize: 12, lineHeight: 19 },
  createCard: { gap: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg },
  createCopy: { gap: spacing.xs },
  createTitle: { color: colors.white, fontSize: 16, fontWeight: '900' },
  createText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  guestLink: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.lg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: spacing.sm },
  guestLinkText: { flex: 1, minWidth: 0, color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  guestArrow: { color: colors.gold, fontSize: 21 },
  pressed: { opacity: 0.72 },
});
