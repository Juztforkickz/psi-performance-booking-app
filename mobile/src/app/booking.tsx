import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChoiceCard, Eyebrow, Field, FormInput, PrimaryButton, UiToneProvider } from '@/components/ui';
import { bookingColors, colors, contact, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatAustralianDate } from '@/lib/australian-date';
import type { CustomerProfileRow, CustomerVehicleRow } from '@/lib/database.types';
import {
  BOOKING_DRAFT_EXPIRY_DAYS,
  clearBookingDraft,
  loadBookingDraft,
  saveBookingDraft,
  type LoadedBookingDraft,
} from '@/lib/booking-draft';
import {
  BOOKING_PURPOSES,
  BookingApiError,
  createBookingRequest,
  dateFromIso,
  depositAmountForBookingType,
  displayDate,
  displayMoney,
  EMPTY_BOOKING,
  isEligibleBookingDate,
  localIsoDate,
  maxBookingDate,
  type ArrivalArrangement,
  type BookingErrors,
  type BookingFormState,
  type BookingRequestResult,
  type BookingType,
  type TuningDetails,
  validateBookingStep,
} from '@/lib/booking';
import { useCustomerPreview } from '@/lib/customer-preview-context';
import { type PreviewVehicle } from '@/lib/customer-preview';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { PUBLIC_DEMO } from '@/lib/public-demo';
import { SUPABASE_CONNECTION } from '@/lib/supabase';

const STEP_LABELS = ['Job', 'Vehicle', 'Details', 'Date', 'Review'];
const COMPACT_STEP_LABELS = ['Job', 'Car', 'You', 'Date', 'Review'];
const ARRIVAL_OPTIONS: { value: ArrivalArrangement; label: string; detail: string }[] = [
  { value: 'business_hours', label: 'During business hours', detail: 'Drop off Monday–Friday between 8:30am and 5pm.' },
  { value: 'before_hours_drop_off', label: 'Before-hours drop-off', detail: 'Request an arrangement before the workshop opens.' },
  { value: 'after_hours_drop_off', label: 'After-hours drop-off', detail: 'Request an arrangement after the workshop closes.' },
  { value: 'flexible', label: 'I’m flexible', detail: 'PSI can suggest the best drop-off arrangement.' },
];

type SelectOption<T extends string> = { value: T; label: string; detail?: string };

const ENGINE_OPTIONS: SelectOption<Exclude<TuningDetails['engineState'], ''>>[] = [
  { value: 'stock', label: 'Stock engine' },
  { value: 'modified', label: 'Modified engine' },
];
const TRANSMISSION_TYPE_OPTIONS: SelectOption<Exclude<TuningDetails['transmissionType'], ''>>[] = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'manual', label: 'Manual' },
];
const AUTOMATIC_SETUP_OPTIONS: SelectOption<Exclude<TuningDetails['transmissionSetup'], ''>>[] = [
  { value: 'stock', label: 'Stock' },
  { value: 'converter', label: 'Upgraded converter' },
  { value: 'trans_cooler', label: 'Transmission cooler' },
  { value: 'converter_and_cooler', label: 'Converter + transmission cooler' },
  { value: 'built_transmission', label: 'Built transmission' },
  { value: 'other', label: 'Other setup' },
];
const MANUAL_SETUP_OPTIONS: SelectOption<Exclude<TuningDetails['transmissionSetup'], ''>>[] = [
  { value: 'stock', label: 'Stock' },
  { value: 'upgraded_clutch', label: 'Upgraded clutch' },
  { value: 'built_transmission', label: 'Built transmission' },
  { value: 'other', label: 'Other setup' },
];
const DIFFERENTIAL_OPTIONS: SelectOption<Exclude<TuningDetails['differentialType'], ''>>[] = [
  { value: 'stock', label: 'Stock differential' },
  { value: 'truetrac', label: 'Truetrac' },
  { value: 'wavetrac', label: 'Wavetrac' },
  { value: 'other', label: 'Other differential' },
];
const COMPONENT_OPTIONS: SelectOption<'stock' | 'upgraded' | 'unknown'>[] = [
  { value: 'stock', label: 'Stock' },
  { value: 'upgraded', label: 'Upgraded' },
  { value: 'unknown', label: 'Not sure' },
];
const FUEL_OPTIONS: SelectOption<Exclude<TuningDetails['fuelType'], ''>>[] = [
  { value: '98_ron', label: '98 RON' },
  { value: 'e85', label: 'E85' },
  { value: 'flex_fuel', label: 'Flex fuel' },
  { value: 'race_fuel', label: 'Race fuel' },
  { value: 'other', label: 'Other fuel' },
];
const INTAKE_OPTIONS: SelectOption<Exclude<TuningDetails['intakeType'], ''>>[] = [
  { value: 'stock', label: 'Stock intake' },
  { value: 'upgraded', label: 'Upgraded intake' },
];
const HISTORY_OPTIONS: SelectOption<Exclude<TuningDetails['previouslyTuned'], ''>>[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
  { value: 'unknown', label: 'Not sure' },
];
const EXHAUST_OPTIONS: SelectOption<Exclude<TuningDetails['exhaustType'], ''>>[] = [
  { value: 'stock', label: 'Stock exhaust' },
  { value: 'cat_back', label: 'Cat-back system' },
  { value: 'downpipe', label: 'Downpipe' },
  { value: 'full_system', label: 'Full system' },
  { value: 'custom', label: 'Custom setup' },
];
const EXHAUST_SIZE_OPTIONS: SelectOption<Exclude<TuningDetails['exhaustSize'], ''>>[] = [
  { value: 'stock', label: 'Stock size' },
  { value: '2_5_inch', label: '2.5 inch' },
  { value: '3_inch', label: '3 inch' },
  { value: '3_5_inch', label: '3.5 inch' },
  { value: '4_inch', label: '4 inch' },
  { value: 'other', label: 'Other size' },
];
const HEADER_EXTRACTOR_DOWNPIPE_SIZE_OPTIONS: SelectOption<Exclude<TuningDetails['headerExtractorDownpipeSize'], ''>>[] = [
  { value: 'stock', label: 'Stock size' },
  { value: '1_5_8_inch', label: '1 5/8 inch' },
  { value: '1_3_4_inch', label: '1 3/4 inch' },
  { value: '1_7_8_inch', label: '1 7/8 inch' },
  { value: '2_inch', label: '2 inch' },
  { value: '2_25_inch', label: '2.25 inch' },
  { value: '2_5_inch', label: '2.5 inch' },
  { value: '3_inch', label: '3 inch' },
  { value: '3_5_inch', label: '3.5 inch' },
  { value: '4_inch', label: '4 inch' },
  { value: 'other', label: 'Other size' },
];
const VAREX_OPTIONS: SelectOption<Exclude<TuningDetails['varexControlled'], ''>>[] = [
  { value: 'no', label: 'No Varex control' },
  { value: 'yes', label: 'Varex controlled' },
  { value: 'unknown', label: 'Not sure' },
];
const CAMSHAFT_OPTIONS: SelectOption<Exclude<TuningDetails['camshaftType'], ''>>[] = [
  { value: 'stock', label: 'Stock camshaft(s)' },
  { value: 'upgraded', label: 'Upgraded camshaft(s)' },
  { value: 'unknown', label: 'Not sure' },
];

function bookingTypeFromParam(value?: string | string[]): BookingType | '' {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected === 'service' || selected === 'dyno' ? selected : '';
}

function selectedOptionLabel(options: readonly SelectOption<string>[], value: string) {
  return options.find((option) => option.value === value)?.label ?? 'Not selected';
}

function withDetails(value: string, details: string) {
  return details.trim() ? `${value} · ${details.trim()}` : value;
}

function draftMatchesVehicle(form: BookingFormState, vehicle: PreviewVehicle) {
  const normalise = (value: string) => value.trim().toLocaleLowerCase('en-AU');
  return normalise(form.vehicleMake) === normalise(vehicle.make)
    && normalise(form.vehicleModel) === normalise(vehicle.model)
    && normalise(form.vehicleYear) === String(vehicle.year)
    && normalise(form.registration) === normalise(vehicle.registration);
}

function firstErrorStep(errors: BookingErrors) {
  if (errors.bookingType || errors.requestDetails || errors.setupConfidence || Object.keys(errors).some((key) => key === 'tuningDetails' || key.startsWith('tuningDetails.'))) return 1;
  if (errors.vehicleMake || errors.vehicleModel || errors.vehicleYear || errors.registration || errors.vin) return 2;
  if (errors.firstName || errors.lastName || errors.email || errors.mobile) return 3;
  if (errors.preferredDate || errors.appointmentPreferenceMode || errors.arrivalArrangement) return 4;
  return 5;
}

type UpdateBooking = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => void;
type UpdateTuning = <K extends keyof TuningDetails>(key: K, value: TuningDetails[K]) => void;

export default function BookingScreen() {
  const auth = useCustomerAuth();
  const { account, refreshAccount, status } = useCustomerAccount();
  const waitingForAccount = CUSTOMER_AUTH.enabled
    && (auth.status === 'loading' || (auth.status === 'signed_in' && status === 'loading'));

  return (
    <UiToneProvider tone="booking">
      {waitingForAccount
        ? <BookingAccountLoading />
        : (
          <BookingScreenContent
            accountProfile={auth.status === 'signed_in' ? account?.profile ?? null : null}
            accountVehicles={auth.status === 'signed_in' ? account?.vehicles ?? [] : []}
            authenticatedEmail={auth.status === 'signed_in' ? auth.user?.email ?? null : null}
            onBookingStored={refreshAccount}
            privateBookingEnabled={auth.status === 'signed_in' && SUPABASE_CONNECTION.bookingEnabled}
          />
        )}
    </UiToneProvider>
  );
}

function accountVehicleToPreview(vehicle: CustomerVehicleRow | undefined): PreviewVehicle | null {
  if (!vehicle) return null;
  return {
    id: vehicle.id,
    isPrimary: vehicle.is_primary,
    lastVisit: null,
    make: vehicle.make,
    model: vehicle.model,
    nextDue: null,
    odometerKm: vehicle.odometer_km,
    registration: vehicle.registration,
    vinLastFour: vehicle.vin_last_four,
    year: vehicle.year,
  };
}

function normaliseVehicleRegistration(value: string) {
  return value.trim().toUpperCase().replace(/\s/gu, '');
}

function BookingAccountLoading() {
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <View style={styles.accountLoadingState}>
        <ActivityIndicator color={bookingColors.accent} size="large" />
        <Text style={styles.accountLoadingTitle}>Preparing your booking</Text>
        <Text style={styles.accountLoadingCopy}>Loading your private account details for secure form prefill…</Text>
      </View>
    </SafeAreaView>
  );
}

