import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfilePhotoPicker } from '@/components/profile-photo-picker';
import { AppleReviewSignIn } from '@/components/apple-review-sign-in';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { Eyebrow, Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatAustralianDate } from '@/lib/australian-date';
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
import {
  createCustomerProfilePhotoSignedUrl,
  removeCustomerProfilePhoto,
  uploadCustomerProfilePhoto,
} from '@/lib/customer-profile-photo';
import type { AccountDeletionRequestRow } from '@/lib/database.types';
import type { LocalVehiclePhoto } from '@/lib/local-vehicle-photo';
import { releaseLocalVehiclePhoto } from '@/lib/local-vehicle-photo';
import { loadStaffMfaSecurityAccess } from '@/lib/staff-portal';

type StaffEntryState = {
  eligible: boolean;
  userId: string;
};

export default function AccountScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { compact, horizontalPadding, short } = useResponsiveLayout();
  const auth = useCustomerAuth();
  const { account, error: accountError, refreshAccount, status: accountStatus } = useCustomerAccount();
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
  const [profilePhotoState, setProfilePhotoState] = useState<{ objectPath: string; uri: string; userId: string } | null>(null);
  const [profilePhotoBusy, setProfilePhotoBusy] = useState(false);
  const [profilePhotoNotice, setProfilePhotoNotice] = useState('');
  const [staffEntryState, setStaffEntryState] = useState<StaffEntryState | null>(null);
  const openSetupAfterSignInRef = useRef(false);
  const authenticatedUserId = auth.user?.id;
  const secureReturnTo = (Array.isArray(returnTo) ? returnTo[0] : returnTo) === '/staff' ? '/staff' : null;
  const accountSetupComplete = Boolean(
    account?.profile?.first_name?.trim()
    && account.profile.last_name?.trim()
    && account.profile.mobile?.trim()
    && account.vehicles.length > 0,
  );
  const currentProfilePhotoPath = account?.profile?.profile_photo_object_path ?? null;
  const profilePhotoUri = account?.profile
    && profilePhotoState?.userId === account.profile.user_id
    && (profilePhotoState.objectPath === currentProfilePhotoPath || profilePhotoState.objectPath === 'pending')
    ? profilePhotoState.uri
    : null;
  const staffPortalEligible = Boolean(authenticatedUserId && staffEntryState?.userId === authenticatedUserId && staffEntryState.eligible);

  useEffect(() => {
    if (auth.status === 'signed_in' && secureReturnTo) router.replace(secureReturnTo);
  }, [auth.status, router, secureReturnTo]);

  useEffect(() => {
    if (!openSetupAfterSignInRef.current || secureReturnTo || auth.status !== 'signed_in' || accountStatus !== 'ready' || !account) return;
    openSetupAfterSignInRef.current = false;
    if (!accountSetupComplete) router.replace('/account/sign-up');
  }, [account, accountSetupComplete, accountStatus, auth.status, router, secureReturnTo]);

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

  useEffect(() => {
    let active = true;
    const profile = account?.profile;
    if (!profile?.profile_photo_object_path) return;
    void createCustomerProfilePhotoSignedUrl(profile)
      .then((uri) => {
        if (active && uri) setProfilePhotoState({ objectPath: profile.profile_photo_object_path!, uri, userId: profile.user_id });
      })
      .catch(() => {
        if (active) setProfilePhotoNotice('Your private profile photo could not be opened. Your account details are unaffected.');
      });
    return () => { active = false; };
  }, [account?.profile]);

  useEffect(() => {
    if (auth.status !== 'signed_in' || !authenticatedUserId) return;
    let active = true;
    void loadStaffMfaSecurityAccess()
      .then((access) => {
        if (active) setStaffEntryState({ eligible: access.kind !== 'access_denied', userId: authenticatedUserId });
      })
      .catch(() => {
        if (active) setStaffEntryState({ eligible: false, userId: authenticatedUserId });
      });
    return () => { active = false; };
  }, [auth.sessionRevision, auth.status, authenticatedUserId]);

  const beginSignIn = async () => {
    if (busy || resendSeconds > 0) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setEmailError('Enter a valid email address.');
      setNotice('');
      return;
    }
    setEmailError('');
    if (!CUSTOMER_AUTH.enabled) {
      setNotice('Email sign-in is not active in this build. No code was sent.');
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
      openSetupAfterSignInRef.current = true;
      setNotice('Signed in. Your account is loading.');
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
      setNotice('Signed out on this device.');
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

  const changeProfilePhoto = async (photo: LocalVehiclePhoto | null) => {
    const profile = account?.profile;
    if (!profile || profilePhotoBusy) return;
    const previousState = profilePhotoState;
    setProfilePhotoBusy(true);
    setProfilePhotoNotice('');
    try {
      if (!photo) {
        const result = await removeCustomerProfilePhoto(profile);
        setProfilePhotoState(null);
        setProfilePhotoNotice(result.storageRemoved
          ? 'Your profile photo was removed.'
          : 'Your profile photo was removed from the account. The previous private file is queued for cleanup.');
      } else {
        setProfilePhotoState({ objectPath: 'pending', uri: photo.uri, userId: profile.user_id });
        const result = await uploadCustomerProfilePhoto(photo);
        setProfilePhotoState({ objectPath: result.profile.profile_photo_object_path!, uri: result.signedUrl, userId: profile.user_id });
        setProfilePhotoNotice(result.cleanupWarning ?? 'Your profile photo was saved privately.');
      }
      refreshAccount();
    } catch {
      setProfilePhotoState(previousState);
      setProfilePhotoNotice('The profile photo was not changed. Choose a JPEG, PNG or WebP image under 8 MB and try again.');
    } finally {
      if (photo) releaseLocalVehiclePhoto(photo);
      setProfilePhotoBusy(false);
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
        {auth.status !== 'signed_in' && REVIEW_ENVIRONMENT.enabled ? <AppleReviewSignIn /> : null}
        {auth.status !== 'signed_in' && !REVIEW_ENVIRONMENT.enabled ? <View style={[styles.card, compact && styles.cardCompact]}>
          <Text style={styles.cardTitle}>Sign in with email</Text>
          <Text style={styles.cardCopy}>
            We’ll email you a six-digit sign-in code. No password is required.{secureReturnTo ? ' After verification, you will return to the protected PSI staff workspace.' : ''}
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

        <Eyebrow>{secureReturnTo ? 'PSI staff access' : 'PSI customer account'}</Eyebrow>
        <Text maxFontSizeMultiplier={2} style={[styles.title, compact && styles.titleCompact]}>{secureReturnTo ? `Staff sign in.${`\n`}Protected portal.` : `Your cars.${`\n`}Your bookings.`}</Text>
        <Text style={styles.lead}>
          {REVIEW_ENVIRONMENT.enabled ? 'Review accounts open fictional data in a separate environment. Live customer and workshop accounts are not accessible here.' : secureReturnTo ? 'Use your approved PSI email. Authenticator verification is required before workshop records open.' : 'Keep your details, vehicles, reports and bookings together.'}
        </Text>

        {auth.status !== 'signed_in' && !REVIEW_ENVIRONMENT.enabled ? (
          <View style={[styles.providerNotice, compact && styles.cardCompact]}>
            <Text style={styles.providerKicker}>Account access</Text>
            <Text style={styles.providerTitle}>{secureReturnTo ? 'Staff email-code sign in' : 'Email-code sign in'}</Text>
            <Text style={styles.providerCopy}>
              {secureReturnTo
                ? 'Use the same six-digit email-code sign in. Only approved PSI staff continue to authenticator verification and the private portal.'
                : `Use a six-digit email code—no password needed. New customer access is ${CUSTOMER_AUTH.registrationEnabled ? 'available during the current onboarding window' : 'set up by PSI'}.`}
            </Text>
            {!secureReturnTo ? (
              <Pressable
                accessibilityHint="Uses the same email-code sign in, then verifies staff permission and MFA"
                accessibilityRole="button"
                onPress={() => router.replace({ pathname: '/account', params: { returnTo: '/staff' } })}
                style={({ pressed }) => [styles.staffSignInLink, pressed && styles.pressed]}
              >
                <Ionicons color={colors.accent} name="shield-checkmark-outline" size={19} />
                <View style={styles.staffSignInCopy}>
                  <Text style={styles.staffSignInTitle}>PSI Staff Sign-in</Text>
                  <Text style={styles.staffSignInText}>Approved workshop accounts only</Text>
                </View>
                <Ionicons color={colors.accent} name="arrow-forward" size={18} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {auth.error ? <Text accessibilityRole="alert" style={styles.errorText}>{auth.error}</Text> : null}

        {CUSTOMER_AUTH.enabled && auth.status === 'signed_in' ? (
          <View accessibilityLabel="Secure customer account summary" style={[styles.dashboardPreview, compact && styles.cardCompact]}>
            <View style={styles.dashboardHeading}>
              <Text style={styles.dashboardKicker}>Customer account</Text>
              <Text style={styles.dashboardBadge}>Signed in</Text>
            </View>
            <Text style={styles.dashboardTitle}>{account?.profile?.first_name ? `Welcome, ${account.profile.first_name}.` : 'Your PSI account.'}</Text>
            {accountError ? <Text accessibilityRole="alert" style={styles.errorText}>{accountError}</Text> : null}
            {accountStatus === 'loading' ? <Text style={styles.dashboardCopy}>Loading your account…</Text> : null}
            {account?.profile ? (
              <>
                <ProfilePhotoPicker
                  initials={`${account.profile.first_name?.[0] ?? ''}${account.profile.last_name?.[0] ?? ''}`}
                  onChange={(photo) => void changeProfilePhoto(photo)}
                  saving={profilePhotoBusy}
                  uri={profilePhotoUri}
                />
                {profilePhotoNotice ? <Text accessibilityRole="alert" style={styles.profilePhotoNotice}>{profilePhotoNotice}</Text> : null}
                <View style={styles.profileDetails}>
                  <ProfileDetail label="Name" value={[account.profile.first_name, account.profile.last_name].filter(Boolean).join(' ') || 'Not completed'} />
                  <ProfileDetail label="Email" value={account.profile.email} />
                  <ProfileDetail label="Mobile" value={account.profile.mobile || 'Not completed'} />
                  <ProfileDetail label="Vehicles" value={`${account.vehicles.length} saved`} />
                </View>
                <PrimaryButton label="Edit my profile" onPress={() => router.push('/account/sign-up')} />
              </>
            ) : account ? (
              <View style={styles.dashboardGrid}>
                <AccountFeature index="01" title="Profile" copy="Complete your profile to continue." />
                <AccountFeature index="02" title="Vehicles" copy={`${account.vehicles.length} vehicle${account.vehicles.length === 1 ? '' : 's'}.`} />
              </View>
            ) : null}
            {account && !accountSetupComplete ? <PrimaryButton label="Complete my profile" onPress={() => router.push('/account/sign-up')} /> : null}
            {staffPortalEligible ? (
              <View accessibilityLabel="PSI staff portal access" style={styles.staffAccessCard}>
                <View style={styles.staffAccessHeading}>
                  <Ionicons color={colors.success} name="shield-checkmark" size={23} />
                  <View style={styles.staffAccessCopy}>
                    <Text style={styles.staffAccessTitle}>PSI Staff Access</Text>
                    <Text style={styles.staffAccessText}>This approved account can switch between the customer app and protected workshop portal.</Text>
                  </View>
                </View>
                <PrimaryButton label="Open PSI Portal" onPress={() => router.push('/staff')} />
                <PrimaryButton label="Continue to Customer App" onPress={() => router.replace('/')} variant="outline" />
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
          <Text style={styles.dashboardCopy}>This demonstration uses example details. A PSI account keeps:</Text>
          <View style={styles.dashboardGrid}>
            <AccountFeature index="01" title="Your details" copy="Name, email and mobile." />
            <AccountFeature index="02" title="Your vehicles" copy="Vehicle details and photos." />
            <AccountFeature index="03" title="Next booking" copy="Confirmed date and visit information." />
            <AccountFeature index="04" title="Visit history" copy="Bookings, services and records." />
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
            <Text style={styles.reminderCopy}>Choose booking, service and device-alert preferences in Settings & Notifications.</Text>
          </View>
        </View>
        ) : null}

        {(REVIEW_ENVIRONMENT.enabled && auth.status !== 'signed_in') || (auth.status === 'signed_in' && account?.profile) ? null : <View style={[styles.createCard, compact && styles.cardCompact]}>
          <View style={styles.createCopy}>
            <Text style={styles.createTitle}>{account ? accountSetupComplete ? 'Account details' : 'Complete your profile' : CUSTOMER_AUTH.enabled ? 'Need an account?' : 'New to PSI?'}</Text>
            <Text style={styles.createText}>{account ? accountSetupComplete ? 'Update your contact details and primary vehicle.' : 'Add your name, mobile number and first vehicle to finish setting up your private PSI account.' : CUSTOMER_AUTH.registrationEnabled ? 'Add your details and primary vehicle.' : CUSTOMER_AUTH.enabled ? 'New customer accounts are set up by PSI. Contact us for access.' : 'Explore account setup with demonstration details.'}</Text>
          </View>
          <PrimaryButton
            label={account ? accountSetupComplete ? 'Edit account details →' : 'Complete my profile →' : CUSTOMER_AUTH.registrationEnabled ? 'Set up approved account →' : CUSTOMER_AUTH.enabled ? 'Contact PSI for account access →' : 'Preview account setup →'}
            onPress={() => router.push(account || CUSTOMER_AUTH.registrationEnabled || !CUSTOMER_AUTH.enabled ? '/account/sign-up' : '/support')}
            variant="outline"
          />
        </View>}

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
  staffSignInLink: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
  staffSignInCopy: { flex: 1, minWidth: 0, gap: 2 },
  staffSignInTitle: { color: colors.white, fontSize: 11, fontWeight: '900', letterSpacing: .6, textTransform: 'uppercase' },
  staffSignInText: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  dashboardPreview: { ...mobileFrame, gap: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.panel, padding: spacing.lg },
  dashboardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  dashboardKicker: { flex: 1, minWidth: 0, color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  dashboardBadge: { color: colors.ink, fontSize: 8, fontWeight: '900', textTransform: 'uppercase', backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  dashboardTitle: { color: colors.white, fontSize: 22, fontWeight: '900', lineHeight: 26, textTransform: 'uppercase' },
  dashboardCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  profilePhotoNotice: { color: colors.silver, fontSize: 10, lineHeight: 16 },
  profileDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  staffAccessCard: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.accentDark, backgroundColor: colors.inkSoft, padding: spacing.md },
  staffAccessHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  staffAccessCopy: { flex: 1, minWidth: 0, gap: 3 },
  staffAccessTitle: { color: colors.white, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  staffAccessText: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  profileDetail: { minWidth: 150, flex: 1, gap: 3, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  profileDetailLabel: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: .7, textTransform: 'uppercase' },
  profileDetailValue: { color: colors.white, fontSize: 12, fontWeight: '800', lineHeight: 18 },
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
  return formatAustralianDate(value, value);
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileDetail}>
      <Text style={styles.profileDetailLabel}>{label}</Text>
      <Text style={styles.profileDetailValue}>{value}</Text>
    </View>
  );
}
