import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import {
  cancelOwnAccountDeletionRequest,
  loadOwnAccountDeletionRequest,
  requestOwnAccountDeletion,
} from '@/lib/account-deletion';
import { useCustomerAccount } from '@/lib/customer-account-context';
import {
  CUSTOMER_AUTH,
  EMAIL_CODE_RESEND_COOLDOWN_SECONDS,
  requestPasswordlessEmailCode,
  signOutCustomer,
  verifyPasswordlessEmailCode,
} from '@/lib/customer-auth';
import { unregisterCurrentPushDevice } from '@/lib/notifications';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import type { AccountDeletionRequestRow } from '@/lib/database.types';

export default function AccountScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { compact, horizontalPadding, short } = useResponsiveLayout();
  const auth = useCustomerAuth();
  const { account, error: accountError, status: accountStatus } = useCustomerAccount();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [notice, setNotice] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [deletionConfirmVisible, setDeletionConfirmVisible] = useState(false);
  const [deletionError, setDeletionError] = useState('');
  const [deletionRequest, setDeletionRequest] = useState<AccountDeletionRequestRow | null>(null);
  const authenticatedUserId = auth.user?.id;
  const secureReturnTo = (Array.isArray(returnTo) ? returnTo[0] : returnTo) === '/staff' ? '/staff' : null;

  useEffect(() => {
    if (auth.status === 'signed_in' && secureReturnTo) router.replace(secureReturnTo);
  }, [auth.status, router, secureReturnTo]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  useEffect(() => {
    let cancelled = false;
    if (auth.status !== 'signed_in' || !authenticatedUserId) return;
    void loadOwnAccountDeletionRequest()
      .then((request) => {
        if (!cancelled) setDeletionRequest(request);
      })
      .catch(() => {
        if (!cancelled) setDeletionError('Account-deletion status could not be loaded. Your account has not been changed.');
      });
    return () => { cancelled = true; };
  }, [auth.status, authenticatedUserId]);

  const beginSignIn = async () => {
    if (busy || resendSeconds > 0) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError('Enter a valid email address.');
      setNotice('');
      return;
    }
    setEmailError('');
    if (!CUSTOMER_AUTH.enabled) {
      setNotice('The secure Supabase foundation is ready, but customer email delivery is not active in this build. No code was sent and your email was not stored.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      await requestPasswordlessEmailCode(email);
      setCodeSent(true);
      setResendSeconds(EMAIL_CODE_RESEND_COOLDOWN_SECONDS);
      setNotice('If this email belongs to an approved PSI account, a six-digit sign-in code will arrive shortly. Enter it below within 10 minutes.');
    } catch {
      setNotice('A sign-in code could not be requested. Customer registration may still be closed, or the email service may be temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code.replace(/\s/gu, ''))) {
      setCodeError('Enter the six-digit code from your email.');
      return;
    }
    setBusy(true);
    setCodeError('');
    setNotice('');
    try {
      await verifyPasswordlessEmailCode(email, code);
      setCode('');
      setNotice('Secure sign-in complete. Your account is loading.');
    } catch {
      setCodeError('That code could not be verified. Check the code, request a new one, or try again before it expires.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    try {
      await unregisterCurrentPushDevice().catch(() => undefined);
      await signOutCustomer();
      setCode('');
      setCodeSent(false);
      setResendSeconds(0);
      setEmail('');
      setNotice('Signed out securely on this device.');
    } catch {
      setNotice('The local sign-out could not be completed. Close the app and try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitDeletionRequest = async () => {
    if (!auth.user || deletionBusy) return;
    setDeletionBusy(true);
    setDeletionError('');
    try {
      const request = await requestOwnAccountDeletion(auth.user.id);
      setDeletionRequest(request);
      setDeletionConfirmVisible(false);
    } catch {
      setDeletionError('The deletion request could not be recorded. Nothing was deleted. Please try again or contact PSI support.');
    } finally {
      setDeletionBusy(false);
    }
  };

  const cancelDeletionRequest = async () => {
    if (!auth.user || deletionBusy || deletionRequest?.status !== 'requested') return;
    setDeletionBusy(true);
    setDeletionError('');
    try {
      await cancelOwnAccountDeletionRequest(auth.user.id);
      setDeletionRequest(null);
    } catch {
      setDeletionError('The pending request could not be cancelled. Please contact PSI support before the review is completed.');
    } finally {
      setDeletionBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
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
        {auth.status !== 'signed_in' ? <View style={[styles.card, compact && styles.cardCompact]}>
          <Text style={styles.cardTitle}>Sign in with email</Text>
          <Text style={styles.cardCopy}>
            We’ll email you a secure six-digit sign-in code. No password is required.{secureReturnTo ? ' After verification, you will return to the protected PSI staff workspace.' : ''}
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
                setCodeSent(false);
                setResendSeconds(0);
                setCode('');
                setCodeError('');
                setNotice('');
              }}
              placeholder="you@example.com"
              value={email}
            />
          </Field>
          {CUSTOMER_AUTH.enabled && codeSent ? (
            <Field error={codeError} hint="Expires after 10 minutes" label="Six-digit code">
              <FormInput
                autoComplete="one-time-code"
                error={codeError}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/gu, ''));
                  setCodeError('');
                }}
                placeholder="000000"
                value={code}
              />
            </Field>
          ) : null}
          {notice ? (
            <View accessibilityRole="alert" style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}
          {CUSTOMER_AUTH.enabled && codeSent ? (
            <>
              <PrimaryButton label="Verify and sign in" loading={busy} onPress={() => void verifyCode()} />
              <PrimaryButton
                label={resendSeconds > 0 ? `Request a new code in ${resendSeconds}s` : 'Request a new code'}
                disabled={busy || resendSeconds > 0}
                onPress={() => void beginSignIn()}
                variant="outline"
              />
            </>
          ) : (
            <PrimaryButton label={CUSTOMER_AUTH.enabled ? 'Email my sign-in code' : 'Check sign-in readiness'} loading={busy} onPress={() => void beginSignIn()} />
          )}
        </View> : null}

        <Eyebrow>PSI customer account</Eyebrow>
        <Text maxFontSizeMultiplier={2} style={[styles.title, compact && styles.titleCompact]}>Your cars.{`\n`}Your bookings.</Text>
        <Text style={styles.lead}>
          Account access is designed for saved customer details, vehicles, receipts and booking history through a managed identity provider.
        </Text>

        <View style={[styles.providerNotice, compact && styles.cardCompact]}>
          <Text style={styles.providerKicker}>Your account security</Text>
          <Text style={styles.providerTitle}>{CUSTOMER_AUTH.enabled ? 'Secure email-code access' : 'Email-code access'}</Text>
          <Text style={styles.providerCopy}>
            Passwords are not collected or stored here. {CUSTOMER_AUTH.enabled ? `Six-digit codes provide access to approved customer accounts. New account registration is ${CUSTOMER_AUTH.registrationEnabled ? 'available during this approved onboarding window' : 'currently closed'}.` : 'Secure email-code sign-in is available to approved PSI customers.'} Customers see only their own records; authorised PSI staff use a separate protected workshop portal.
          </Text>
        </View>

        {auth.error ? <Text accessibilityRole="alert" style={styles.errorText}>{auth.error}</Text> : null}

        {CUSTOMER_AUTH.enabled && auth.status === 'signed_in' ? (
          <View accessibilityLabel="Secure customer account summary" style={[styles.dashboardPreview, compact && styles.cardCompact]}>
            <View style={styles.dashboardHeading}>
              <Text style={styles.dashboardKicker}>Secure customer account</Text>
              <Text style={styles.dashboardBadge}>Authenticated</Text>
            </View>
            <Text style={styles.dashboardTitle}>{account?.profile?.first_name ? `Welcome, ${account.profile.first_name}.` : 'Your PSI account.'}</Text>
            <Text style={styles.dashboardCopy}>{auth.user?.email}</Text>
            {accountError ? <Text accessibilityRole="alert" style={styles.errorText}>{accountError}</Text> : null}
            {accountStatus === 'loading' ? <Text style={styles.dashboardCopy}>Loading your private account…</Text> : null}
            {account ? (
              <View style={styles.dashboardGrid}>
                <AccountFeature index="01" title="Profile" copy={account.profile ? 'Verified account profile connected.' : 'Complete your profile to continue.'} />
                <AccountFeature index="02" title="Vehicles" copy={`${account.vehicles.length} vehicle${account.vehicles.length === 1 ? '' : 's'} connected to this account.`} />
              </View>
            ) : null}
            <PrimaryButton label="Sign out" loading={busy} onPress={() => void signOut()} variant="outline" />
          </View>
        ) : !CUSTOMER_AUTH.enabled ? (
        <View accessibilityLabel="Customer account dashboard preview; no customer records loaded" style={[styles.dashboardPreview, compact && styles.cardCompact]}>
          <View style={styles.dashboardHeading}>
            <Text style={styles.dashboardKicker}>Account dashboard preview</Text>
            <Text style={styles.dashboardBadge}>Example structure</Text>
          </View>
          <Text style={styles.dashboardTitle}>Everything ready for the next visit.</Text>
          <Text style={styles.dashboardCopy}>This demonstration does not load customer records. A PSI customer account is designed to keep:</Text>
          <View style={styles.dashboardGrid}>
            <AccountFeature index="01" title="Your details" copy="Full name, verified email and mobile for faster future requests and checkout." />
            <AccountFeature index="02" title="Your vehicles" copy="Registration, make, model, year and optional VIN, with support for more than one vehicle." />
            <AccountFeature index="03" title="Next booking" copy="The next confirmed date, approved work, deposit status and practical arrival information." />
            <AccountFeature index="04" title="Visit history" copy="Booking requests, confirmed and completed visits, service dates, deposit receipts and payment status." />
          </View>
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Booking status history</Text>
            <AccountStatus label="Request received" copy="Pending PSI staff review · no payment due" />
            <AccountStatus label="Date approved" copy="Secure deposit link sent" />
            <AccountStatus label="Deposit verified" copy="Booking confirmed · internal calendar entry created" />
            <AccountStatus label="Visit completed" copy="Added to the vehicle’s service and booking history" last />
          </View>
          <View style={styles.reminderPreview}>
            <Text style={styles.reminderTitle}>Reminder preferences</Text>
            <Text style={styles.reminderCopy}>Confirmed bookings receive factual 7-day and 24-hour appointment reminders. Optional “Ready for your next service?” messages at 6 and 12 months appear only after a completed service when the customer opted in, with unsubscribe included. No automatic review request or vehicle-package offer is added.</Text>
          </View>
        </View>
        ) : null}

        <View style={[styles.createCard, compact && styles.cardCompact]}>
          <View style={styles.createCopy}>
            <Text style={styles.createTitle}>{account ? 'Account details' : CUSTOMER_AUTH.enabled ? 'Need an account?' : 'New to PSI?'}</Text>
            <Text style={styles.createText}>{account ? 'Review or update the profile and primary vehicle connected to your secure account.' : CUSTOMER_AUTH.registrationEnabled ? 'Complete the approved account setup for your details and primary vehicle.' : CUSTOMER_AUTH.enabled ? 'New customer accounts are currently set up by PSI. Contact us if you need account access.' : 'Preview the account setup for your details and primary vehicle. New account registration is currently closed.'}</Text>
          </View>
          <PrimaryButton
            label={account ? 'Edit account details →' : CUSTOMER_AUTH.registrationEnabled ? 'Set up approved account →' : CUSTOMER_AUTH.enabled ? 'Contact PSI for account access →' : 'Preview account setup →'}
            onPress={() => router.push(account || CUSTOMER_AUTH.registrationEnabled || !CUSTOMER_AUTH.enabled ? '/account/sign-up' : '/support')}
            variant="outline"
          />
        </View>

        {CUSTOMER_AUTH.enabled && auth.status === 'signed_in' ? (
          <View accessibilityLabel="Account deletion controls" style={[styles.deletionCard, compact && styles.cardCompact]}>
            <Text style={styles.deletionKicker}>Privacy & account control</Text>
            <Text style={styles.deletionTitle}>Delete your PSI account</Text>
            {deletionRequest ? (
              <>
                <Text style={styles.deletionStatus}>{deletionRequest.status === 'requested' ? 'REQUEST RECEIVED' : deletionRequest.status === 'in_review' ? 'DELETION IN REVIEW' : 'DELETION COMPLETED'}</Text>
                <Text style={styles.deletionCopy}>
                  Requested {formatAccountDate(deletionRequest.requested_at)}. PSI will normally complete verified deletion requests within 30 days. Customer profile data, login access and customer-uploaded files will be removed; records PSI must lawfully retain for workshop, accounting, dispute or safety purposes will be limited and protected or de-identified where appropriate.
                </Text>
                {deletionRequest.status === 'requested' ? <PrimaryButton label="Cancel pending deletion request" loading={deletionBusy} onPress={() => void cancelDeletionRequest()} variant="outline" /> : null}
              </>
            ) : deletionConfirmVisible ? (
              <View style={styles.deletionConfirm}>
                <Text style={styles.deletionWarning}>This requests deletion of your entire customer account—not merely this device’s session. PSI will verify and process it within 30 days. You can cancel while the request is still pending.</Text>
                <PrimaryButton label="Confirm account deletion request" loading={deletionBusy} onPress={() => void submitDeletionRequest()} />
                <PrimaryButton label="Keep my account" disabled={deletionBusy} onPress={() => setDeletionConfirmVisible(false)} variant="outline" />
              </View>
            ) : (
              <>
                <Text style={styles.deletionCopy}>Initiate deletion inside the app. PSI will confirm the request and remove account data that is not legally required to be retained. This does not affect Australian Consumer Law rights or valid workshop records that PSI must keep.</Text>
                <PrimaryButton label="Request account deletion" onPress={() => setDeletionConfirmVisible(true)} variant="outline" />
              </>
            )}
            {deletionError ? <Text accessibilityRole="alert" style={styles.errorText}>{deletionError}</Text> : null}
          </View>
        ) : null}

        <View style={styles.legalLinks}>
          <PrimaryButton label="Privacy & data handling" onPress={() => router.push('/privacy')} variant="outline" />
          <PrimaryButton label="Support & account help" onPress={() => router.push('/support')} variant="outline" />
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

function AccountFeature({ index, title, copy }: { index: string; title: string; copy: string }) {
  return (
    <View style={styles.accountFeature}>
      <Text style={styles.accountFeatureIndex}>{index}</Text>
      <Text style={styles.accountFeatureTitle}>{title}</Text>
      <Text style={styles.accountFeatureCopy}>{copy}</Text>
    </View>
  );
}

function AccountStatus({ label, copy, last = false }: { label: string; copy: string; last?: boolean }) {
  return (
    <View style={[styles.accountStatus, last && styles.accountStatusLast]}>
      <View style={styles.statusDot} />
      <View style={styles.statusCopyWrap}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusCopy}>{copy}</Text>
      </View>
    </View>
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
  backArrow: { color: colors.accent, fontSize: 22 },
  backText: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  logo: { width: 106, height: 38 },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingTop: spacing.xl, paddingBottom: 64 },
  scrollShort: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { marginTop: spacing.md, color: colors.white, fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 43, textTransform: 'uppercase' },
  titleCompact: { fontSize: 34, letterSpacing: -1.3, lineHeight: 37 },
  lead: { marginTop: spacing.lg, color: colors.muted, fontSize: 15, lineHeight: 24 },
  providerNotice: { ...mobileFrame, gap: spacing.sm, marginTop: spacing.xl, backgroundColor: colors.panel, padding: spacing.lg },
  cardCompact: { padding: spacing.md },
  providerKicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  providerTitle: { color: colors.white, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  providerCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  dashboardPreview: { ...mobileFrame, gap: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.panel, padding: spacing.lg },
  dashboardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  dashboardKicker: { flex: 1, minWidth: 0, color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  dashboardBadge: { color: colors.ink, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  dashboardTitle: { color: colors.white, fontSize: 22, fontWeight: '900', lineHeight: 26, textTransform: 'uppercase' },
  dashboardCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  dashboardGrid: { gap: spacing.sm },
  accountFeature: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.inkSoft, padding: spacing.md },
  accountFeatureIndex: { color: colors.accent, fontSize: 9, fontWeight: '900' },
  accountFeatureTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  accountFeatureCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  timelineCard: { borderTopWidth: 1, borderTopColor: colors.accent, paddingTop: spacing.lg },
  timelineTitle: { marginBottom: spacing.sm, color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  accountStatus: { flexDirection: 'row', gap: spacing.md, borderLeftWidth: 1, borderLeftColor: colors.line, marginLeft: 5, paddingBottom: spacing.md, paddingLeft: spacing.md },
  accountStatusLast: { borderLeftColor: 'transparent', paddingBottom: 0 },
  statusDot: { position: 'absolute', left: -5, top: 3, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  statusCopyWrap: { flex: 1, minWidth: 0, gap: 3 },
  statusLabel: { color: colors.silver, fontSize: 12, fontWeight: '900' },
  statusCopy: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  reminderPreview: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.inkSoft, padding: spacing.md },
  reminderTitle: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  reminderCopy: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  card: { ...mobileFrame, gap: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.panel, padding: spacing.lg },
  cardTitle: { color: colors.white, fontSize: 22, fontWeight: '900', textTransform: 'uppercase' },
  cardCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  notice: { ...mobileFrame, backgroundColor: colors.inkSoft, padding: spacing.md },
  noticeText: { color: colors.silver, fontSize: 12, lineHeight: 19 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 19 },
  createCard: { ...mobileFrame, gap: spacing.lg, marginTop: spacing.lg, padding: spacing.lg },
  createCopy: { gap: spacing.xs },
  createTitle: { color: colors.white, fontSize: 16, fontWeight: '900' },
  createText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  deletionCard: { ...mobileFrame, gap: spacing.md, marginTop: spacing.lg, backgroundColor: colors.panel, padding: spacing.lg },
  deletionKicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  deletionTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  deletionStatus: { alignSelf: 'flex-start', color: colors.ink, fontSize: 9, fontWeight: '900', backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  deletionCopy: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  deletionConfirm: { gap: spacing.md, borderColor: colors.accentDark, borderWidth: 1, backgroundColor: colors.inkSoft, padding: spacing.md },
  deletionWarning: { color: colors.silver, fontSize: 11, fontWeight: '700', lineHeight: 18 },
  legalLinks: { gap: spacing.sm, marginTop: spacing.lg },
  guestLink: { ...mobileFrame, minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  guestLinkText: { flex: 1, minWidth: 0, color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  guestArrow: { color: colors.accent, fontSize: 21 },
  pressed: { opacity: 0.72 },
});

function formatAccountDate(value: string) {
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Melbourne', year: 'numeric' });
}
