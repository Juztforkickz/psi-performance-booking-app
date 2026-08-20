import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChoiceCard, Eyebrow, Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, contact, spacing } from '@/constants/brand';
import {
  dateFromIso,
  displayDate,
  DYNO_OPTIONS,
  EMPTY_BOOKING,
  localIsoDate,
  maxBookingDate,
  SERVICE_OPTIONS,
  submitBooking,
  type ArrivalWindow,
  BookingApiError,
  type BookingErrors,
  type BookingFormState,
  type BookingResult,
  type BookingType,
  validateBookingStep,
} from '@/lib/booking';

const STEP_LABELS = ['Job', 'Vehicle', 'Your details'];
const ARRIVAL_OPTIONS: { value: ArrivalWindow; label: string; detail: string }[] = [
  { value: 'any', label: 'No preference', detail: 'PSI can suggest the best arrival time.' },
  { value: 'morning', label: 'Morning', detail: 'Preferred arrival before midday.' },
  { value: 'afternoon', label: 'Afternoon', detail: 'Preferred arrival after midday.' },
];

function bookingTypeFromParam(value?: string | string[]): BookingType | '' {
  const selected = Array.isArray(value) ? value[0] : value;
  return selected === 'service' || selected === 'dyno' ? selected : '';
}

function firstErrorStep(errors: BookingErrors) {
  if (errors.bookingType || errors.serviceOption) return 1;
  if (errors.vehicleMake || errors.vehicleModel || errors.vehicleYear || errors.registration || errors.vin) return 2;
  return 3;
}

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string | string[] }>();
  const initialType = bookingTypeFromParam(params.type);
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<BookingFormState>(() => ({ ...EMPTY_BOOKING, bookingType: initialType }));
  const [errors, setErrors] = useState<BookingErrors>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState<BookingResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => randomUUID());
  const maxDate = useMemo(() => maxBookingDate(), []);

  const update = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError('');
  };

  const scrollToTop = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const continueToNextStep = () => {
    const nextErrors = validateBookingStep(form, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setStep((current) => Math.min(3, current + 1));
    scrollToTop();
  };

  const goBack = () => {
    setErrors({});
    setFormError('');
    setStep((current) => Math.max(1, current - 1));
    scrollToTop();
  };

  const submit = async () => {
    const allErrors = {
      ...validateBookingStep(form, 1),
      ...validateBookingStep(form, 2),
      ...validateBookingStep(form, 3),
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
      const booking = await submitBooking(form, idempotencyKey);
      setResult(booking);
      scrollToTop();
    } catch (error) {
      if (error instanceof BookingApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors);
        setStep(firstErrorStep(error.fieldErrors));
      }
      setFormError(error instanceof Error ? error.message : 'We could not submit that request. Please call PSI instead.');
      scrollToTop();
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm({ ...EMPTY_BOOKING, bookingType: initialType });
    setErrors({});
    setFormError('');
    setResult(null);
    setIdempotencyKey(randomUUID());
    setStep(1);
    scrollToTop();
  };

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && selected) update('preferredDate', localIsoDate(selected));
  };

  if (result) {
    return <BookingSuccess result={result} onReset={reset} onHome={() => router.replace('/')} />;
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back to PSI home"
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <View style={styles.topBarBrand}>
          <Image
            accessibilityLabel="PSI Performance Garage"
            resizeMode="contain"
            source={require('../../assets/images/psi-logo.png')}
            style={styles.topBarLogo}
          />
          <Text style={styles.topBarCopy}>Booking request</Text>
        </View>
      </View>

      <Progress step={step} onSelect={setStep} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.formScroll}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formInner}>
            {formError ? (
              <View accessibilityRole="alert" style={styles.alert}>
                <Text style={styles.alertTitle}>Request not sent</Text>
                <Text style={styles.alertCopy}>{formError}</Text>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(contact.phoneUrl)}>
                  <Text style={styles.alertLink}>Call {contact.phoneDisplay}</Text>
                </Pressable>
              </View>
            ) : null}

            {step === 1 ? <JobStep errors={errors} form={form} update={update} /> : null}
            {step === 2 ? <VehicleStep errors={errors} form={form} update={update} /> : null}
            {step === 3 ? (
              <DetailsStep
                errors={errors}
                form={form}
                maxDate={maxDate}
                onDateChange={handleDateChange}
                setShowDatePicker={setShowDatePicker}
                showDatePicker={showDatePicker}
                update={update}
              />
            ) : null}

            <View style={styles.actions}>
              {step > 1 ? <PrimaryButton label="Back" onPress={goBack} variant="outline" /> : null}
              {step < 3 ? (
                <PrimaryButton label="Continue →" onPress={continueToNextStep} />
              ) : (
                <PrimaryButton label="Send booking request" loading={submitting} onPress={() => void submit()} />
              )}
            </View>
            <Text style={styles.requestNote}>
              No payment is taken. Your date is a preference until the PSI team contacts you to confirm it.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type UpdateBooking = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => void;

