import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, Field, FormInput, PrimaryButton } from '@/components/ui';
import { type LocalVehiclePhoto, VehiclePhotoPicker } from '@/components/vehicle-photo-picker';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import {
  saveCustomerProfile,
  saveCustomerVehicle,
  type CustomerAccountSnapshot,
} from '@/lib/customer-account';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { uploadCustomerVehiclePhoto } from '@/lib/customer-private-files';
import { useCustomerPreview } from '@/lib/customer-preview-context';
import { releaseLocalVehiclePhoto } from '@/lib/local-vehicle-photo';

type AccountDraft = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  registration: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
};

const EMPTY_ACCOUNT: AccountDraft = {
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  registration: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
};

type AccountErrors = Partial<Record<keyof AccountDraft, string>>;

export default function SignUpScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const auth = useCustomerAuth();
  const { account, status } = useCustomerAccount();
  const waitingForAccount = CUSTOMER_AUTH.enabled
    && (auth.status === 'loading' || (auth.status === 'signed_in' && status === 'loading'));

  if (waitingForAccount) return <AccountFormLoading />;

  return <AccountDetailsForm addVehicleMode={mode === 'add'} initialAccount={auth.status === 'signed_in' ? account : null} />;
}

function AccountFormLoading() {
  const { horizontalPadding } = useResponsiveLayout();
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <View style={[styles.loadingState, { paddingHorizontal: horizontalPadding }]}>
        <Text style={styles.loadingTitle}>Loading account</Text>
        <Text style={styles.loadingCopy}>Preparing your profile and primary vehicle…</Text>
      </View>
    </SafeAreaView>
  );
}