function BookingScreenContent({
  accountProfile,
  accountVehicles,
  authenticatedEmail,
  onBookingStored,
  privateBookingEnabled,
}: {
  accountProfile: CustomerProfileRow | null;
  accountVehicles: CustomerVehicleRow[];
  authenticatedEmail: string | null;
  onBookingStored: () => void;
  privateBookingEnabled: boolean;
}) {
  const router = useRouter();
  const {
    clearPendingBookingVehicle,
    ephemeralAccount,
    pendingBookingVehicle,
  } = useCustomerPreview();
  const [bookingVehicle] = useState<PreviewVehicle | null>(() => pendingBookingVehicle ?? accountVehicleToPreview(accountVehicles.find((vehicle) => vehicle.is_primary) ?? accountVehicles[0]));
  const [bookingAccountProfile] = useState<CustomerProfileRow | null>(() => accountProfile);
  const [bookingAccountEmail] = useState<string | null>(() => authenticatedEmail);
  const { compact, fontScale, horizontalPadding, short, useFieldColumns: wideFields, width } = useResponsiveLayout();
  const compactHeader = width < 350 || fontScale > 1.4;
  const params = useLocalSearchParams<{ type?: string | string[] }>();
  const initialType = bookingTypeFromParam(params.type);
  const blankForm = useMemo<BookingFormState>(() => ({
    ...EMPTY_BOOKING,
    bookingType: initialType,
    tuningDetails: { ...EMPTY_BOOKING.tuningDetails },
    ...(bookingVehicle ? {
      registration: bookingVehicle.registration,
      vehicleMake: bookingVehicle.make,
      vehicleModel: bookingVehicle.model,
      vehicleYear: String(bookingVehicle.year),
    } : {}),
    ...(bookingAccountEmail || bookingAccountProfile ? {
      email: bookingAccountEmail ?? bookingAccountProfile?.email ?? '',
      firstName: bookingAccountProfile?.first_name ?? '',
      lastName: bookingAccountProfile?.last_name ?? '',
      mobile: bookingAccountProfile?.mobile ?? '',
    } : ephemeralAccount ? {
      email: ephemeralAccount.profile.email,
      firstName: ephemeralAccount.profile.firstName,
      lastName: ephemeralAccount.profile.lastName,
      mobile: ephemeralAccount.profile.mobile,
    } : {}),
  }), [bookingAccountEmail, bookingAccountProfile, bookingVehicle, ephemeralAccount, initialType]);
  const scrollRef = useRef<ScrollView>(null);
  const draftOperationRef = useRef<Promise<unknown>>(Promise.resolve());
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<BookingFormState>(() => blankForm);
  const [errors, setErrors] = useState<BookingErrors>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [errorTitle, setErrorTitle] = useState('Request not submitted');
  const [requestResult, setRequestResult] = useState<BookingRequestResult | null>(null);
  const [requestDraftCleared, setRequestDraftCleared] = useState(true);
  const [idempotencyKey, setIdempotencyKey] = useState(() => randomUUID());
  const [draftReadyFor, setDraftReadyFor] = useState<BookingType | ''>('');
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftConflict, setDraftConflict] = useState<LoadedBookingDraft | null>(null);
  const [draftConflictError, setDraftConflictError] = useState('');
  const maxDate = useMemo(() => maxBookingDate(), []);
  const draftReady = !initialType || draftReadyFor === initialType;
  const secureBookingVehicle = bookingVehicle
    ? accountVehicles.find((vehicle) => vehicle.id === bookingVehicle.id)
      ?? accountVehicles.find((vehicle) => normaliseVehicleRegistration(vehicle.registration) === normaliseVehicleRegistration(bookingVehicle.registration))
    : null;
  const submissionEnabled = privateBookingEnabled && Boolean(secureBookingVehicle);

  useEffect(() => {
    clearPendingBookingVehicle();
  }, [clearPendingBookingVehicle]);

  useEffect(() => {
    let active = true;
    if (!initialType) {
      return () => { active = false; };
    }
    void loadBookingDraft(initialType)
      .then((draft) => {
        if (!active) return;
        setDraftDirty(false);
        if (draft && bookingVehicle && !draftMatchesVehicle(draft.form, bookingVehicle)) {
          setForm(blankForm);
          setDraftConflict(draft);
          setDraftConflictError('');
          setDraftStatus('');
        } else if (draft) {
          setForm(draft.form);
          setDraftStatus(`Draft restored from this device · expires ${formatAustralianDate(draft.expiresAt)}`);
        } else {
          setForm(blankForm);
          setDraftConflict(null);
        }
      })
      .catch(() => {
        if (active) setDraftStatus('Draft storage is unavailable on this device. Your details have not been uploaded.');
      })
      .finally(() => {
        if (active) setDraftReadyFor(initialType);
      });
    return () => { active = false; };
  }, [blankForm, bookingVehicle, initialType]);

  useEffect(() => {
    if (!initialType || !draftReady || !draftDirty) return;
    const timeout = setTimeout(() => {
      const operation = draftOperationRef.current
        .catch(() => undefined)
        .then(() => saveBookingDraft(initialType, form));
      draftOperationRef.current = operation;
      void operation
        .then(() => {
          setDraftStatus(`Draft saved only on this device · expires after ${BOOKING_DRAFT_EXPIRY_DAYS} days`);
        })
        .catch(() => setDraftStatus('Draft could not be saved on this device. Nothing was uploaded.'));
    }, 450);
    return () => clearTimeout(timeout);
  }, [draftDirty, draftReady, form, initialType]);

  useEffect(() => {
    if (!initialType || !draftReady || !draftDirty) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;
      const operation = draftOperationRef.current
        .catch(() => undefined)
        .then(() => saveBookingDraft(initialType, form));
      draftOperationRef.current = operation;
      void operation.catch(() => undefined);
    });
    return () => subscription.remove();
  }, [draftDirty, draftReady, form, initialType]);

  const removeStoredDraft = async () => {
    if (!initialType) return;
    const operation = draftOperationRef.current
      .catch(() => undefined)
      .then(() => clearBookingDraft(initialType));
    draftOperationRef.current = operation;
    await operation;
  };

  const resumeConflictingDraft = () => {
    if (!draftConflict) return;
    setForm(draftConflict.form);
    setDraftStatus(`Draft restored from this device · expires ${formatAustralianDate(draftConflict.expiresAt)}`);
    setDraftConflictError('');
    setDraftConflict(null);
  };

  const startForSelectedVehicle = async () => {
    setDraftDirty(false);
    setDraftConflictError('');
    try {
      await removeStoredDraft();
    } catch {
      setDraftConflictError('The saved draft could not be cleared from this device, so it may still contain the previous details. Nothing was uploaded. Try again or resume that draft.');
      return;
    }
    setForm(blankForm);
    setDraftConflict(null);
    setDraftStatus('Previous saved draft cleared. Your selected preview vehicle is ready.');
    setIdempotencyKey(randomUUID());
  };

  const leaveBooking = async () => {
    if (initialType && draftReady && draftDirty) {
      const operation = draftOperationRef.current
        .catch(() => undefined)
        .then(() => saveBookingDraft(initialType, form));
      draftOperationRef.current = operation;
      try { await operation; } catch { /* Navigation remains available if device storage fails. */ }
    }
    router.back();
  };

  const update: UpdateBooking = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError('');
    setIdempotencyKey(randomUUID());
    setDraftDirty(true);
  };

  const updateTuning: UpdateTuning = (key, value) => {
    setForm((current) => ({
      ...current,
      tuningDetails: { ...current.tuningDetails, [key]: value },
    }));
    setErrors((current) => {
      const errorKey = `tuningDetails.${key}` as keyof BookingErrors;
      if (!current[errorKey] && !current.tuningDetails) return current;
      const next = { ...current };
      delete next[errorKey];
      delete next.tuningDetails;
      return next;
    });
    setFormError('');
    setIdempotencyKey(randomUUID());
    setDraftDirty(true);
  };

  const scrollToTop = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const continueToNextStep = () => {
    const nextErrors = validateBookingStep(form, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setStep((current) => Math.min(5, current + 1));
    scrollToTop();
  };

  const goBack = () => {
    setErrors({});
    setFormError('');
    setStep((current) => Math.max(1, current - 1));
    scrollToTop();
  };

  const submitRequest = async () => {
    if (!submissionEnabled || !secureBookingVehicle) {
      setErrorTitle(privateBookingEnabled ? 'Account vehicle required' : 'Public demo');
      setFormError(privateBookingEnabled
        ? 'Choose a vehicle saved in My Garage before submitting this account booking request.'
        : PUBLIC_DEMO.submissionMessage);
      scrollToTop();
      return;
    }
    const allErrors = {
      ...validateBookingStep(form, 1),
      ...validateBookingStep(form, 2),
      ...validateBookingStep(form, 3),
      ...validateBookingStep(form, 4),
      ...validateBookingStep(form, 5),
    };
    setErrors(allErrors);

    if (Object.keys(allErrors).length > 0) {
      setStep(firstErrorStep(allErrors));
      scrollToTop();
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const result = await createBookingRequest(form, idempotencyKey, secureBookingVehicle.id);
      onBookingStored();
      setDraftDirty(false);
      let draftCleared = true;
      if (initialType) {
        try {
          await removeStoredDraft();
        } catch {
          draftCleared = false;
        }
      }
      setRequestDraftCleared(draftCleared);
      setDraftStatus('');
      setIdempotencyKey(randomUUID());
      setRequestResult(result);
    } catch (error) {
      if (error instanceof BookingApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors);
        setStep(firstErrorStep(error.fieldErrors));
      }
      setErrorTitle('Request not submitted');
      setFormError(
        error instanceof Error
          ? error.message
          : 'Your request could not be submitted. No payment, email or calendar confirmation has occurred.',
      );
      scrollToTop();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && selected) {
      update('preferredDate', localIsoDate(selected));
      update('appointmentPreferenceMode', 'specific');
    }
  };

  const clearDraft = async () => {
    if (!initialType) return;
    setDraftDirty(false);
    try {
      await removeStoredDraft();
    } catch {
      setDraftStatus('Saved draft could not be cleared from this device and may still contain these details. Nothing was uploaded. Try again before leaving a shared device.');
      return;
    }
    setForm(blankForm);
    setErrors({});
    setStep(1);
    setDraftStatus('Saved draft cleared from this device.');
    setIdempotencyKey(randomUUID());
    scrollToTop();
  };

  if (requestResult) {
    return (
      <RequestHandoff
        draftCleared={requestDraftCleared}
        onHome={() => router.replace('/')}
        result={requestResult}
      />
    );
  }

  if (initialType && !draftReady) {
    return (
      <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
        <View accessibilityLabel="Checking for a saved booking draft" accessibilityRole="progressbar" style={styles.draftLoading}>
          <ActivityIndicator color={bookingColors.accent} size="large" />
          <Text style={styles.draftLoadingTitle}>Preparing your booking</Text>
          <Text style={styles.draftLoadingCopy}>Checking this device for an unfinished PSI request…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (draftConflict && bookingVehicle) {
    const savedVehicle = [
      draftConflict.form.vehicleYear,
      draftConflict.form.vehicleMake,
      draftConflict.form.vehicleModel,
    ].filter(Boolean).join(' ') || 'another vehicle';
    const selectedVehicle = `${bookingVehicle.year} ${bookingVehicle.make} ${bookingVehicle.model}`;

    return (
      <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.draftConflictScroll} showsVerticalScrollIndicator={false}>
          <View accessibilityRole="alert" style={styles.draftConflictCard}>
            <Text style={styles.draftLoadingTitle}>Choose which vehicle to continue</Text>
            <Text style={styles.draftLoadingCopy}>
              This device has an unfinished {initialType === 'dyno' ? 'Dyno Tuning' : 'Service & Report'} draft for {savedVehicle}. You just selected {selectedVehicle}.
            </Text>
            <Text style={styles.draftConflictNote}>
              Resuming keeps the saved draft unchanged. Starting for the selected vehicle clears that saved draft only after you choose it.
            </Text>
            {draftConflictError ? <Text style={styles.draftConflictError}>{draftConflictError}</Text> : null}
            <View style={styles.draftConflictActions}>
              <PrimaryButton label={`Resume ${savedVehicle}`} onPress={resumeConflictingDraft} variant="outline" />
              <PrimaryButton label={`Start for ${selectedVehicle}`} onPress={() => void startForSelectedVehicle()} />
              <PrimaryButton label="Go back" onPress={() => void leaveBooking()} variant="outline" />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <View style={[styles.topBar, compact && styles.topBarCompact, { paddingHorizontal: horizontalPadding }]}>
        <Pressable
          accessibilityLabel="Back to PSI home"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => void leaveBooking()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text maxFontSizeMultiplier={1.3} style={styles.backArrow}>←</Text>
          <Text maxFontSizeMultiplier={2} style={styles.backLabel}>Back</Text>
        </Pressable>
        <View style={styles.topBarBrand}>
          <Image
            accessibilityLabel="PSI Performance Garage"
            resizeMode="contain"
            source={require('../../assets/images/psi-logo.png')}
            style={[styles.topBarLogo, compactHeader && styles.topBarLogoCompact]}
          />
          <Text maxFontSizeMultiplier={2} style={styles.topBarCopy}>Secure booking</Text>
        </View>
      </View>

      <Progress step={step} onSelect={(selectedStep) => {
        setStep(selectedStep);
        setErrors({});
        setFormError('');
      }} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.formScroll,
            short && styles.formScrollShort,
            { paddingHorizontal: horizontalPadding },
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formInner}>
            <View accessibilityRole="alert" style={styles.demoBanner}>
              <Text style={styles.demoBannerTitle}>{privateBookingEnabled ? 'Private account booking' : PUBLIC_DEMO.label}</Text>
              <Text style={styles.demoBannerCopy}>{privateBookingEnabled
                ? 'Approved account requests save privately to PSI for workshop review. No payment, confirmed date, email or calendar event is created at submission.'
                : PUBLIC_DEMO.notice}</Text>
            </View>
            {formError ? (
              <View accessibilityRole="alert" style={styles.alert}>
                <Text style={styles.alertTitle}>{errorTitle}</Text>
                <Text style={styles.alertCopy}>{formError}</Text>
                <Text style={styles.alertAssurance}>This screen has not confirmed a payment, email, calendar event or booking date.</Text>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(contact.phoneUrl)}>
                  <Text style={styles.alertLink}>Call {contact.phoneDisplay}</Text>
                </Pressable>
              </View>
            ) : null}

            <View accessibilityLabel="Unfinished booking draft status" style={styles.draftCard}>
              <View style={styles.draftCopyWrap}>
                <Text style={styles.draftTitle}>Private device draft</Text>
                <Text style={styles.draftCopy}>
                  {draftStatus || `Unfinished details stay in this app’s local device storage for ${BOOKING_DRAFT_EXPIRY_DAYS} days and are never submitted automatically. Device backups may retain them; clear the draft on a shared device.`}
                </Text>
              </View>
              <Pressable accessibilityRole="button" hitSlop={10} onPress={() => void clearDraft()} style={({ pressed }) => [styles.draftClear, pressed && styles.pressed]}>
                <Text style={styles.draftClearText}>Clear saved draft</Text>
              </Pressable>
            </View>

            {step === 1 ? (
              <JobStep errors={errors} form={form} onChooseBooking={() => router.replace('/')} update={update} updateTuning={updateTuning} />
            ) : null}
            {step === 2 ? <VehicleStep errors={errors} form={form} update={update} wide={wideFields} /> : null}
            {step === 3 ? (
              <DetailsStep
                errors={errors}
                form={form}
                onAccount={() => router.push('/account')}
                update={update}
                wide={wideFields}
              />
            ) : null}
            {step === 4 ? (
              <DateStep
                errors={errors}
                form={form}
                maxDate={maxDate}
                onDateChange={handleDateChange}
                setShowDatePicker={setShowDatePicker}
                showDatePicker={showDatePicker}
                update={update}
              />
            ) : null}
            {step === 5 ? (
              <ReviewStep errors={errors} form={form} onOpenPrivacy={() => router.push('/privacy')} update={update} />
            ) : null}

            <View style={[styles.actions, wideFields && step > 1 && styles.actionsWide]}>
              {step > 1 ? (
                <PrimaryButton
                  label="Back"
                  onPress={goBack}
                  style={wideFields ? styles.actionButtonWide : undefined}
                  variant="outline"
                />
              ) : null}
              {step < 5 ? (
                <PrimaryButton
                  label="Continue →"
                  onPress={continueToNextStep}
                  style={wideFields && step > 1 ? styles.actionButtonWide : undefined}
                />
              ) : (
                <>
                  {privateBookingEnabled && !submissionEnabled ? (
                    <PrimaryButton
                      label="Choose saved vehicle first"
                      onPress={() => router.push('/garage')}
                      style={wideFields && step > 1 ? styles.actionButtonWide : undefined}
                      variant="outline"
                    />
                  ) : null}
                  <PrimaryButton
                    disabled={!submissionEnabled}
                    label={submissionEnabled ? 'Submit request for PSI review' : privateBookingEnabled ? 'Choose a saved vehicle first' : 'Demo only · Submission disabled'}
                    loading={submitting}
                    onPress={() => void submitRequest()}
                    style={wideFields && step > 1 ? styles.actionButtonWide : undefined}
                  />
                </>
              )}
            </View>
            <Text style={styles.requestNote}>
              {step === 5
                ? submissionEnabled
                  ? 'This private request saves to PSI for review. It does not send email, take payment, confirm a date or create a calendar event yet.'
                  : 'This public demo does not submit details, send email, take payment or create a calendar event.'
                : 'Every requested date and before/after-hours arrangement remains pending until PSI checks workshop capacity.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Progress({ step, onSelect }: { step: number; onSelect: (step: number) => void }) {
  const { compact, largeText } = useResponsiveLayout();

  return (
    <View accessibilityLabel={`Booking step ${step} of 5`} accessibilityRole="progressbar" style={[styles.progress, compact && styles.progressCompact]}>
      {STEP_LABELS.map((label, index) => {
        const number = index + 1;
        const complete = number < step;
        const active = number === step;
        return (
          <Pressable
            accessibilityLabel={`Step ${number} of 5, ${label}${active ? ', current step' : complete ? ', completed' : ''}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: number > step }}
            disabled={number > step}
            key={label}
            onPress={() => onSelect(number)}
            style={styles.progressItem}
          >
            <View style={[styles.progressNumber, (complete || active) && styles.progressNumberActive]}>
              <Text maxFontSizeMultiplier={1.35} style={[styles.progressNumberText, (complete || active) && styles.progressNumberTextActive]}>
                {complete ? '✓' : number}
              </Text>
            </View>
            <Text
              maxFontSizeMultiplier={2}
              numberOfLines={2}
              style={[styles.progressLabel, active && styles.progressLabelActive]}
            >
              {compact || largeText ? COMPACT_STEP_LABELS[index] : label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  const { compact, shortLandscape } = useResponsiveLayout();

  return (
    <View style={styles.stepHeading}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text maxFontSizeMultiplier={2} style={[styles.stepTitle, (compact || shortLandscape) && styles.stepTitleCompact]}>{title}</Text>
      <Text style={styles.stepIntro}>{copy}</Text>
    </View>
  );
}

function JobStep({
  form,
  errors,
  update,
  updateTuning,
  onChooseBooking,
}: {
  form: BookingFormState;
  errors: BookingErrors;
  update: UpdateBooking;
  updateTuning: UpdateTuning;
  onChooseBooking: () => void;
}) {
  const purpose = form.bookingType ? BOOKING_PURPOSES[form.bookingType] : null;
  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="Your booking type is carried through from the home screen, so you only choose it once. Tell PSI what matters to you and what you want from the vehicle."
        eyebrow="Step 01 · Job"
        title={purpose?.label || 'Choose a booking type.'}
      />
      <View style={styles.personalPromise}>
        <Text style={styles.personalPromiseTitle}>Your vehicle. Your goals.</Text>
        <Text style={styles.personalPromiseCopy}>
          One-stop workshop capability with individual attention. PSI reviews every request personally so the plan
          protects the car today and supports where you want to take it.
        </Text>
      </View>
      {purpose ? (
        <View accessibilityLabel={`${purpose.label}. ${purpose.priceGuide}. Available ${purpose.eligibleDays}.`} style={styles.jobSelectedCard}>
          <Text style={styles.jobSelectedKicker}>Selected on PSI home</Text>
          <Text style={styles.jobSelectedTitle}>{purpose.label}</Text>
          <Text style={styles.jobSelectedCopy}>{purpose.priceGuide} · Requests available {purpose.eligibleDays}</Text>
          <Text style={styles.jobSelectedDeposit}>
            {displayMoney(purpose.depositAmountCents)} deposit only after PSI approves a date
          </Text>
        </View>
      ) : (
        <View style={styles.missingTypeCard}>
          <Text style={styles.missingTypeTitle}>Booking type needed</Text>
          <Text style={styles.missingTypeCopy}>Return to the home screen and choose Service & Report or Dyno Tuning once.</Text>
          <PrimaryButton label="Choose on PSI home" onPress={onChooseBooking} variant="outline" />
        </View>
      )}
      {errors.bookingType ? <Text style={styles.error}>{errors.bookingType}</Text> : null}

      <Field error={errors.requestDetails} label="What exactly are you after?">
        <FormInput
          error={errors.requestDetails}
          maxLength={1200}
          multiline
          numberOfLines={6}
          onChangeText={(value) => update('requestDetails', value)}
          placeholder="Tell us the symptoms, work required, modifications, goals or result you want."
          style={styles.notesInput}
          textAlignVertical="top"
          value={form.requestDetails}
        />
        <Text style={styles.characterCount}>{form.requestDetails.length}/1200</Text>
      </Field>

      {form.bookingType === 'dyno' ? (
        <View style={styles.setupConfidenceSection}>
          <Field error={errors.setupConfidence} label="How well do you know the vehicle setup?">
            <View accessibilityRole="radiogroup" style={styles.compactChoices}>
              <ChoiceCard
                detail="I can complete the technical setup questionnaire so PSI can prepare safely."
                onPress={() => update('setupConfidence', 'known')}
                selected={form.setupConfidence === 'known'}
                title="I know my setup"
              />
              <ChoiceCard
                detail="I’m not certain what is fitted. PSI can assess the setup before tuning; inspection time and any work are subject to confirmation."
                onPress={() => {
                  update('setupConfidence', 'psi_inspection');
                  update('tuningDetails', { ...EMPTY_BOOKING.tuningDetails });
                }}
                selected={form.setupConfidence === 'psi_inspection'}
                title="I’m not sure. Can PSI inspect it?"
              />
            </View>
          </Field>
          {form.setupConfidence === 'known' ? (
            <TuningSetup details={form.tuningDetails} errors={errors} update={updateTuning} />
          ) : null}
          {form.setupConfidence === 'psi_inspection' ? (
            <View style={styles.inspectionCard}>
              <Text style={styles.inspectionTitle}>PSI inspection requested</Text>
              <Text style={styles.inspectionCopy}>
                The full technical questionnaire is not required. Add anything you do know in “What exactly are you after?” and PSI will discuss the inspection before confirming work or cost.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function TuningSetup({
  details,
  errors,
  update,
}: {
  details: TuningDetails;
  errors: BookingErrors;
  update: UpdateTuning;
}) {
  const transmissionOptions = details.transmissionType === 'manual'
    ? MANUAL_SETUP_OPTIONS
    : AUTOMATIC_SETUP_OPTIONS;

  const updateTransmissionType = (value: Exclude<TuningDetails['transmissionType'], ''>) => {
    const validSetups = value === 'manual' ? MANUAL_SETUP_OPTIONS : AUTOMATIC_SETUP_OPTIONS;
    update('transmissionType', value);
    if (details.transmissionSetup && !validSetups.some((option) => option.value === details.transmissionSetup)) {
      update('transmissionSetup', '');
      update('transmissionDetails', '');
    }
  };

  return (
    <View style={styles.tuningSetup}>
      <View style={styles.tuningIntro}>
        <Text style={styles.tuningKicker}>Dyno preparation</Text>
        <Text style={styles.tuningTitle}>Tell us how the car is set up.</Text>
        <Text style={styles.tuningCopy}>
          These details help PSI plan the calibration safely. Choose what you know and use “Not sure” where available.
        </Text>
      </View>

      <TuningSection index="01" title="Engine">
        <SelectField
          error={errors['tuningDetails.engineState']}
          label="Engine condition"
          onChange={(value) => update('engineState', value)}
          options={ENGINE_OPTIONS}
          placeholder="Stock or modified?"
          value={details.engineState}
        />
        {details.engineState === 'modified' ? (
          <Field error={errors['tuningDetails.engineModifications']} label="Engine modifications">
            <FormInput
              error={errors['tuningDetails.engineModifications']}
              maxLength={1000}
              multiline
              onChangeText={(value) => update('engineModifications', value)}
              placeholder="List internal engine work, forced induction, boost, heads, manifold and supporting modifications."
              style={styles.tuningNotesInput}
              textAlignVertical="top"
              value={details.engineModifications}
            />
          </Field>
        ) : null}
      </TuningSection>

      <TuningSection index="02" title="Transmission & differential">
        <SelectField
          error={errors['tuningDetails.transmissionType']}
          label="Transmission type"
          onChange={updateTransmissionType}
          options={TRANSMISSION_TYPE_OPTIONS}
          placeholder="Automatic or manual?"
          value={details.transmissionType}
        />
        {details.transmissionType ? (
          <SelectField
            error={errors['tuningDetails.transmissionSetup']}
            label="Transmission setup"
            onChange={(value) => update('transmissionSetup', value)}
            options={transmissionOptions}
            placeholder="Select fitted equipment"
            value={details.transmissionSetup}
          />
        ) : null}
        {details.transmissionSetup && details.transmissionSetup !== 'stock' ? (
          <Field error={errors['tuningDetails.transmissionDetails']} label="Transmission details">
            <FormInput
              error={errors['tuningDetails.transmissionDetails']}
              maxLength={600}
              multiline
              onChangeText={(value) => update('transmissionDetails', value)}
              placeholder="Brand, model, converter or stall speed, cooler, clutch, build details and anything else fitted."
              style={styles.tuningNotesInput}
              textAlignVertical="top"
              value={details.transmissionDetails}
            />
          </Field>
        ) : null}
        <SelectField
          error={errors['tuningDetails.differentialType']}
          label="Differential"
          onChange={(value) => update('differentialType', value)}
          options={DIFFERENTIAL_OPTIONS}
          placeholder="Stock, Truetrac, Wavetrac or other?"
          value={details.differentialType}
        />
        <Field error={errors['tuningDetails.differentialGearRatio']} label="Differential gear ratio">
          <FormInput
            autoCapitalize="none"
            error={errors['tuningDetails.differentialGearRatio']}
            maxLength={30}
            onChangeText={(value) => update('differentialGearRatio', value)}
            placeholder="e.g. 3.45:1 or unknown"
            value={details.differentialGearRatio}
          />
        </Field>
        {details.differentialType === 'other' ? (
          <Field error={errors['tuningDetails.differentialDetails']} label="Differential details">
            <FormInput
              error={errors['tuningDetails.differentialDetails']}
              maxLength={500}
              multiline
              onChangeText={(value) => update('differentialDetails', value)}
              placeholder="Tell PSI what centre or differential is fitted."
              style={styles.tuningNotesInput}
              textAlignVertical="top"
              value={details.differentialDetails}
            />
          </Field>
        ) : null}
      </TuningSection>

      <TuningSection index="03" title="Fuel & intake">
        <SelectField
          error={errors['tuningDetails.fuelPumpType']}
          label="Fuel pump"
          onChange={(value) => update('fuelPumpType', value)}
          options={COMPONENT_OPTIONS}
          placeholder="Select fuel pump setup"
          value={details.fuelPumpType}
        />
        {details.fuelPumpType === 'upgraded' ? (
          <Field error={errors['tuningDetails.fuelPumpDetails']} label="Fuel pump details">
            <FormInput
              error={errors['tuningDetails.fuelPumpDetails']}
              maxLength={400}
              onChangeText={(value) => update('fuelPumpDetails', value)}
              placeholder="Brand, model, quantity and controller if fitted"
              value={details.fuelPumpDetails}
            />
          </Field>
        ) : null}
        <SelectField
          error={errors['tuningDetails.injectorType']}
          label="Injectors"
          onChange={(value) => update('injectorType', value)}
          options={COMPONENT_OPTIONS}
          placeholder="Select injector setup"
          value={details.injectorType}
        />
        {details.injectorType === 'upgraded' ? (
          <Field error={errors['tuningDetails.injectorDetails']} label="Injector details">
            <FormInput
              error={errors['tuningDetails.injectorDetails']}
              maxLength={400}
              onChangeText={(value) => update('injectorDetails', value)}
              placeholder="Exact brand, model and flow rate"
              value={details.injectorDetails}
            />
          </Field>
        ) : null}
        <SelectField
          error={errors['tuningDetails.fuelType']}
          label="Fuel to tune"
          onChange={(value) => update('fuelType', value)}
          options={FUEL_OPTIONS}
          placeholder="Select fuel"
          value={details.fuelType}
        />
        {details.fuelType === 'other' ? (
          <Field error={errors['tuningDetails.fuelTypeDetails']} label="Fuel details">
            <FormInput
              error={errors['tuningDetails.fuelTypeDetails']}
              maxLength={300}
              onChangeText={(value) => update('fuelTypeDetails', value)}
              placeholder="Enter the exact fuel or blend"
              value={details.fuelTypeDetails}
            />
          </Field>
        ) : null}
        <SelectField
          error={errors['tuningDetails.intakeType']}
          label="Intake"
          onChange={(value) => update('intakeType', value)}
          options={INTAKE_OPTIONS}
          placeholder="Stock or upgraded?"
          value={details.intakeType}
        />
        {details.intakeType === 'upgraded' ? (
          <Field error={errors['tuningDetails.intakeDetails']} label="Intake details">
            <FormInput
              error={errors['tuningDetails.intakeDetails']}
              maxLength={500}
              onChangeText={(value) => update('intakeDetails', value)}
              placeholder="Brand, size and exact intake modifications"
              value={details.intakeDetails}
            />
          </Field>
        ) : null}
      </TuningSection>

      <TuningSection index="04" title="Tune history & exhaust">
        <SelectField
          error={errors['tuningDetails.previouslyTuned']}
          label="Previously tuned?"
          onChange={(value) => update('previouslyTuned', value)}
          options={HISTORY_OPTIONS}
          placeholder="Select tune history"
          value={details.previouslyTuned}
        />
        {details.previouslyTuned === 'yes' ? (
          <Field error={errors['tuningDetails.previousTuner']} label="Who tuned it?">
            <FormInput
              autoCapitalize="words"
              error={errors['tuningDetails.previousTuner']}
              maxLength={200}
              onChangeText={(value) => update('previousTuner', value)}
              placeholder="Tuner or workshop name"
              value={details.previousTuner}
            />
          </Field>
        ) : null}
        <SelectField
          error={errors['tuningDetails.exhaustType']}
          label="Exhaust type"
          onChange={(value) => update('exhaustType', value)}
          options={EXHAUST_OPTIONS}
          placeholder="Select exhaust setup"
          value={details.exhaustType}
        />
        <SelectField
          error={errors['tuningDetails.exhaustSize']}
          label="Exhaust size"
          onChange={(value) => update('exhaustSize', value)}
          options={EXHAUST_SIZE_OPTIONS}
          placeholder="Select exhaust size"
          value={details.exhaustSize}
        />
        <SelectField
          error={errors['tuningDetails.headerExtractorDownpipeSize']}
          label="Header / extractor / downpipe size"
          onChange={(value) => update('headerExtractorDownpipeSize', value)}
          options={HEADER_EXTRACTOR_DOWNPIPE_SIZE_OPTIONS}
          placeholder="Select header, extractor or downpipe size"
          value={details.headerExtractorDownpipeSize}
        />
        <SelectField
          error={errors['tuningDetails.varexControlled']}
          label="Varex control"
          onChange={(value) => update('varexControlled', value)}
          options={VAREX_OPTIONS}
          placeholder="Is Varex control fitted?"
          value={details.varexControlled}
        />
        {details.exhaustType && details.exhaustType !== 'stock' ? (
          <Field error={errors['tuningDetails.exhaustDetails']} label="Exhaust modifications">
            <FormInput
              error={errors['tuningDetails.exhaustDetails']}
              maxLength={800}
              multiline
              onChangeText={(value) => update('exhaustDetails', value)}
              placeholder="Headers, extractors, downpipe, cats, brand, mufflers, valves and any other exhaust work."
              style={styles.tuningNotesInput}
              textAlignVertical="top"
              value={details.exhaustDetails}
            />
          </Field>
        ) : null}
      </TuningSection>

      <TuningSection index="05" title="Camshaft">
        <SelectField
          error={errors['tuningDetails.camshaftType']}
          label="Camshaft setup"
          onChange={(value) => update('camshaftType', value)}
          options={CAMSHAFT_OPTIONS}
          placeholder="Stock, upgraded or unknown?"
          value={details.camshaftType}
        />
        {details.camshaftType === 'upgraded' ? (
          <Field error={errors['tuningDetails.camshaftDetails']} label="Camshaft code or specifications">
            <FormInput
              autoCapitalize="characters"
              error={errors['tuningDetails.camshaftDetails']}
              maxLength={600}
              multiline
              onChangeText={(value) => update('camshaftDetails', value)}
              placeholder="Part number, grind/code, duration, lift, LSA or all specifications available."
              style={styles.tuningNotesInput}
              textAlignVertical="top"
              value={details.camshaftDetails}
            />
          </Field>
        ) : null}
      </TuningSection>
    </View>
  );
}

function TuningSection({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  const { compact } = useResponsiveLayout();

  return (
    <View style={[styles.tuningSection, compact && styles.tuningSectionCompact]}>
      <View style={styles.tuningSectionHeading}>
        <View style={styles.tuningSectionIndex}><Text maxFontSizeMultiplier={1.4} style={styles.tuningSectionIndexText}>{index}</Text></View>
        <Text style={styles.tuningSectionTitle}>{title}</Text>
      </View>
      <View style={styles.tuningFields}>{children}</View>
    </View>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  placeholder,
  error,
  onChange,
}: {
  label: string;
  value: T | '';
  options: SelectOption<T>[];
  placeholder: string;
  error?: string;
  onChange: (value: T) => void;
}) {
  const [visible, setVisible] = useState(false);
  const { compact, fontScale, shortLandscape, width } = useResponsiveLayout();
  const wideModal = width >= 600 && !shortLandscape && fontScale <= 1.3;
  const tightModal = compact || shortLandscape;
  const selected = options.find((option) => option.value === value);

  return (
    <Field error={error} label={label}>
      <Pressable
        accessibilityHint={`Opens ${label.toLowerCase()} options`}
        accessibilityLabel={`${label}, ${selected?.label || 'not selected'}`}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.tuningSelect, error && styles.tuningSelectError, pressed && styles.pressed]}
      >
        <Text style={[styles.tuningSelectText, !selected && styles.tuningSelectPlaceholder]}>{selected?.label || placeholder}</Text>
        <Text style={styles.tuningSelectChevron}>⌄</Text>
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <View style={styles.tuningModalRoot}>
          <Pressable accessibilityLabel={`Close ${label} options`} accessibilityRole="button" onPress={() => setVisible(false)} style={styles.tuningModalBackdrop} />
          <SafeAreaView
            edges={['top', 'right', 'bottom', 'left']}
            style={[styles.tuningModalSafeArea, tightModal && styles.tuningModalSafeAreaTight]}
          >
            <View accessibilityViewIsModal style={[styles.tuningModalSheet, tightModal && styles.tuningModalSheetTight, wideModal && styles.tuningModalSheetWide]}>
              <View style={styles.tuningModalHeading}>
                <View style={styles.tuningModalHeadingCopy}>
                  <Text style={styles.tuningModalKicker}>Dyno setup</Text>
                  <Text maxFontSizeMultiplier={2} style={styles.tuningModalTitle}>{label}</Text>
                </View>
                <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={12} onPress={() => setVisible(false)}>
                  <Text maxFontSizeMultiplier={1.3} style={styles.tuningModalClose}>×</Text>
                </Pressable>
              </View>
              <ScrollView
                accessibilityRole="radiogroup"
                contentContainerStyle={styles.tuningOptionList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={styles.tuningOptionScroll}
              >
                {options.map((option) => {
                  const active = option.value === value;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      aria-checked={active}
                      key={option.value}
                      onPress={() => {
                        onChange(option.value);
                        setVisible(false);
                      }}
                      style={({ pressed }) => [styles.tuningOption, active && styles.tuningOptionActive, pressed && styles.pressed]}
                    >
                      <Text style={[styles.tuningOptionText, active && styles.tuningOptionTextActive]}>{option.label}</Text>
                      <View style={[styles.tuningOptionRadio, active && styles.tuningOptionRadioActive]}>
                        {active ? <View style={styles.tuningOptionDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </Field>
  );
}

function VehicleStep({
  form,
  errors,
  update,
  wide,
}: {
  form: BookingFormState;
  errors: BookingErrors;
  update: UpdateBooking;
  wide: boolean;
}) {
  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="Accurate vehicle details help PSI prepare for the request before confirming your date."
        eyebrow="Step 02 · Vehicle"
        title="Tell us about the car."
      />
      <View style={styles.fields}>
        <View style={[styles.fieldRow, wide && styles.fieldRowWide]}>
          <View style={styles.fieldCell}>
            <Field error={errors.vehicleMake} label="Make">
              <FormInput
                autoCapitalize="words"
                error={errors.vehicleMake}
                maxLength={60}
                onChangeText={(value) => update('vehicleMake', value)}
                placeholder="e.g. Holden"
                value={form.vehicleMake}
              />
            </Field>
          </View>
          <View style={styles.fieldCell}>
            <Field error={errors.vehicleModel} label="Model">
              <FormInput
                autoCapitalize="words"
                error={errors.vehicleModel}
                maxLength={80}
                onChangeText={(value) => update('vehicleModel', value)}
                placeholder="e.g. VF SS"
                value={form.vehicleModel}
              />
            </Field>
          </View>
        </View>
        <View style={[styles.fieldRow, wide && styles.fieldRowWide]}>
          <View style={styles.fieldCell}>
            <Field error={errors.vehicleYear} label="Year">
              <FormInput
                error={errors.vehicleYear}
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={(value) => update('vehicleYear', value.replace(/\D/g, ''))}
                placeholder="2017"
                value={form.vehicleYear}
              />
            </Field>
          </View>
          <View style={styles.fieldCell}>
            <Field error={errors.registration} hint="Letters & numbers" label="Registration">
              <FormInput
                autoCapitalize="characters"
                error={errors.registration}
                maxLength={20}
                onChangeText={(value) => update('registration', value.toUpperCase())}
                placeholder="ABC123"
                value={form.registration}
              />
            </Field>
          </View>
        </View>
        <Field error={errors.vin} hint="Optional · 17 characters" label="VIN">
          <FormInput
            autoCapitalize="characters"
            error={errors.vin}
            maxLength={17}
            onChangeText={(value) => update('vin', value.replace(/[^A-HJ-NPR-Za-hj-npr-z0-9]/g, '').toUpperCase())}
            placeholder="17-character vehicle identification number"
            value={form.vin}
          />
        </Field>
      </View>
    </View>
  );
}

function DetailsStep({
  form,
  errors,
  update,
  wide,
  onAccount,
}: {
  form: BookingFormState;
  errors: BookingErrors;
  update: UpdateBooking;
  wide: boolean;
  onAccount: () => void;
}) {
  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="PSI will use these contact details for booking communication once the request is securely submitted."
        eyebrow="Step 03 · Details"
        title="Who is the booking for?"
      />
      <Pressable accessibilityRole="button" onPress={onAccount} style={({ pressed }) => [styles.accountNotice, pressed && styles.pressed]}>
        <View style={styles.accountNoticeCopyWrap}>
          <Text style={styles.accountNoticeTitle}>Have a PSI account?</Text>
          <Text style={styles.accountNoticeCopy}>Account sign-in is being prepared with a managed provider.</Text>
        </View>
        <Text style={styles.accountNoticeArrow}>→</Text>
      </Pressable>
      <View style={styles.fields}>
        <View style={[styles.fieldRow, wide && styles.fieldRowWide]}>
          <View style={styles.fieldCell}>
            <Field error={errors.firstName} label="First name">
              <FormInput
                autoCapitalize="words"
                autoComplete="given-name"
                error={errors.firstName}
                maxLength={60}
                onChangeText={(value) => update('firstName', value)}
                value={form.firstName}
              />
            </Field>
          </View>
          <View style={styles.fieldCell}>
            <Field error={errors.lastName} label="Last name">
              <FormInput
                autoCapitalize="words"
                autoComplete="family-name"
                error={errors.lastName}
                maxLength={60}
                onChangeText={(value) => update('lastName', value)}
                value={form.lastName}
              />
            </Field>
          </View>
        </View>
        <View style={[styles.fieldRow, wide && styles.fieldRowWide]}>
          <View style={styles.fieldCell}>
            <Field error={errors.email} hint="Receipt & updates" label="Email">
              <FormInput
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email}
                keyboardType="email-address"
                maxLength={254}
                onChangeText={(value) => update('email', value)}
                placeholder="you@example.com"
                value={form.email}
              />
            </Field>
          </View>
          <View style={styles.fieldCell}>
            <Field error={errors.mobile} hint="8–15 digits" label="Mobile">
              <FormInput
                autoComplete="tel"
                error={errors.mobile}
                keyboardType="phone-pad"
                maxLength={32}
                onChangeText={(value) => update('mobile', value)}
                placeholder="04xx xxx xxx"
                value={form.mobile}
              />
            </Field>
          </View>
        </View>
      </View>
    </View>
  );
}

function DateStep({
  form,
  errors,
  update,
  showDatePicker,
  setShowDatePicker,
  maxDate,
  onDateChange,
}: {
  form: BookingFormState;
  errors: BookingErrors;
  update: UpdateBooking;
  showDatePicker: boolean;
  setShowDatePicker: (visible: boolean) => void;
  maxDate: Date;
  onDateChange: (event: DateTimePickerEvent, selected?: Date) => void;
}) {
  const { compact, fontScale, shortLandscape, width } = useResponsiveLayout();
  const useInlineCalendar = width >= 390 && !shortLandscape && fontScale <= 1.3;
  const selectedDate = form.preferredDate ? dateFromIso(form.preferredDate) : new Date();
  const scheduleCopy = form.bookingType === 'dyno'
    ? 'Dyno requests: Monday, Wednesday and Thursday.'
    : 'Service requests: Monday to Friday.';
  const selectedDateEligible = form.preferredDate && isEligibleBookingDate(form.bookingType, form.preferredDate);

  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="Request an eligible date or tell PSI you are flexible. Other bookings stay private and PSI personally checks workshop capacity before requesting payment."
        eyebrow="Step 04 · Date"
        title="Request a date."
      />
      <View style={styles.datePrivacyCard}>
        <Text style={styles.datePrivacyTitle}>Preference, not a confirmed booking</Text>
        <Text style={styles.datePrivacyCopy}>
          {scheduleCopy} If your first choice is unavailable, PSI will contact you to arrange another suitable date. Workshop work can carry over or change unexpectedly.
        </Text>
      </View>
      <View style={styles.fields}>
        <Field label="Date preference">
          <View accessibilityRole="radiogroup" style={styles.compactChoices}>
            <ChoiceCard
              detail="Choose your preferred eligible day below."
              onPress={() => update('appointmentPreferenceMode', 'specific')}
              selected={form.appointmentPreferenceMode === 'specific'}
              title="I have a preferred date"
            />
            <ChoiceCard
              detail="PSI can contact me with a suitable date."
              onPress={() => {
                update('appointmentPreferenceMode', 'flexible');
                setShowDatePicker(false);
              }}
              selected={form.appointmentPreferenceMode === 'flexible'}
              title="I’m flexible"
            />
          </View>
        </Field>

        {form.appointmentPreferenceMode === 'specific' ? (
          <Field error={errors.preferredDate} label="Preferred booking date">
            <Pressable
              accessibilityLabel={`Preferred booking date, ${displayDate(form.preferredDate)}`}
              accessibilityRole="button"
              onPress={() => setShowDatePicker(true)}
              style={({ pressed }) => [styles.dateButton, errors.preferredDate && styles.dateButtonError, pressed && styles.pressed]}
            >
              <Text style={[styles.dateText, !form.preferredDate && styles.datePlaceholder]}>{displayDate(form.preferredDate)}</Text>
              <Text style={styles.dateIcon}>▦</Text>
            </Pressable>
            {form.preferredDate ? (
              <Text style={[styles.dateEligibility, selectedDateEligible ? styles.dateEligibilityGood : styles.dateEligibilityBad]}>
                {selectedDateEligible ? `Eligible request day · ${scheduleCopy}` : scheduleCopy}
              </Text>
            ) : null}
            {showDatePicker ? (
              <View style={[styles.datePickerWrap, compact && styles.datePickerWrapCompact]}>
                <DateTimePicker
                  accentColor={bookingColors.accent}
                  display={Platform.OS === 'ios' ? (useInlineCalendar ? 'inline' : 'spinner') : 'calendar'}
                  maximumDate={maxDate}
                  minimumDate={new Date()}
                  mode="date"
                  onChange={onDateChange}
                  themeVariant="dark"
                  timeZoneName="Australia/Melbourne"
                  value={selectedDate}
                  style={styles.datePicker}
                />
                {Platform.OS === 'ios' ? (
                  <Pressable accessibilityRole="button" onPress={() => setShowDatePicker(false)} style={styles.dateDone}>
                    <Text style={styles.dateDoneText}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </Field>
        ) : null}

        <Field label="Drop-off preference">
          <View accessibilityRole="radiogroup" style={styles.compactChoices}>
            {ARRIVAL_OPTIONS.map((option) => (
              <ChoiceCard
                detail={option.detail}
                key={option.value}
                onPress={() => update('arrivalArrangement', option.value)}
                selected={form.arrivalArrangement === option.value}
                title={option.label}
              />
            ))}
          </View>
        </Field>

        <ToggleRow
          checked={form.afterHoursCollection}
          copy="Please note that after-hours collection is possible. PSI will confirm the arrangement; it is not guaranteed automatically."
          label="Request after-hours collection"
          onPress={() => update('afterHoursCollection', !form.afterHoursCollection)}
        />
        <ToggleRow
          checked={form.notifyEarlierAvailability}
          copy="This alerts PSI staff only. The app will never automatically offer or move your booking. PSI will contact you if a suitable earlier time appears."
          label="Tell me if an earlier time becomes available"
          onPress={() => update('notifyEarlierAvailability', !form.notifyEarlierAvailability)}
        />
      </View>
    </View>
  );
}

function ReviewStep({
  form,
  errors,
  onOpenPrivacy,
  update,
}: {
  form: BookingFormState;
  errors: BookingErrors;
  onOpenPrivacy: () => void;
  update: UpdateBooking;
}) {
  const { compact, largeText, width } = useResponsiveLayout();
  const stackSummary = compact || largeText;
  const stackDeposit = stackSummary || width < 480;
  const purpose = form.bookingType ? BOOKING_PURPOSES[form.bookingType] : null;
  const depositAmountCents = depositAmountForBookingType(form.bookingType);
  const depositDisplay = depositAmountCents === null ? 'Not selected' : displayMoney(depositAmountCents);
  const preferenceDisplay = form.appointmentPreferenceMode === 'flexible' ? 'I’m flexible' : displayDate(form.preferredDate);
  const depositTermsCopy = `I understand PSI will review my request before confirming a date or sending the ${depositDisplay} deposit link. If I later move or cancel an approved booking, any amount retained will be limited to PSI's reasonable costs and reserved workshop capacity, with the balance refunded where applicable. My Australian Consumer Law rights are not limited.`;
  const arrivalLabel = ARRIVAL_OPTIONS.find((option) => option.value === form.arrivalArrangement)?.label ?? 'Not selected';
  const tuning = form.tuningDetails;
  const transmissionSetups = tuning.transmissionType === 'manual' ? MANUAL_SETUP_OPTIONS : AUTOMATIC_SETUP_OPTIONS;
  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="Review your request before sending it to PSI. No payment is taken at this stage."
        eyebrow="Step 05 · Review"
        title="Request first. Pay after approval."
      />

      <View style={[styles.summaryCard, stackSummary && styles.summaryCardCompact]}>
        <View style={[styles.summaryTop, stackSummary && styles.summaryTopStacked]}>
          <Text style={styles.summaryKicker}>Booking summary</Text>
          <Text style={styles.summaryReference}>Pending staff review</Text>
        </View>
        <SummaryRow label="Work" value={purpose?.label || 'Not selected'} secondary={purpose?.priceGuide} />
        <SummaryRow
          label="Vehicle"
          value={`${form.vehicleYear} ${form.vehicleMake} ${form.vehicleModel}`.trim()}
          secondary={`Registration ${form.registration.toUpperCase()}${form.vin.trim() ? ` · VIN ${form.vin.trim().toUpperCase()}` : ''}`}
        />
        <SummaryRow label="Date preference" value={preferenceDisplay} secondary="PSI confirms availability personally" />
        <SummaryRow label="Arrival & collection" value={arrivalLabel} secondary={form.afterHoursCollection ? 'After-hours collection requested' : 'Standard collection requested'} />
        <SummaryRow label="Earlier opening" value={form.notifyEarlierAvailability ? 'Tell PSI staff if something earlier becomes available' : 'No earlier-opening request'} secondary="PSI never moves or contacts you automatically" />
        <SummaryRow label="Customer" value={`${form.firstName} ${form.lastName}`} secondary={`${form.email} · ${form.mobile}`} />
        {form.bookingType === 'service' ? (
          <SummaryRow label="Future service reminders" value={form.serviceReminderConsent ? 'Opted in to 6- and 12-month messages' : 'Not opted in'} secondary="Can be unsubscribed without signing in" />
        ) : null}
        {form.bookingType === 'dyno' ? (
          <>
            <SummaryRow
              label="Dyno setup path"
              value={form.setupConfidence === 'known' ? 'I know my setup' : 'PSI inspection requested'}
              secondary={form.setupConfidence === 'known' ? 'Technical specification below will be submitted' : 'No hidden tuning questionnaire will be submitted'}
            />
            {form.setupConfidence === 'known' ? (
              <>
                <SummaryRow label="Engine" value={withDetails(selectedOptionLabel(ENGINE_OPTIONS, tuning.engineState), tuning.engineModifications)} />
                <SummaryRow
                  label="Transmission"
                  value={`${selectedOptionLabel(TRANSMISSION_TYPE_OPTIONS, tuning.transmissionType)} · ${selectedOptionLabel(transmissionSetups, tuning.transmissionSetup)}`}
                  secondary={tuning.transmissionDetails || undefined}
                />
                <SummaryRow
                  label="Differential"
                  value={`${selectedOptionLabel(DIFFERENTIAL_OPTIONS, tuning.differentialType)} · ratio ${tuning.differentialGearRatio || 'not supplied'}`}
                  secondary={tuning.differentialDetails || undefined}
                />
                <SummaryRow
                  label="Fuel system"
                  value={`Pump: ${withDetails(selectedOptionLabel(COMPONENT_OPTIONS, tuning.fuelPumpType), tuning.fuelPumpDetails)}`}
                  secondary={`Injectors: ${withDetails(selectedOptionLabel(COMPONENT_OPTIONS, tuning.injectorType), tuning.injectorDetails)} · Fuel: ${withDetails(selectedOptionLabel(FUEL_OPTIONS, tuning.fuelType), tuning.fuelTypeDetails)}`}
                />
                <SummaryRow label="Intake" value={withDetails(selectedOptionLabel(INTAKE_OPTIONS, tuning.intakeType), tuning.intakeDetails)} />
                <SummaryRow label="Previous tune" value={withDetails(selectedOptionLabel(HISTORY_OPTIONS, tuning.previouslyTuned), tuning.previousTuner)} />
                <SummaryRow
                  label="Exhaust"
                  value={`${selectedOptionLabel(EXHAUST_OPTIONS, tuning.exhaustType)} · Exhaust ${selectedOptionLabel(EXHAUST_SIZE_OPTIONS, tuning.exhaustSize)} · Header/extractor/downpipe ${selectedOptionLabel(HEADER_EXTRACTOR_DOWNPIPE_SIZE_OPTIONS, tuning.headerExtractorDownpipeSize)} · ${selectedOptionLabel(VAREX_OPTIONS, tuning.varexControlled)}`}
                  secondary={tuning.exhaustDetails || undefined}
                />
                <SummaryRow label="Camshaft" value={withDetails(selectedOptionLabel(CAMSHAFT_OPTIONS, tuning.camshaftType), tuning.camshaftDetails)} />
              </>
            ) : null}
          </>
        ) : null}
        <View style={[styles.requestSummary, stackSummary && styles.summaryRowStacked]}>
          <Text style={[styles.summaryLabel, stackSummary && styles.summaryLabelStacked]}>Your request</Text>
          <Text style={styles.requestSummaryText}>{form.requestDetails}</Text>
        </View>
        <View style={[styles.depositTotal, stackDeposit && styles.depositTotalStacked]}>
          <View style={[styles.depositCopy, stackDeposit && styles.depositCopyStacked]}>
            <Text style={styles.depositLabel}>Deposit after date approval</Text>
            <Text style={styles.depositCurrency}>AUD · Nothing payable with this request</Text>
          </View>
          <Text
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.5}
            minimumFontScale={0.75}
            numberOfLines={1}
            style={[styles.depositValue, stackDeposit && styles.depositValueStacked]}
          >
            {depositDisplay}
          </Text>
        </View>
      </View>

      <View style={styles.paymentCard}>
        <Text style={styles.paymentTitle}>What happens next</Text>
        <Text style={styles.paymentCopy}>
          PSI checks the requested date and workshop capacity. If approved, PSI sends the secure deposit link. Only verified payment triggers the customer and PSI confirmation emails, internal Google Calendar booking and factual 7-day and 24-hour appointment reminders.
        </Text>
      </View>

      <View accessibilityLabel="Booking and deposit terms" style={styles.policyCard}>
        <Text style={styles.policyKicker}>PSI booking terms</Text>
        <Text style={styles.policyTitle}>Booking and deposit policy</Text>
        <Text style={styles.policyCopy}>
          Sending this request does not reserve a date and no payment is taken. Once PSI approves a date, PSI may send a secure link for the {depositDisplay} deposit. The booking becomes confirmed only after the payment provider verifies that deposit.
        </Text>
        <Text style={styles.policyCopy}>
          Contact PSI as soon as possible if you need to cancel or move an approved booking. PSI may apply a paid deposit only toward reasonable costs already incurred or workshop capacity reasonably reserved for that booking, and will refund any remaining amount. If PSI needs to cancel, you may accept a replacement date or receive a refund of the unused deposit.
        </Text>
        <Text style={styles.policyFine}>
          No term limits rights or remedies that cannot be excluded under the Australian Consumer Law. PSI will explain any proposed deduction before processing it and consider exceptional circumstances fairly.
        </Text>
      </View>

      {form.bookingType === 'service' ? (
        <ToggleRow
          checked={form.serviceReminderConsent}
          copy="After this service is completed, PSI may email “Ready for your next service?” at 6 and 12 months with rebook/contact links. Optional, separate from appointment logistics, and every message includes unsubscribe."
          label="Send me 6- and 12-month service reminders"
          onPress={() => update('serviceReminderConsent', !form.serviceReminderConsent)}
        />
      ) : null}

      <View>
        <Pressable
          accessibilityLabel={depositTermsCopy}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: form.bookingTermsAccepted }}
          onPress={() => update('bookingTermsAccepted', !form.bookingTermsAccepted)}
          style={({ pressed }) => [
            styles.consentRow,
            errors.bookingTermsAccepted && styles.consentError,
            pressed && styles.pressed,
          ]}
        >
          <CheckBox checked={form.bookingTermsAccepted} />
          <Text style={styles.consentCopy}>{depositTermsCopy}</Text>
        </Pressable>
        {errors.bookingTermsAccepted ? <Text style={styles.error}>{errors.bookingTermsAccepted}</Text> : null}
      </View>

      <View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: form.consent }}
          onPress={() => update('consent', !form.consent)}
          style={({ pressed }) => [styles.consentRow, errors.consent && styles.consentError, pressed && styles.pressed]}
        >
          <CheckBox checked={form.consent} />
          <Text style={styles.consentCopy}>
            I agree that PSI Performance may contact me to review this request, propose or confirm a date, and send necessary payment and booking updates.
          </Text>
        </Pressable>
        {errors.consent ? <Text style={styles.error}>{errors.consent}</Text> : null}
        <Pressable accessibilityRole="link" hitSlop={10} onPress={onOpenPrivacy}>
          <Text style={styles.privacyLink}>Read the privacy policy ↗</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({ checked, label, copy, onPress }: { checked: boolean; label: string; copy: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`${label}. ${copy}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
    >
      <CheckBox checked={checked} />
      <View style={styles.toggleCopyWrap}>
        <Text style={styles.toggleTitle}>{label}</Text>
        <Text style={styles.toggleCopy}>{copy}</Text>
      </View>
    </Pressable>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Text maxFontSizeMultiplier={1.3} style={styles.checkmark}>✓</Text> : null}
    </View>
  );
}

function SummaryRow({ label, value, secondary }: { label: string; value: string; secondary?: string }) {
  const { compact, largeText } = useResponsiveLayout();

  return (
    <View style={[styles.summaryRow, (compact || largeText) && styles.summaryRowStacked]}>
      <Text style={[styles.summaryLabel, (compact || largeText) && styles.summaryLabelStacked]}>{label}</Text>
      <View style={styles.summaryValueWrap}>
        <Text style={styles.summaryValue}>{value}</Text>
        {secondary ? <Text style={styles.summarySecondary}>{secondary}</Text> : null}
      </View>
    </View>
  );
}

function RequestHandoff({
  draftCleared,
  result,
  onHome,
}: {
  draftCleared: boolean;
  result: BookingRequestResult;
  onHome: () => void;
}) {
  const { compact, horizontalPadding, short } = useResponsiveLayout();

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.successScreen}>
      <ScrollView contentContainerStyle={[styles.successScroll, short && styles.successScrollShort, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.checkoutMark}>
          <Text maxFontSizeMultiplier={1.3} style={styles.checkoutMarkText}>✓</Text>
        </View>
        <Eyebrow>Request received for review</Eyebrow>
        <Text maxFontSizeMultiplier={2} style={[styles.successTitle, compact && styles.successTitleCompact]}>PSI will check the date first.</Text>
        <Text style={styles.successLead}>
          {result.message} If your preferred date is not suitable, PSI will contact you to arrange another option. {draftCleared
            ? 'Your unfinished on-device draft has been cleared.'
            : 'The request was received, but the on-device draft could not be cleared and may still contain your details. Clear it before leaving a shared device.'}
        </Text>

        <View style={styles.checkoutReferenceCard}>
          <SummaryRow label="Request reference" value={result.reference} />
          <SummaryRow label="Current state" value="Pending PSI staff review" />
          <SummaryRow label="Payment required now" value="No" />
        </View>

        <View style={styles.notPaidCard}>
          <Text style={styles.notPaidTitle}>Nothing else is confirmed yet</Text>
          <Text style={styles.notPaidCopy}>
            This receipt confirms only that PSI received the request. It does not claim a payment, final booking date, confirmation email or Google Calendar event. PSI sends the deposit link after approving a date; verified payment then triggers the confirmations and calendar entry.
          </Text>
        </View>

        <View style={styles.successActions}>
          <PrimaryButton label="Return to PSI home" onPress={onHome} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: bookingColors.background },
  accountLoadingState: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  accountLoadingTitle: { color: colors.white, fontSize: 20, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  accountLoadingCopy: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
  draftLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  draftLoadingTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  draftLoadingCopy: { maxWidth: 340, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  draftConflictScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  draftConflictCard: { ...mobileFrame, width: '100%', maxWidth: 520, alignItems: 'center', gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  draftConflictNote: { maxWidth: 400, color: colors.silver, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  draftConflictError: { width: '100%', color: colors.danger, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  draftConflictActions: { width: '100%', gap: spacing.sm },
  topBar: {
    width: '100%',
    maxWidth: 820,
    minHeight: 68,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  topBarCompact: { minHeight: 62 },
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backArrow: { color: bookingColors.accent, fontSize: 23 },
  backLabel: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  topBarBrand: { alignItems: 'flex-end', gap: 2 },
  topBarLogo: { width: 94, height: 35 },
  topBarLogoCompact: { width: 82, height: 31 },
  topBarCopy: { color: bookingColors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
  progress: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  progressItem: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  progressCompact: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  progressNumber: {
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  progressNumberActive: { borderColor: bookingColors.accent, backgroundColor: bookingColors.accent },
  progressNumberText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  progressNumberTextActive: { color: colors.ink },
  progressLabel: { width: '100%', color: bookingColors.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.3, lineHeight: 10, textAlign: 'center', textTransform: 'uppercase' },
  progressLabelActive: { color: colors.white },
  formScroll: { flexGrow: 1, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  formScrollShort: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  formInner: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  demoBanner: { ...mobileFrame, gap: spacing.xs, marginBottom: spacing.lg, backgroundColor: bookingColors.accent, padding: spacing.md },
  demoBannerTitle: { color: bookingColors.accentText, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  demoBannerCopy: { color: bookingColors.accentText, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  alert: { ...mobileFrame, gap: spacing.sm, marginBottom: spacing.lg, backgroundColor: bookingColors.errorSurface, padding: spacing.md },
  alertTitle: { color: colors.white, fontSize: 15, fontWeight: '900' },
  alertCopy: { color: bookingColors.errorText, fontSize: 13, lineHeight: 19 },
  alertAssurance: { color: bookingColors.errorText, fontSize: 11, fontWeight: '800' },
  alertLink: { color: bookingColors.text, fontSize: 13, fontWeight: '900', textDecorationLine: 'underline' },
  draftCard: { ...mobileFrame, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl, backgroundColor: colors.inkSoft, padding: spacing.md },
  draftCopyWrap: { flex: 1, minWidth: 0, gap: 4 },
  draftTitle: { color: colors.white, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  draftCopy: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  draftClear: { minHeight: 44, maxWidth: 120, justifyContent: 'center', paddingHorizontal: spacing.sm },
  draftClearText: { color: bookingColors.accent, fontSize: 10, fontWeight: '900', textAlign: 'right', textDecorationLine: 'underline' },
  stepContent: { gap: spacing.xl },
  stepHeading: { gap: spacing.md },
  stepTitle: { color: colors.white, fontSize: 34, fontWeight: '900', letterSpacing: -1.5, lineHeight: 36, textTransform: 'uppercase' },
  stepTitleCompact: { fontSize: 29, letterSpacing: -1, lineHeight: 32 },
  stepIntro: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  personalPromise: { ...mobileFrame, gap: spacing.sm, backgroundColor: bookingColors.surfaceAlt, padding: spacing.md },
  personalPromiseTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  personalPromiseCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  jobSelectedCard: { ...mobileFrame, gap: spacing.xs, backgroundColor: bookingColors.surface, padding: spacing.lg },
  jobSelectedKicker: { color: bookingColors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  jobSelectedTitle: { color: colors.white, fontSize: 20, fontWeight: '900', textTransform: 'uppercase' },
  jobSelectedCopy: { color: colors.silver, fontSize: 12, lineHeight: 18 },
  jobSelectedDeposit: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  missingTypeCard: { ...mobileFrame, gap: spacing.md, backgroundColor: bookingColors.surface, padding: spacing.md },
  missingTypeTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  missingTypeCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  setupConfidenceSection: { gap: spacing.lg },
  inspectionCard: { ...mobileFrame, gap: spacing.sm, backgroundColor: bookingColors.surfaceAlt, padding: spacing.md },
  inspectionTitle: { color: colors.white, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  inspectionCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  choiceList: { gap: spacing.sm },
  error: { marginTop: spacing.sm, color: colors.danger, fontSize: 12, lineHeight: 17 },
  fields: { gap: spacing.lg },
  fieldRow: { gap: spacing.lg },
  fieldRowWide: { flexDirection: 'row' },
  fieldCell: { flex: 1 },
  notesInput: { minHeight: 150 },
  characterCount: { alignSelf: 'flex-end', color: bookingColors.textMuted, fontSize: 11 },
  tuningSetup: { gap: spacing.lg, borderTopWidth: 1, borderTopColor: bookingColors.accent, paddingTop: spacing.xl },
  tuningIntro: { gap: spacing.sm },
  tuningKicker: { color: bookingColors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.7, textTransform: 'uppercase' },
  tuningTitle: { color: colors.white, fontSize: 27, fontWeight: '900', letterSpacing: -0.8, lineHeight: 31, textTransform: 'uppercase' },
  tuningCopy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  tuningSection: { ...mobileFrame, gap: spacing.lg, backgroundColor: bookingColors.surface, padding: spacing.md },
  tuningSectionCompact: { gap: spacing.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  tuningSectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.md },
  tuningSectionIndex: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: bookingColors.accent },
  tuningSectionIndexText: { color: colors.ink, fontSize: 9, fontWeight: '900' },
  tuningSectionTitle: { flex: 1, color: colors.white, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  tuningFields: { gap: spacing.lg },
  tuningNotesInput: { minHeight: 104 },
  tuningSelect: { ...mobileFrame, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderRadius: 3, backgroundColor: 'transparent', paddingHorizontal: spacing.md },
  tuningSelectError: { borderColor: mobileFrame.borderColor },
  tuningSelectText: { flex: 1, minWidth: 0, color: colors.white, fontSize: 15, fontWeight: '700' },
  tuningSelectPlaceholder: { color: bookingColors.placeholder, fontWeight: '500' },
  tuningSelectChevron: { color: bookingColors.accent, fontSize: 24, lineHeight: 28 },
  tuningModalRoot: { flex: 1 },
  tuningModalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.86)' },
  tuningModalSafeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, pointerEvents: 'box-none' },
  tuningModalSafeAreaTight: { padding: spacing.sm },
  tuningModalSheet: { ...mobileFrame, width: '100%', minHeight: 0, maxWidth: 560, maxHeight: '92%', gap: spacing.lg, borderRadius: 5, backgroundColor: bookingColors.surfaceAlt, padding: spacing.lg },
  tuningModalSheetTight: { maxHeight: '100%', gap: spacing.md, padding: spacing.md },
  tuningModalSheetWide: { maxHeight: '86%' },
  tuningModalHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  tuningModalHeadingCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  tuningModalKicker: { color: bookingColors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  tuningModalTitle: { color: colors.white, fontSize: 23, fontWeight: '900', lineHeight: 27, textTransform: 'uppercase' },
  tuningModalClose: { color: bookingColors.textMuted, fontSize: 32, lineHeight: 34 },
  tuningOptionScroll: { flexShrink: 1, minHeight: 0 },
  tuningOptionList: { gap: spacing.sm },
  tuningOption: { ...mobileFrame, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderRadius: 3, backgroundColor: bookingColors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tuningOptionActive: { borderColor: mobileFrame.borderColor, backgroundColor: bookingColors.accent },
  tuningOptionText: { flex: 1, minWidth: 0, color: colors.white, fontSize: 15, fontWeight: '800' },
  tuningOptionTextActive: { color: bookingColors.accentText },
  tuningOptionRadio: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: bookingColors.accentDark, borderRadius: 11 },
  tuningOptionRadioActive: { borderColor: bookingColors.accentText },
  tuningOptionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: bookingColors.accentText },
  accountNotice: {
    ...mobileFrame,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: bookingColors.surface,
    padding: spacing.md,
  },
  accountNoticeCopyWrap: { flex: 1, minWidth: 0 },
  accountNoticeTitle: { color: colors.white, fontSize: 13, fontWeight: '900' },
  accountNoticeCopy: { marginTop: 4, color: colors.muted, fontSize: 11, lineHeight: 17 },
  accountNoticeArrow: { color: bookingColors.accent, fontSize: 22 },
  datePrivacyCard: { ...mobileFrame, gap: spacing.sm, backgroundColor: bookingColors.surfaceAlt, padding: spacing.md },
  datePrivacyTitle: { color: colors.white, fontSize: 13, fontWeight: '900' },
  datePrivacyCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  dateButton: {
    ...mobileFrame,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 3,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
  },
  dateButtonError: { borderColor: mobileFrame.borderColor },
  dateText: { color: colors.white, fontSize: 16 },
  datePlaceholder: { color: bookingColors.placeholder },
  dateIcon: { color: bookingColors.accent, fontSize: 22 },
  datePickerWrap: { ...mobileFrame, overflow: 'hidden', borderRadius: 3, backgroundColor: bookingColors.surface, padding: spacing.sm },
  datePickerWrapCompact: { paddingHorizontal: 0 },
  datePicker: { width: '100%', alignSelf: 'center' },
  dateDone: { alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dateDoneText: { color: bookingColors.accent, fontSize: 14, fontWeight: '900' },
  dateEligibility: { marginTop: spacing.sm, fontSize: 11, fontWeight: '800', lineHeight: 17 },
  dateEligibilityGood: { color: colors.success },
  dateEligibilityBad: { color: colors.danger },
  compactChoices: { gap: spacing.sm },
  summaryCard: { ...mobileFrame, backgroundColor: bookingColors.surface, padding: spacing.lg },
  summaryCardCompact: { padding: spacing.md },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingBottom: spacing.md },
  summaryTopStacked: { alignItems: 'flex-start', flexDirection: 'column', gap: spacing.xs },
  summaryKicker: { color: bookingColors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  summaryReference: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  summaryRow: { minHeight: 69, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: spacing.md },
  summaryRowStacked: { flexDirection: 'column', gap: spacing.sm },
  summaryLabel: { width: 94, color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  summaryLabelStacked: { width: 'auto' },
  summaryValueWrap: { flex: 1, minWidth: 0, gap: 4 },
  summaryValue: { color: colors.white, fontSize: 14, fontWeight: '900', lineHeight: 20 },
  summarySecondary: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  requestSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: spacing.md },
  requestSummaryText: { flex: 1, minWidth: 0, color: colors.silver, fontSize: 12, lineHeight: 19 },
  depositTotal: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, borderTopWidth: 1, borderTopColor: bookingColors.accent, paddingTop: spacing.lg },
  depositTotalStacked: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.sm },
  depositCopy: { flex: 1, minWidth: 0 },
  depositCopyStacked: { flex: 0, width: '100%' },
  depositLabel: { color: colors.white, fontSize: 13, fontWeight: '900' },
  depositCurrency: { marginTop: 4, color: colors.muted, fontSize: 10 },
  depositValue: { flexShrink: 1, color: bookingColors.accent, fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  depositValueStacked: { alignSelf: 'flex-end', fontSize: 28, lineHeight: 32, textAlign: 'right' },
  paymentCard: { ...mobileFrame, gap: spacing.sm, backgroundColor: bookingColors.surfaceAlt, padding: spacing.md },
  paymentTitle: { color: colors.white, fontSize: 14, fontWeight: '900' },
  paymentCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  policyCard: { ...mobileFrame, gap: spacing.sm, backgroundColor: bookingColors.surface, padding: spacing.lg },
  policyKicker: { color: bookingColors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  policyTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  policyCopy: { color: colors.silver, fontSize: 12, lineHeight: 19 },
  policyFine: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  toggleRow: { ...mobileFrame, minHeight: 76, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: bookingColors.surface, padding: spacing.md },
  toggleCopyWrap: { flex: 1, minWidth: 0, gap: 4 },
  toggleTitle: { color: colors.white, fontSize: 13, fontWeight: '900' },
  toggleCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  consentRow: { ...mobileFrame, flexDirection: 'row', gap: spacing.md, borderRadius: 3, backgroundColor: bookingColors.surface, padding: spacing.md },
  consentError: { borderColor: mobileFrame.borderColor },
  checkbox: { ...mobileFrame, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 2 },
  checkboxChecked: { borderColor: mobileFrame.borderColor, backgroundColor: bookingColors.accent },
  checkmark: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  consentCopy: { flex: 1, color: colors.silver, fontSize: 13, lineHeight: 20 },
  privacyLink: { marginTop: spacing.md, color: bookingColors.accent, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  actionsWide: { flexDirection: 'row' },
  actionButtonWide: { flex: 1 },
  requestNote: { marginTop: spacing.md, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  successScreen: { flex: 1, backgroundColor: bookingColors.background },
  successScroll: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  successScrollShort: { justifyContent: 'flex-start', paddingVertical: spacing.lg },
  checkoutMark: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, borderRadius: 36, backgroundColor: bookingColors.accent },
  checkoutMarkText: { color: colors.ink, fontSize: 36, fontWeight: '900' },
  successTitle: { marginTop: spacing.md, color: colors.white, fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 44, textTransform: 'uppercase' },
  successTitleCompact: { fontSize: 34, letterSpacing: -1.3, lineHeight: 37 },
  successLead: { marginTop: spacing.lg, color: colors.muted, fontSize: 15, lineHeight: 24 },
  checkoutReferenceCard: { ...mobileFrame, marginTop: spacing.xl, backgroundColor: bookingColors.surfaceAlt, paddingHorizontal: spacing.lg },
  notPaidCard: { ...mobileFrame, gap: spacing.sm, marginTop: spacing.lg, backgroundColor: bookingColors.surfaceAlt, padding: spacing.md },
  notPaidTitle: { color: colors.white, fontSize: 13, fontWeight: '900' },
  notPaidCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  successActions: { gap: spacing.sm, marginTop: spacing.xl },
  pressed: { opacity: 0.72 },
});