function Progress({ step, onSelect }: { step: number; onSelect: (step: number) => void }) {
  return (
    <View accessibilityLabel={`Booking step ${step} of 3`} accessibilityRole="progressbar" style={styles.progress}>
      {STEP_LABELS.map((label, index) => {
        const number = index + 1;
        const complete = number < step;
        const active = number === step;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: number > step }}
            disabled={number > step}
            key={label}
            onPress={() => onSelect(number)}
            style={styles.progressItem}
          >
            <View style={[styles.progressNumber, (complete || active) && styles.progressNumberActive]}>
              <Text style={[styles.progressNumberText, (complete || active) && styles.progressNumberTextActive]}>
                {complete ? '✓' : number}
              </Text>
            </View>
            <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <View style={styles.stepHeading}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepIntro}>{copy}</Text>
    </View>
  );
}

function JobStep({ form, errors, update }: { form: BookingFormState; errors: BookingErrors; update: UpdateBooking }) {
  const options = form.bookingType === 'dyno' ? DYNO_OPTIONS : SERVICE_OPTIONS;

  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="Pick the closest option. You can explain the details before you send the request."
        eyebrow="Step 01 · Job"
        title="What can we help with?"
      />
      <View accessibilityRole="radiogroup" style={styles.choiceList}>
        <ChoiceCard
          detail="Maintenance, diagnostics and repairs"
          index="01"
          onPress={() => {
            update('bookingType', 'service');
            update('serviceOption', '');
          }}
          selected={form.bookingType === 'service'}
          title="Vehicle service"
        />
        <ChoiceCard
          detail="Tuning, health checks and calibration"
          index="02"
          onPress={() => {
            update('bookingType', 'dyno');
            update('serviceOption', '');
          }}
          selected={form.bookingType === 'dyno'}
          title="Dyno tune"
        />
      </View>
      {errors.bookingType ? <Text style={styles.error}>{errors.bookingType}</Text> : null}

      {form.bookingType ? (
        <View style={styles.optionSection}>
          <Text style={styles.sectionLabel}>Choose the closest job type</Text>
          <View accessibilityRole="radiogroup" style={styles.choiceList}>
            {options.map((option) => (
              <ChoiceCard
                detail={option.detail}
                key={option.value}
                onPress={() => update('serviceOption', option.value)}
                selected={form.serviceOption === option.value}
                title={option.label}
              />
            ))}
          </View>
          {errors.serviceOption ? <Text style={styles.error}>{errors.serviceOption}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function VehicleStep({ form, errors, update }: { form: BookingFormState; errors: BookingErrors; update: UpdateBooking }) {
  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="The basics help PSI prepare before getting in touch. VIN is optional unless you already have it handy."
        eyebrow="Step 02 · Vehicle"
        title="Tell us about the car."
      />
      <View style={styles.fields}>
        <Field error={errors.vehicleMake} label="Make">
          <FormInput
            autoCapitalize="words"
            error={errors.vehicleMake}
            maxLength={60}
            onChangeText={(value) => update('vehicleMake', value)}
            placeholder="e.g. Holden"
            returnKeyType="next"
            value={form.vehicleMake}
          />
        </Field>
        <Field error={errors.vehicleModel} label="Model">
          <FormInput
            autoCapitalize="words"
            error={errors.vehicleModel}
            maxLength={80}
            onChangeText={(value) => update('vehicleModel', value)}
            placeholder="e.g. VF SS"
            returnKeyType="next"
            value={form.vehicleModel}
          />
        </Field>
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
        <Field error={errors.registration} label="Registration">
          <FormInput
            autoCapitalize="characters"
            error={errors.registration}
            maxLength={12}
            onChangeText={(value) => update('registration', value.toUpperCase())}
            placeholder="ABC123"
            value={form.registration}
          />
        </Field>
        <Field error={errors.vin} hint="Optional" label="VIN">
          <FormInput
            autoCapitalize="characters"
            error={errors.vin}
            maxLength={17}
            onChangeText={(value) => update('vin', value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
            placeholder="17-character identification number"
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
  const selectedDate = form.preferredDate ? dateFromIso(form.preferredDate) : new Date();

  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="Request a preferred drop-off date. PSI will contact you to confirm availability."
        eyebrow="Step 03 · Your details"
        title="When and how should we reach you?"
      />
      <View style={styles.fields}>
        <Field error={errors.customerName} label="Your name">
          <FormInput
            autoCapitalize="words"
            autoComplete="name"
            error={errors.customerName}
            maxLength={100}
            onChangeText={(value) => update('customerName', value)}
            value={form.customerName}
          />
        </Field>
        <Field error={errors.phone} label="Phone">
          <FormInput
            autoComplete="tel"
            error={errors.phone}
            keyboardType="phone-pad"
            maxLength={30}
            onChangeText={(value) => update('phone', value)}
            placeholder="04xx xxx xxx"
            value={form.phone}
          />
        </Field>
        <Field error={errors.email} label="Email">
          <FormInput
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            keyboardType="email-address"
            maxLength={160}
            onChangeText={(value) => update('email', value)}
            placeholder="you@example.com"
            value={form.email}
          />
        </Field>

        <Field error={errors.preferredDate} label="Preferred drop-off date">
          <Pressable
            accessibilityLabel={`Preferred drop-off date, ${displayDate(form.preferredDate)}`}
            accessibilityRole="button"
            onPress={() => setShowDatePicker(true)}
            style={({ pressed }) => [
              styles.dateButton,
              errors.preferredDate && styles.dateButtonError,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.dateText, !form.preferredDate && styles.datePlaceholder]}>
              {displayDate(form.preferredDate)}
            </Text>
            <Text style={styles.dateIcon}>▦</Text>
          </Pressable>
          {showDatePicker ? (
            <View style={styles.datePickerWrap}>
              <DateTimePicker
                accentColor={colors.gold}
                display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                maximumDate={maxDate}
                minimumDate={new Date()}
                mode="date"
                onChange={onDateChange}
                themeVariant="dark"
                value={selectedDate}
              />
              {Platform.OS === 'ios' ? (
                <Pressable onPress={() => setShowDatePicker(false)} style={styles.dateDone}>
                  <Text style={styles.dateDoneText}>Done</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Field>

        <Field label="Arrival preference">
          <View accessibilityRole="radiogroup" style={styles.compactChoices}>
            {ARRIVAL_OPTIONS.map((option) => (
              <ChoiceCard
                detail={option.detail}
                key={option.value}
                onPress={() => update('arrivalWindow', option.value)}
                selected={form.arrivalWindow === option.value}
                title={option.label}
              />
            ))}
          </View>
        </Field>

        <Field hint="Optional" label="Anything PSI should know?">
          <FormInput
            maxLength={1200}
            multiline
            numberOfLines={5}
            onChangeText={(value) => update('notes', value)}
            placeholder="Symptoms, modifications, goals, warning lights or anything else that helps."
            style={styles.notesInput}
            textAlignVertical="top"
            value={form.notes}
          />
          <Text style={styles.characterCount}>{form.notes.length}/1200</Text>
        </Field>

        <View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.consent }}
            onPress={() => update('consent', !form.consent)}
            style={({ pressed }) => [styles.consentRow, errors.consent && styles.consentError, pressed && styles.pressed]}
          >
            <View style={[styles.checkbox, form.consent && styles.checkboxChecked]}>
              {form.consent ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.consentCopy}>
              I agree that PSI Performance may contact me about this booking request.
            </Text>
          </Pressable>
          {errors.consent ? <Text style={styles.error}>{errors.consent}</Text> : null}
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(contact.privacy)}>
            <Text style={styles.privacyLink}>Read the privacy policy ↗</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function BookingSuccess({
  result,
  onReset,
  onHome,
}: {
  result: BookingResult;
  onReset: () => void;
  onHome: () => void;
}) {
  const status = result.status === 'requested'
    ? 'PENDING CONFIRMATION'
    : result.status.replace(/[_-]/g, ' ').toUpperCase();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.successScreen}>
      <ScrollView contentContainerStyle={styles.successScroll}>
        <View style={styles.successMark}>
          <Text style={styles.successCheck}>✓</Text>
        </View>
        <Eyebrow>Request received</Eyebrow>
        <Text style={styles.successTitle}>We’ve got it.</Text>
        <Text style={styles.successLead}>
          {result.message || 'Your preferred date is not confirmed yet. The PSI team will contact you to confirm availability and the right next step for your car.'}
        </Text>
        <View style={styles.statusChip}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{status || 'PENDING CONFIRMATION'}</Text>
        </View>
        <View style={styles.referenceCard}>
          <Text style={styles.referenceLabel}>Your booking reference</Text>
          <Text selectable style={styles.referenceValue}>
            {result.reference}
          </Text>
          <Text style={styles.referenceHint}>Keep this reference handy when PSI gets in touch.</Text>
        </View>
        <View style={styles.successActions}>
          <PrimaryButton label="Call PSI" onPress={() => void Linking.openURL(contact.phoneUrl)} />
          <PrimaryButton label="Start another request" onPress={onReset} variant="outline" />
          <Pressable accessibilityRole="button" onPress={onHome} style={styles.homeLink}>
            <Text style={styles.homeLinkText}>Return to PSI home</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  topBar: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backArrow: {
    color: colors.gold,
    fontSize: 23,
  },
  backLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  topBarBrand: {
    alignItems: 'flex-end',
    gap: 3,
  },
  topBarLogo: {
    width: 92,
    height: 35,
  },
  topBarCopy: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  progress: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  progressNumberActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  progressNumberText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
  },
  progressNumberTextActive: {
    color: colors.ink,
  },
  progressLabel: {
    color: colors.mutedDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  progressLabelActive: {
    color: colors.white,
  },
  formScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  formInner: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  alert: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    backgroundColor: '#291515',
    padding: spacing.md,
  },
  alertTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
  },
  alertCopy: {
    color: '#FFD1CD',
    fontSize: 13,
    lineHeight: 19,
  },
  alertLink: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
  stepContent: {
    gap: spacing.xl,
  },
  stepHeading: {
    gap: spacing.md,
  },
  stepTitle: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 36,
    textTransform: 'uppercase',
  },
  stepIntro: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  choiceList: {
    gap: spacing.sm,
  },
  optionSection: {
    gap: spacing.md,
  },
  sectionLabel: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '900',
  },
  error: {
    marginTop: spacing.sm,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  fields: {
    gap: spacing.lg,
  },
  dateButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: colors.inkSoft,
    paddingHorizontal: spacing.md,
  },
  dateButtonError: {
    borderColor: colors.danger,
  },
  dateText: {
    color: colors.white,
    fontSize: 16,
  },
  datePlaceholder: {
    color: colors.mutedDark,
  },
  dateIcon: {
    color: colors.gold,
    fontSize: 22,
  },
  datePickerWrap: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: colors.panel,
    padding: spacing.sm,
  },
  dateDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateDoneText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '900',
  },
  compactChoices: {
    gap: spacing.sm,
  },
  notesInput: {
    minHeight: 130,
  },
  characterCount: {
    alignSelf: 'flex-end',
    color: colors.mutedDark,
    fontSize: 11,
  },
  consentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: colors.panel,
    padding: spacing.md,
  },
  consentError: {
    borderColor: colors.danger,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 2,
  },
  checkboxChecked: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  checkmark: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  consentCopy: {
    flex: 1,
    color: colors.cream,
    fontSize: 13,
    lineHeight: 20,
  },
  privacyLink: {
    marginTop: spacing.md,
    color: colors.gold,
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  requestNote: {
    marginTop: spacing.md,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  successScreen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  successScroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  successMark: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderRadius: 36,
    backgroundColor: colors.gold,
  },
  successCheck: {
    color: colors.ink,
    fontSize: 36,
    fontWeight: '900',
  },
  successTitle: {
    marginTop: spacing.md,
    color: colors.white,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -2.2,
    lineHeight: 48,
    textTransform: 'uppercase',
  },
  successLead: {
    marginTop: spacing.lg,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25,
  },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: '#27573A',
    borderRadius: 20,
    backgroundColor: '#11251A',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  referenceCard: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.panel,
    padding: spacing.lg,
  },
  referenceLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  referenceValue: {
    color: colors.gold,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1,
  },
  referenceHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  successActions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  homeLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  homeLinkText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.72,
  },
});