function AccountDetailsForm({ addVehicleMode, initialAccount }: { addVehicleMode: boolean; initialAccount: CustomerAccountSnapshot | null }) {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { refreshAccount } = useCustomerAccount();
  const { stageAccountPreview } = useCustomerPreview();
  const { compact, horizontalPadding, short, useFieldColumns: wide } = useResponsiveLayout();
  const initialVehicle = addVehicleMode ? null : initialAccount?.vehicles.find((vehicle) => vehicle.is_primary) ?? initialAccount?.vehicles[0] ?? null;
  const canEditVehicle = !initialVehicle || initialVehicle.created_by === initialAccount?.user.id;
  const [form, setForm] = useState<AccountDraft>(() => initialAccount ? {
    email: initialAccount.user.email ?? initialAccount.profile?.email ?? '',
    firstName: initialAccount.profile?.first_name ?? '',
    lastName: initialAccount.profile?.last_name ?? '',
    mobile: initialAccount.profile?.mobile ?? '',
    registration: initialVehicle?.registration ?? '',
    vehicleMake: initialVehicle?.make ?? '',
    vehicleModel: initialVehicle?.model ?? '',
    vehicleYear: initialVehicle ? String(initialVehicle.year) : '',
  } : EMPTY_ACCOUNT);
  const [editingVehicleId, setEditingVehicleId] = useState(initialVehicle?.id ?? null);
  const [errors, setErrors] = useState<AccountErrors>({});
  const [notice, setNotice] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState<LocalVehiclePhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const vehiclePhotoRef = useRef(vehiclePhoto);
  const photoTransferredRef = useRef(false);

  useEffect(() => {
    vehiclePhotoRef.current = vehiclePhoto;
  }, [vehiclePhoto]);

  useEffect(() => () => {
    if (!photoTransferredRef.current) releaseLocalVehiclePhoto(vehiclePhotoRef.current);
  }, []);

  const update = (key: keyof AccountDraft, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setNotice('');
  };

  const checkReadiness = async () => {
    if (CUSTOMER_AUTH.enabled && auth.status !== 'signed_in') {
      setNotice('Sign in with your verified email code before saving an account profile.');
      return;
    }

    const nextErrors: AccountErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = 'Enter your first name.';
    if (!form.lastName.trim()) nextErrors.lastName = 'Enter your last name.';
    const accountEmail = CUSTOMER_AUTH.enabled ? auth.user?.email ?? '' : form.email;
    if (!/^\S+@\S+\.\S+$/.test(accountEmail.trim())) nextErrors.email = 'Enter a valid email address.';
    const phoneDigits = form.mobile.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) nextErrors.mobile = 'Enter a valid mobile number.';
    if (!form.registration.trim()) nextErrors.registration = 'Enter the registration.';
    if (!form.vehicleMake.trim()) nextErrors.vehicleMake = 'Enter the vehicle make.';
    if (!form.vehicleModel.trim()) nextErrors.vehicleModel = 'Enter the vehicle model.';
    const year = Number(form.vehicleYear);
    const latestYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(year) || year < 1900 || year > latestYear) {
      nextErrors.vehicleYear = `Enter a year between 1900 and ${latestYear}.`;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice('');
      return;
    }

    if (CUSTOMER_AUTH.enabled) {
      setSaving(true);
      setNotice('');
      try {
        await saveCustomerProfile({
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
        });
        let savedVehicle = initialVehicle;
        if (canEditVehicle) {
          savedVehicle = await saveCustomerVehicle({
            make: form.vehicleMake,
            model: form.vehicleModel,
            registration: form.registration,
            year,
          }, editingVehicleId ?? undefined);
          setEditingVehicleId(savedVehicle.id);
        }
        let photoNotice = '';
        if (vehiclePhoto && savedVehicle && canEditVehicle) {
          try {
            const result = await uploadCustomerVehiclePhoto(savedVehicle.id, vehiclePhoto);
            photoNotice = result.cleanupWarning
              ? ` Your vehicle photo was saved privately. ${result.cleanupWarning}`
              : ' Your vehicle photo was saved privately to your account.';
          } catch {
            photoNotice = ' Your profile and vehicle were saved, but the selected photo was not uploaded. Choose a JPEG, PNG or WebP image under 8 MB and try again.';
          }
        }
        refreshAccount();
        setNotice(`${canEditVehicle ? 'Your profile and vehicle details were' : 'Your profile was'} saved to your private PSI account.${canEditVehicle ? '' : ' This PSI-created vehicle remains read-only and was not changed.'}${photoNotice}`);
      } catch {
        setNotice('Your profile could not be saved. Nothing was uploaded. Sign in again and try once more.');
      } finally {
        setSaving(false);
      }
      return;
    }

    stageAccountPreview({
      email: form.email,
      firstName: form.firstName,
      lastName: form.lastName,
      mobile: form.mobile,
      photo: vehiclePhoto,
      registration: form.registration,
      vehicleMake: form.vehicleMake,
      vehicleModel: form.vehicleModel,
      vehicleYear: year,
    });
    photoTransferredRef.current = true;
    setNotice(
      `Demo account details are ready and were not submitted.${vehiclePhoto ? ' The selected photo remains in this demo only.' : ''}`,
    );
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <View style={[styles.header, compact && styles.headerCompact, { paddingHorizontal: horizontalPadding }]}>
        <Pressable
          accessibilityLabel="Back to account access"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text maxFontSizeMultiplier={1.3} style={styles.backArrow}>←</Text>
          <Text maxFontSizeMultiplier={2} style={styles.backText}>Account</Text>
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
          <Eyebrow>{addVehicleMode ? 'My Garage' : CUSTOMER_AUTH.enabled ? 'Account setup' : 'Account demo'}</Eyebrow>
          <Text maxFontSizeMultiplier={2} style={[styles.title, compact && styles.titleCompact]}>{addVehicleMode ? `Add another.\nKeep it together.` : `One profile.\nEvery PSI visit.`}</Text>
          <Text style={styles.lead}>
            {addVehicleMode
              ? 'Add another vehicle to your private PSI garage. Your existing vehicles remain unchanged.'
              : CUSTOMER_AUTH.enabled ? 'Add your contact details and primary vehicle. Sign in uses an email code, not a password.' : 'Explore the account setup with demonstration details.'}
          </Text>

          <View style={[styles.securityCard, compact && styles.cardCompact]}>
            <Text style={styles.securityTitle}>{CUSTOMER_AUTH.enabled ? 'Your privacy' : 'Demo only'}</Text>
            <Text style={styles.securityCopy}>
              {CUSTOMER_AUTH.enabled ? 'Your profile, vehicle and photo are saved privately. Only you and authorised PSI staff can view them.' : 'Demo values clear when the app closes.'}
            </Text>
          </View>

          {CUSTOMER_AUTH.enabled && auth.status !== 'signed_in' ? (
            <View accessibilityRole="alert" style={styles.notice}>
              <Text maxFontSizeMultiplier={2} style={styles.noticeTitle}>Sign-in required</Text>
              <Text style={styles.noticeCopy}>Return to Account and verify the six-digit code before saving details.</Text>
              <PrimaryButton label="Go to sign in" onPress={() => router.replace('/account')} variant="outline" />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your details</Text>
            <View style={[styles.row, wide && styles.rowWide]}>
              <View style={styles.cell}>
                <Field error={errors.firstName} label="First name">
                  <FormInput autoCapitalize="words" autoComplete="given-name" error={errors.firstName} onChangeText={(value) => update('firstName', value)} value={form.firstName} />
                </Field>
              </View>
              <View style={styles.cell}>
                <Field error={errors.lastName} label="Last name">
                  <FormInput autoCapitalize="words" autoComplete="family-name" error={errors.lastName} onChangeText={(value) => update('lastName', value)} value={form.lastName} />
                </Field>
              </View>
            </View>
            <View style={[styles.row, wide && styles.rowWide]}>
              <View style={styles.cell}>
                <Field error={errors.email} label="Email">
                  <FormInput autoCapitalize="none" autoComplete="email" editable={!CUSTOMER_AUTH.enabled} error={errors.email} keyboardType="email-address" onChangeText={(value) => update('email', value)} placeholder="you@example.com" value={CUSTOMER_AUTH.enabled ? auth.user?.email ?? '' : form.email} />
                </Field>
              </View>
              <View style={styles.cell}>
                <Field error={errors.mobile} label="Mobile">
                  <FormInput autoComplete="tel" error={errors.mobile} keyboardType="phone-pad" onChangeText={(value) => update('mobile', value)} placeholder="04xx xxx xxx" value={form.mobile} />
                </Field>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{addVehicleMode ? 'New vehicle' : 'Primary vehicle'}</Text>
            {!canEditVehicle ? <Text style={styles.vehicleOwnershipNotice}>PSI created this vehicle record. You can view it here, but only PSI can correct its verified details.</Text> : null}
            <View style={[styles.row, wide && styles.rowWide]}>
              <View style={styles.cell}>
                <Field error={errors.registration} label="Registration">
                  <FormInput autoCapitalize="characters" editable={canEditVehicle} error={errors.registration} maxLength={12} onChangeText={(value) => update('registration', value.toUpperCase())} placeholder="ABC123" value={form.registration} />
                </Field>
              </View>
              <View style={styles.cell}>
                <Field error={errors.vehicleYear} label="Year">
                  <FormInput editable={canEditVehicle} error={errors.vehicleYear} keyboardType="number-pad" maxLength={4} onChangeText={(value) => update('vehicleYear', value.replace(/\D/g, ''))} placeholder="2017" value={form.vehicleYear} />
                </Field>
              </View>
            </View>
            <View style={[styles.row, wide && styles.rowWide]}>
              <View style={styles.cell}>
                <Field error={errors.vehicleMake} label="Make">
                  <FormInput autoCapitalize="words" editable={canEditVehicle} error={errors.vehicleMake} onChangeText={(value) => update('vehicleMake', value)} placeholder="e.g. Holden" value={form.vehicleMake} />
                </Field>
              </View>
              <View style={styles.cell}>
                <Field error={errors.vehicleModel} label="Model">
                  <FormInput autoCapitalize="words" editable={canEditVehicle} error={errors.vehicleModel} onChangeText={(value) => update('vehicleModel', value)} placeholder="e.g. VF SS" value={form.vehicleModel} />
                </Field>
              </View>
            </View>
            <VehiclePhotoPicker
              onChange={(photo) => {
                const previousWasTransferred = photoTransferredRef.current;
                photoTransferredRef.current = false;
                vehiclePhotoRef.current = photo;
                setVehiclePhoto((current) => {
                  if (!previousWasTransferred && current?.uri !== photo?.uri) {
                    releaseLocalVehiclePhoto(current);
                  }
                  return photo;
                });
                setNotice('');
              }}
              saving={saving}
              storageMode={CUSTOMER_AUTH.enabled ? 'private_account' : 'local_preview'}
              value={vehiclePhoto}
              vehicleLabel={[form.vehicleYear, form.vehicleMake, form.vehicleModel].filter(Boolean).join(' ') || 'your primary vehicle'}
            />
          </View>

          {notice ? (
            <View accessibilityRole="alert" style={styles.notice}>
            <Text maxFontSizeMultiplier={2} style={styles.noticeTitle}>Profile structure ready</Text>
              <Text style={styles.noticeCopy}>{notice}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton disabled={CUSTOMER_AUTH.enabled && auth.status !== 'signed_in'} label={addVehicleMode ? 'Add vehicle' : CUSTOMER_AUTH.enabled ? 'Save account details' : 'Check account setup'} loading={saving} onPress={() => void checkReadiness()} />
            {notice ? <PrimaryButton label="Open My Garage" onPress={() => router.replace('/garage')} variant="outline" /> : null}
            <PrimaryButton label="Book without an account" onPress={() => router.replace('/booking')} variant="outline" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.ink },
  loadingState: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingTitle: { color: colors.white, fontSize: 20, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  loadingCopy: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
  header: { width: '100%', maxWidth: 760, minHeight: 70, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  headerCompact: { minHeight: 62 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backArrow: { color: colors.accent, fontSize: 22 },
  backText: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  logo: { width: 106, height: 38 },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingTop: spacing.xl, paddingBottom: 64 },
  scrollShort: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { marginTop: spacing.md, color: colors.white, fontSize: 40, fontWeight: '900', letterSpacing: -1.8, lineHeight: 42, textTransform: 'uppercase' },
  titleCompact: { fontSize: 33, letterSpacing: -1.2, lineHeight: 36 },
  lead: { marginTop: spacing.lg, color: colors.muted, fontSize: 15, lineHeight: 23 },
  securityCard: { ...mobileFrame, gap: spacing.sm, marginTop: spacing.xl, backgroundColor: colors.panel, padding: spacing.md },
  cardCompact: { paddingHorizontal: spacing.sm },
  securityTitle: { color: colors.white, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  securityCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  section: { gap: spacing.lg, marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.lg },
  sectionTitle: { color: colors.white, fontSize: 19, fontWeight: '900', textTransform: 'uppercase' },
  vehicleOwnershipNotice: { color: colors.accent, fontSize: 11, fontWeight: '800', lineHeight: 17 },
  row: { gap: spacing.lg },
  rowWide: { flexDirection: 'row' },
  cell: { flex: 1 },
  notice: { ...mobileFrame, gap: spacing.sm, marginTop: spacing.xl, backgroundColor: colors.panel, padding: spacing.lg },
  noticeTitle: { color: colors.accent, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  noticeCopy: { color: colors.silver, fontSize: 12, lineHeight: 19 },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  pressed: { opacity: 0.72 },
});
