import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChoiceCard, Eyebrow, Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, contact, spacing } from '@/constants/brand';
import {
  BOOKING_PURPOSES,
  BookingApiError,
  createBookingCheckout,
  dateFromIso,
  displayDate,
  displayMoney,
  EMPTY_BOOKING,
  localIsoDate,
  maxBookingDate,
  MIN_DEPOSIT_CENTS,
  type ArrivalWindow,
  type BookingCheckoutResult,
  type BookingErrors,
  type BookingFormState,
  type BookingType,
  validateBookingStep,
} from '@/lib/booking';

const STEP_LABELS = ['Job', 'Vehicle', 'Details', 'Date', 'Deposit'];
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
  if (errors.bookingType || errors.requestDetails) return 1;
  if (errors.vehicleMake || errors.vehicleModel || errors.vehicleYear || errors.registration || errors.vin) return 2;
  if (errors.firstName || errors.lastName || errors.email || errors.mobile) return 3;
  if (errors.preferredDate || errors.arrivalWindow) return 4;
  return 5;
}

type UpdateBooking = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]) => void;

export default function BookingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ type?: string | string[] }>();
  const initialType = bookingTypeFromParam(params.type);
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<BookingFormState>(() => ({
    ...EMPTY_BOOKING,
    bookingType: initialType,
  }));
  const [errors, setErrors] = useState<BookingErrors>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [errorTitle, setErrorTitle] = useState('Secure checkout not opened');
  const [checkout, setCheckout] = useState<BookingCheckoutResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => randomUUID());
  const maxDate = useMemo(() => maxBookingDate(), []);
  const wideFields = width >= 680;

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
  };

  const selectBookingType = (type: BookingType) => {
    update('bookingType', type);
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

  const prepareCheckout = async () => {
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
      const prepared = await createBookingCheckout(form, idempotencyKey);
      setCheckout(prepared);
      const supported = await Linking.canOpenURL(prepared.payment.checkoutUrl);
      if (supported) {
        await Linking.openURL(prepared.payment.checkoutUrl);
      } else {
        setCheckout(null);
        setErrorTitle('Checkout link unavailable');
        setFormError('The secure checkout link could not be opened on this device. No payment has been taken.');
      }
    } catch (error) {
      if (error instanceof BookingApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors);
        setStep(firstErrorStep(error.fieldErrors));
      }
      const unavailable = error instanceof BookingApiError && error.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED';
      setErrorTitle(unavailable ? 'Secure payments are not available yet' : 'Secure checkout not opened');
      setFormError(error instanceof Error ? error.message : 'Checkout could not be prepared. No payment has been taken.');
      scrollToTop();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && selected) update('preferredDate', localIsoDate(selected));
  };

  if (checkout) {
    return (
      <CheckoutHandoff
        checkout={checkout}
        onHome={() => router.replace('/')}
        onReopen={() => void Linking.openURL(checkout.payment.checkoutUrl)}
      />
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back to PSI home"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
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
          <Text style={styles.topBarCopy}>Secure booking</Text>
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
          contentContainerStyle={styles.formScroll}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formInner}>
            {formError ? (
              <View accessibilityRole="alert" style={styles.alert}>
                <Text style={styles.alertTitle}>{errorTitle}</Text>
                <Text style={styles.alertCopy}>{formError}</Text>
                <Text style={styles.alertAssurance}>No payment or booking has been recorded by this app.</Text>
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(contact.phoneUrl)}>
                  <Text style={styles.alertLink}>Call {contact.phoneDisplay}</Text>
                </Pressable>
              </View>
            ) : null}

            {step === 1 ? (
              <JobStep errors={errors} form={form} selectType={selectBookingType} update={update} />
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
            {step === 5 ? <DepositStep errors={errors} form={form} update={update} /> : null}

            <View style={[styles.actions, wideFields && step > 1 && styles.actionsWide]}>
              {step > 1 ? <PrimaryButton label="Back" onPress={goBack} style={styles.actionButton} variant="outline" /> : null}
              {step < 5 ? (
                <PrimaryButton label="Continue →" onPress={continueToNextStep} style={styles.actionButton} />
              ) : (
                <PrimaryButton
                  label={`Continue to secure ${displayMoney(MIN_DEPOSIT_CENTS)} checkout`}
                  loading={submitting}
                  onPress={() => void prepareCheckout()}
                  style={styles.actionButton}
                />
              )}
            </View>
            <Text style={styles.requestNote}>
              {step === 5
                ? 'PSI does not treat the booking as paid or confirmed until the payment provider verifies the deposit and PSI accepts the date.'
                : 'Your selected date remains a preference until payment is completed and PSI confirms availability.'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Progress({ step, onSelect }: { step: number; onSelect: (step: number) => void }) {
  return (
    <View accessibilityLabel={`Booking step ${step} of 5`} accessibilityRole="progressbar" style={styles.progress}>
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
            <Text numberOfLines={1} style={[styles.progressLabel, active && styles.progressLabelActive]}>{label}</Text>
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

function JobStep({
  form,
  errors,
  update,
  selectType,
}: {
  form: BookingFormState;
  errors: BookingErrors;
  update: UpdateBooking;
  selectType: (type: BookingType) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="Choose the workshop service, then tell PSI exactly what you need from the car."
        eyebrow="Step 01 · Job"
        title="What are you booking in for?"
      />
      <View accessibilityRole="radiogroup" style={styles.choiceList}>
        <ChoiceCard
          detail="Workshop service, inspection and a clear report. Price guide from $385 + GST."
          index="01"
          onPress={() => selectType('service')}
          selected={form.bookingType === 'service'}
          title="Service & Report"
        />
        <ChoiceCard
          detail="Hub dyno calibration, testing and measured results. Price guide from $350 + GST."
          index="02"
          onPress={() => selectType('dyno')}
          selected={form.bookingType === 'dyno'}
          title="Dyno tuning"
        />
      </View>
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
    </View>
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
          </View>
        </View>
        <Field error={errors.vin} hint="Optional" label="VIN">
          <FormInput
            autoCapitalize="characters"
            error={errors.vin}
            maxLength={17}
            onChangeText={(value) => update('vin', value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
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
        copy="Your receipt and every booking update will use these contact details."
        eyebrow="Step 03 · Details"
        title="Who is the booking for?"
      />
      <Pressable accessibilityRole="button" onPress={onAccount} style={({ pressed }) => [styles.accountNotice, pressed && styles.pressed]}>
        <View>
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
          </View>
          <View style={styles.fieldCell}>
            <Field error={errors.mobile} label="Mobile">
              <FormInput
                autoComplete="tel"
                error={errors.mobile}
                keyboardType="phone-pad"
                maxLength={30}
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
  const selectedDate = form.preferredDate ? dateFromIso(form.preferredDate) : new Date();

  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="Choose the date you prefer. Other customer bookings remain private, and PSI will confirm availability after deposit payment."
        eyebrow="Step 04 · Date"
        title="Select a preferred date."
      />
      <View style={styles.datePrivacyCard}>
        <Text style={styles.datePrivacyTitle}>Private calendar request</Text>
        <Text style={styles.datePrivacyCopy}>
          You can request an eligible date without seeing PSI’s calendar or other bookings. This is not a confirmed appointment yet.
        </Text>
      </View>
      <View style={styles.fields}>
        <Field error={errors.preferredDate} label="Preferred booking date">
          <Pressable
            accessibilityLabel={`Preferred booking date, ${displayDate(form.preferredDate)}`}
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
                timeZoneName="Australia/Melbourne"
                value={selectedDate}
              />
              {Platform.OS === 'ios' ? (
                <Pressable accessibilityRole="button" onPress={() => setShowDatePicker(false)} style={styles.dateDone}>
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
      </View>
    </View>
  );
}

function DepositStep({
  form,
  errors,
  update,
}: {
  form: BookingFormState;
  errors: BookingErrors;
  update: UpdateBooking;
}) {
  const purpose = form.bookingType ? BOOKING_PURPOSES[form.bookingType] : null;
  return (
    <View style={styles.stepContent}>
      <StepHeading
        copy="Review everything before PSI prepares a secure deposit checkout."
        eyebrow="Step 05 · Deposit"
        title="Review and pay securely."
      />

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryKicker}>Booking summary</Text>
          <Text style={styles.summaryReference}>Pending payment</Text>
        </View>
        <SummaryRow label="Work" value={purpose?.label || 'Not selected'} secondary={purpose?.priceGuide} />
        <SummaryRow
          label="Vehicle"
          value={`${form.vehicleYear} ${form.vehicleMake} ${form.vehicleModel}`.trim()}
          secondary={`Registration ${form.registration.toUpperCase()}`}
        />
        <SummaryRow label="Preferred date" value={displayDate(form.preferredDate)} secondary={`${form.arrivalWindow} arrival preference`} />
        <SummaryRow label="Customer" value={`${form.firstName} ${form.lastName}`} secondary={form.email} />
        <View style={styles.requestSummary}>
          <Text style={styles.summaryLabel}>Your request</Text>
          <Text style={styles.requestSummaryText}>{form.requestDetails}</Text>
        </View>
        <View style={styles.depositTotal}>
          <View>
            <Text style={styles.depositLabel}>Required booking deposit</Text>
            <Text style={styles.depositCurrency}>AUD · Applied to approved work</Text>
          </View>
          <Text style={styles.depositValue}>{displayMoney(MIN_DEPOSIT_CENTS)}</Text>
        </View>
      </View>

      <View style={styles.paymentCard}>
        <Text style={styles.paymentTitle}>Secure provider checkout</Text>
        <Text style={styles.paymentCopy}>
          The next step asks PSI’s server to create a secure payment link. This app never marks a deposit as paid itself and does not collect card details.
        </Text>
      </View>

      <View>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: form.depositTermsAccepted }}
          onPress={() => update('depositTermsAccepted', !form.depositTermsAccepted)}
          style={({ pressed }) => [
            styles.consentRow,
            errors.depositTermsAccepted && styles.consentError,
            pressed && styles.pressed,
          ]}
        >
          <CheckBox checked={form.depositTermsAccepted} />
          <Text style={styles.consentCopy}>
            I understand the $200 AUD deposit must be completed before my request is lodged, and my selected date remains pending until PSI confirms it.
          </Text>
        </Pressable>
        {errors.depositTermsAccepted ? <Text style={styles.error}>{errors.depositTermsAccepted}</Text> : null}
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
            I agree that PSI Performance may contact me about this booking request and send payment or booking updates.
          </Text>
        </Pressable>
        {errors.consent ? <Text style={styles.error}>{errors.consent}</Text> : null}
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(contact.privacy)}>
          <Text style={styles.privacyLink}>Read the privacy policy ↗</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
      {checked ? <Text style={styles.checkmark}>✓</Text> : null}
    </View>
  );
}

function SummaryRow({ label, value, secondary }: { label: string; value: string; secondary?: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.summaryValueWrap}>
        <Text style={styles.summaryValue}>{value}</Text>
        {secondary ? <Text style={styles.summarySecondary}>{secondary}</Text> : null}
      </View>
    </View>
  );
}

function CheckoutHandoff({
  checkout,
  onReopen,
  onHome,
}: {
  checkout: BookingCheckoutResult;
  onReopen: () => void;
  onHome: () => void;
}) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.successScreen}>
      <ScrollView contentContainerStyle={styles.successScroll}>
        <View style={styles.checkoutMark}>
          <Text style={styles.checkoutMarkText}>→</Text>
        </View>
        <Eyebrow>Secure checkout ready</Eyebrow>
        <Text style={styles.successTitle}>Complete payment securely.</Text>
        <Text style={styles.successLead}>
          PSI has prepared a {checkout.payment.provider} checkout. Complete payment there, then rely on the emailed receipt and PSI confirmation—not this screen—as proof of payment or a confirmed date.
        </Text>

        <View style={styles.checkoutReferenceCard}>
          <SummaryRow label="Request reference" value={checkout.reference} />
          <SummaryRow label="Deposit due" value={displayMoney(checkout.deposit.amountCents, checkout.deposit.currency)} />
          <SummaryRow label="Current state" value="Payment required" />
        </View>

        <View style={styles.notPaidCard}>
          <Text style={styles.notPaidTitle}>Payment is not confirmed here</Text>
          <Text style={styles.notPaidCopy}>
            Closing or returning from checkout does not prove payment. PSI will email a receipt after the server receives verified payment confirmation.
          </Text>
        </View>

        <View style={styles.successActions}>
          <PrimaryButton label="Open secure checkout" onPress={onReopen} />
          <PrimaryButton label="Return to PSI home" onPress={onHome} variant="outline" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.ink },
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
  backButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backArrow: { color: colors.gold, fontSize: 23 },
  backLabel: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  topBarBrand: { alignItems: 'flex-end', gap: 2 },
  topBarLogo: { width: 94, height: 35 },
  topBarCopy: { color: colors.gold, fontSize: 8, fontWeight: '900', letterSpacing: 0.9, textTransform: 'uppercase' },
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
  progressItem: { flex: 1, alignItems: 'center', gap: 5 },
  progressNumber: {
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  progressNumberActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  progressNumberText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  progressNumberTextActive: { color: colors.ink },
  progressLabel: { color: colors.mutedDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  progressLabelActive: { color: colors.white },
  formScroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  formInner: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  alert: { gap: spacing.sm, marginBottom: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.danger, backgroundColor: '#291515', padding: spacing.md },
  alertTitle: { color: colors.white, fontSize: 15, fontWeight: '900' },
  alertCopy: { color: '#FFD1CD', fontSize: 13, lineHeight: 19 },
  alertAssurance: { color: '#E8AAA4', fontSize: 11, fontWeight: '800' },
  alertLink: { color: colors.gold, fontSize: 13, fontWeight: '900', textDecorationLine: 'underline' },
  stepContent: { gap: spacing.xl },
  stepHeading: { gap: spacing.md },
  stepTitle: { color: colors.white, fontSize: 34, fontWeight: '900', letterSpacing: -1.5, lineHeight: 36, textTransform: 'uppercase' },
  stepIntro: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  choiceList: { gap: spacing.sm },
  error: { marginTop: spacing.sm, color: colors.danger, fontSize: 12, lineHeight: 17 },
  fields: { gap: spacing.lg },
  fieldRow: { gap: spacing.lg },
  fieldRowWide: { flexDirection: 'row' },
  fieldCell: { flex: 1 },
  notesInput: { minHeight: 150 },
  characterCount: { alignSelf: 'flex-end', color: colors.mutedDark, fontSize: 11 },
  accountNotice: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: spacing.md,
  },
  accountNoticeTitle: { color: colors.white, fontSize: 13, fontWeight: '900' },
  accountNoticeCopy: { marginTop: 4, color: colors.muted, fontSize: 11, lineHeight: 17 },
  accountNoticeArrow: { color: colors.gold, fontSize: 22 },
  datePrivacyCard: { gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.gold, backgroundColor: colors.panel, padding: spacing.md },
  datePrivacyTitle: { color: colors.white, fontSize: 13, fontWeight: '900' },
  datePrivacyCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  dateButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: colors.inkSoft,
    paddingHorizontal: spacing.md,
  },
  dateButtonError: { borderColor: colors.danger },
  dateText: { color: colors.white, fontSize: 16 },
  datePlaceholder: { color: colors.mutedDark },
  dateIcon: { color: colors.gold, fontSize: 22 },
  datePickerWrap: { overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 3, backgroundColor: colors.panel, padding: spacing.sm },
  dateDone: { alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dateDoneText: { color: colors.gold, fontSize: 14, fontWeight: '900' },
  compactChoices: { gap: spacing.sm },
  summaryCard: { borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, padding: spacing.lg },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingBottom: spacing.md },
  summaryKicker: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
  summaryReference: { color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  summaryRow: { minHeight: 69, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: spacing.md },
  summaryLabel: { width: 94, color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  summaryValueWrap: { flex: 1, gap: 4 },
  summaryValue: { color: colors.white, fontSize: 14, fontWeight: '900', lineHeight: 20 },
  summarySecondary: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  requestSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: spacing.md },
  requestSummaryText: { flex: 1, color: colors.cream, fontSize: 12, lineHeight: 19 },
  depositTotal: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.gold, paddingTop: spacing.lg },
  depositLabel: { color: colors.white, fontSize: 13, fontWeight: '900' },
  depositCurrency: { marginTop: 4, color: colors.muted, fontSize: 10 },
  depositValue: { color: colors.gold, fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  paymentCard: { gap: spacing.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.inkSoft, padding: spacing.md },
  paymentTitle: { color: colors.white, fontSize: 14, fontWeight: '900' },
  paymentCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  consentRow: { flexDirection: 'row', gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 3, backgroundColor: colors.panel, padding: spacing.md },
  consentError: { borderColor: colors.danger },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.muted, borderRadius: 2 },
  checkboxChecked: { borderColor: colors.gold, backgroundColor: colors.gold },
  checkmark: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  consentCopy: { flex: 1, color: colors.cream, fontSize: 13, lineHeight: 20 },
  privacyLink: { marginTop: spacing.md, color: colors.gold, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  actionsWide: { flexDirection: 'row' },
  actionButton: { flex: 1 },
  requestNote: { marginTop: spacing.md, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  successScreen: { flex: 1, backgroundColor: colors.ink },
  successScroll: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  checkoutMark: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, borderRadius: 36, backgroundColor: colors.gold },
  checkoutMarkText: { color: colors.ink, fontSize: 36, fontWeight: '900' },
  successTitle: { marginTop: spacing.md, color: colors.white, fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 44, textTransform: 'uppercase' },
  successLead: { marginTop: spacing.lg, color: colors.muted, fontSize: 15, lineHeight: 24 },
  checkoutReferenceCard: { marginTop: spacing.xl, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, paddingHorizontal: spacing.lg },
  notPaidCard: { gap: spacing.sm, marginTop: spacing.lg, borderLeftWidth: 3, borderLeftColor: colors.gold, backgroundColor: colors.panel, padding: spacing.md },
  notPaidTitle: { color: colors.white, fontSize: 13, fontWeight: '900' },
  notPaidCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  successActions: { gap: spacing.sm, marginTop: spacing.xl },
  pressed: { opacity: 0.72 },
});
