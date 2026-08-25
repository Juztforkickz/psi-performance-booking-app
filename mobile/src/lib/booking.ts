import type { Database } from '@/lib/database.types';
import { getSupabaseClient, SUPABASE_CONNECTION } from '@/lib/supabase';
import { dispatchBookingPushNotifications } from '@/lib/notifications';

export type BookingType = 'service' | 'dyno';
export type AppointmentPreferenceMode = 'specific' | 'flexible';
export type ArrivalArrangement =
  | 'business_hours'
  | 'before_hours_drop_off'
  | 'after_hours_drop_off'
  | 'flexible';
export type SetupConfidence = '' | 'known' | 'psi_inspection';

export type TuningDetails = {
  engineState: '' | 'stock' | 'modified';
  engineModifications: string;
  transmissionType: '' | 'automatic' | 'manual';
  transmissionSetup: '' | 'stock' | 'converter' | 'trans_cooler' | 'converter_and_cooler' | 'upgraded_clutch' | 'built_transmission' | 'other';
  transmissionDetails: string;
  differentialType: '' | 'stock' | 'truetrac' | 'wavetrac' | 'other';
  differentialGearRatio: string;
  differentialDetails: string;
  fuelPumpType: '' | 'stock' | 'upgraded' | 'unknown';
  fuelPumpDetails: string;
  injectorType: '' | 'stock' | 'upgraded' | 'unknown';
  injectorDetails: string;
  fuelType: '' | '98_ron' | 'e85' | 'flex_fuel' | 'race_fuel' | 'other';
  fuelTypeDetails: string;
  intakeType: '' | 'stock' | 'upgraded';
  intakeDetails: string;
  previouslyTuned: '' | 'no' | 'yes' | 'unknown';
  previousTuner: string;
  exhaustType: '' | 'stock' | 'cat_back' | 'downpipe' | 'full_system' | 'custom';
  exhaustSize: '' | 'stock' | '2_5_inch' | '3_inch' | '3_5_inch' | '4_inch' | 'other';
  headerExtractorDownpipeSize: '' | 'stock' | '1_5_8_inch' | '1_3_4_inch' | '1_7_8_inch' | '2_inch' | '2_25_inch' | '2_5_inch' | '3_inch' | '3_5_inch' | '4_inch' | 'other';
  varexControlled: '' | 'no' | 'yes' | 'unknown';
  exhaustDetails: string;
  camshaftType: '' | 'stock' | 'upgraded' | 'unknown';
  camshaftDetails: string;
};

export const BOOKING_POLICY_VERSION = 'psi-booking-v1';

export const BOOKING_PURPOSES = {
  service: {
    label: 'Service & Report',
    priceGuide: 'From $423.50 incl. GST',
    priceGuideAmountCents: 42_350,
    depositAmountCents: 10_000,
    eligibleDays: 'Monday–Friday',
  },
  dyno: {
    label: 'Dyno Tuning',
    priceGuide: 'From $649 incl. GST',
    priceGuideAmountCents: 64_900,
    depositAmountCents: 30_000,
    eligibleDays: 'Monday, Wednesday & Thursday',
  },
} as const;

export function depositAmountForBookingType(type: BookingType | ''): number | null {
  if (type === 'service' || type === 'dyno') return BOOKING_PURPOSES[type].depositAmountCents;
  return null;
}

export type BookingFormState = {
  bookingType: BookingType | '';
  requestDetails: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  registration: string;
  vin: string;
  appointmentPreferenceMode: AppointmentPreferenceMode;
  preferredDate: string;
  arrivalArrangement: ArrivalArrangement;
  afterHoursCollection: boolean;
  notifyEarlierAvailability: boolean;
  serviceReminderConsent: boolean;
  setupConfidence: SetupConfidence;
  consent: boolean;
  bookingTermsAccepted: boolean;
  tuningDetails: TuningDetails;
};

export type BookingRequestResult = {
  reference: string;
  state: 'pending_staff_review';
  paymentRequiredNow: false;
  message: string;
};

export const EMPTY_TUNING_DETAILS: TuningDetails = {
  engineState: '', engineModifications: '', transmissionType: '', transmissionSetup: '', transmissionDetails: '',
  differentialType: '', differentialGearRatio: '', differentialDetails: '', fuelPumpType: '', fuelPumpDetails: '',
  injectorType: '', injectorDetails: '', fuelType: '', fuelTypeDetails: '', intakeType: '', intakeDetails: '',
  previouslyTuned: '', previousTuner: '', exhaustType: '', exhaustSize: '', headerExtractorDownpipeSize: '',
  varexControlled: '', exhaustDetails: '', camshaftType: '', camshaftDetails: '',
};

export const EMPTY_BOOKING: BookingFormState = {
  bookingType: '', requestDetails: '', firstName: '', lastName: '', email: '', mobile: '', vehicleMake: '',
  vehicleModel: '', vehicleYear: '', registration: '', vin: '', appointmentPreferenceMode: 'specific', preferredDate: '',
  arrivalArrangement: 'flexible', afterHoursCollection: false, notifyEarlierAvailability: false,
  serviceReminderConsent: false, setupConfidence: '', consent: false, bookingTermsAccepted: false,
  tuningDetails: { ...EMPTY_TUNING_DETAILS },
};

export type TuningFieldKey = `tuningDetails.${keyof TuningDetails}`;
export type BookingErrorKey = Exclude<keyof BookingFormState, 'tuningDetails'> | 'tuningDetails' | TuningFieldKey;
export type BookingErrors = Partial<Record<BookingErrorKey, string>>;

export class BookingApiError extends Error {
  code: string;
  fieldErrors: BookingErrors;
  status: number;

  constructor(message: string, fieldErrors: BookingErrors = {}, code = 'REQUEST_FAILED', status = 0) {
    super(message);
    this.name = 'BookingApiError';
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}

export function localIsoDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

export function displayDate(value: string) {
  if (!value) return 'Choose a date';
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).format(dateFromIso(value));
}

export function displayMoney(amountCents: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amountCents / 100);
}

export function maxBookingDate() {
  const [year, month, day] = localIsoDate(new Date()).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  date.setUTCMonth(date.getUTCMonth() + 18);
  return date;
}

export function isEligibleBookingDate(type: BookingType | '', isoDate: string) {
  if (!type || !isoDate) return false;
  const weekday = dateFromIso(isoDate).getUTCDay();
  if (type === 'service') return weekday >= 1 && weekday <= 5;
  return weekday === 1 || weekday === 3 || weekday === 4;
}

function isValidBookingEmail(rawValue: string) {
  const value = rawValue.trim();
  if (value.length === 0 || value.length > 254) return false;
  const separator = value.indexOf('@');
  if (separator <= 0 || separator !== value.lastIndexOf('@')) return false;
  const localPart = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  if (localPart.length > 64 || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..') || !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/iu.test(localPart)) return false;
  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2) return false;
  const validLabel = /^[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?$/iu;
  if (labels.some((label) => !validLabel.test(label))) return false;
  const topLevelDomain = labels.at(-1) ?? '';
  return /^[A-Z]{2,63}$/iu.test(topLevelDomain) || /^XN--[A-Z0-9-]{2,59}$/iu.test(topLevelDomain);
}

function isValidBookingMobile(rawValue: string) {
  const value = rawValue.trim();
  const digits = value.replace(/\D/gu, '');
  return /^\+?[\d() .-]+$/u.test(value) && digits.length >= 8 && digits.length <= 15;
}

function validateKnownTuning(tuning: TuningDetails, errors: BookingErrors) {
  if (!tuning.engineState) errors['tuningDetails.engineState'] = 'Choose whether the engine is stock or modified.';
  if (tuning.engineState === 'modified' && tuning.engineModifications.trim().length < 3) errors['tuningDetails.engineModifications'] = 'List the engine modifications.';
  if (!tuning.transmissionType) errors['tuningDetails.transmissionType'] = 'Choose automatic or manual.';
  if (!tuning.transmissionSetup) errors['tuningDetails.transmissionSetup'] = 'Choose the transmission setup.';
  if (tuning.transmissionSetup && tuning.transmissionSetup !== 'stock' && tuning.transmissionDetails.trim().length < 3) errors['tuningDetails.transmissionDetails'] = 'Tell PSI exactly what transmission equipment is fitted.';
  if (!tuning.differentialType) errors['tuningDetails.differentialType'] = 'Choose the differential type.';
  if (!tuning.differentialGearRatio.trim()) errors['tuningDetails.differentialGearRatio'] = 'Enter the differential gear ratio.';
  if (tuning.differentialType === 'other' && tuning.differentialDetails.trim().length < 3) errors['tuningDetails.differentialDetails'] = 'Describe the differential setup.';
  if (!tuning.fuelPumpType) errors['tuningDetails.fuelPumpType'] = 'Choose the fuel pump setup.';
  if (tuning.fuelPumpType === 'upgraded' && tuning.fuelPumpDetails.trim().length < 3) errors['tuningDetails.fuelPumpDetails'] = 'Enter the upgraded fuel pump details.';
  if (!tuning.injectorType) errors['tuningDetails.injectorType'] = 'Choose the injector setup.';
  if (tuning.injectorType === 'upgraded' && tuning.injectorDetails.trim().length < 3) errors['tuningDetails.injectorDetails'] = 'Enter the injector brand and size.';
  if (!tuning.fuelType) errors['tuningDetails.fuelType'] = 'Choose the fuel PSI will tune for.';
  if (tuning.fuelType === 'other' && tuning.fuelTypeDetails.trim().length < 3) errors['tuningDetails.fuelTypeDetails'] = 'Enter the fuel details.';
  if (!tuning.intakeType) errors['tuningDetails.intakeType'] = 'Choose the intake setup.';
  if (tuning.intakeType === 'upgraded' && tuning.intakeDetails.trim().length < 3) errors['tuningDetails.intakeDetails'] = 'Enter the upgraded intake details.';
  if (!tuning.previouslyTuned) errors['tuningDetails.previouslyTuned'] = 'Tell PSI whether the vehicle has been tuned before.';
  if (tuning.previouslyTuned === 'yes' && tuning.previousTuner.trim().length < 2) errors['tuningDetails.previousTuner'] = 'Enter who previously tuned the vehicle.';
  if (!tuning.exhaustType) errors['tuningDetails.exhaustType'] = 'Choose the exhaust setup.';
  if (!tuning.exhaustSize) errors['tuningDetails.exhaustSize'] = 'Choose the exhaust size.';
  if (!tuning.headerExtractorDownpipeSize) errors['tuningDetails.headerExtractorDownpipeSize'] = 'Choose the header, extractor or downpipe size.';
  if (!tuning.varexControlled) errors['tuningDetails.varexControlled'] = 'Tell PSI whether Varex control is fitted.';
  if (tuning.exhaustType && tuning.exhaustType !== 'stock' && tuning.exhaustDetails.trim().length < 3) errors['tuningDetails.exhaustDetails'] = 'Describe the exhaust modifications.';
  if (!tuning.camshaftType) errors['tuningDetails.camshaftType'] = 'Choose the camshaft setup.';
  if (tuning.camshaftType === 'upgraded' && tuning.camshaftDetails.trim().length < 3) errors['tuningDetails.camshaftDetails'] = 'Enter the camshaft code or specifications.';
}

export function validateBookingStep(form: BookingFormState, step: number): BookingErrors {
  const errors: BookingErrors = {};
  if (step === 1) {
    if (!form.bookingType) errors.bookingType = 'Choose Service & Report or Dyno Tuning from the PSI home screen.';
    if (form.requestDetails.trim().length < 10) errors.requestDetails = 'Tell PSI what you need in at least 10 characters.';
    if (form.bookingType === 'dyno') {
      if (!form.setupConfidence) errors.setupConfidence = 'Tell PSI whether you know the vehicle setup or want PSI to inspect it.';
      if (form.setupConfidence === 'known') validateKnownTuning(form.tuningDetails, errors);
    }
  }
  if (step === 2) {
    if (!form.vehicleMake.trim()) errors.vehicleMake = 'Enter the vehicle make.';
    if (!form.vehicleModel.trim()) errors.vehicleModel = 'Enter the vehicle model.';
    const year = Number(form.vehicleYear);
    const latestYear = Number(localIsoDate(new Date()).slice(0, 4)) + 1;
    if (!Number.isInteger(year) || year < 1900 || year > latestYear) errors.vehicleYear = `Enter a year between 1900 and ${latestYear}.`;
    if (!form.registration.trim()) errors.registration = 'Enter the registration.';
    else if (!/^[A-Z0-9][A-Z0-9 .-]*$/u.test(form.registration.trim().toUpperCase())) errors.registration = 'Use only letters, numbers, spaces, dots or hyphens.';
    if (form.vin && !/^[A-HJ-NPR-Z0-9]{17}$/u.test(form.vin.trim().toUpperCase())) errors.vin = 'Enter a 17-character VIN. The letters I, O and Q are not used.';
  }
  if (step === 3) {
    if (!form.firstName.trim()) errors.firstName = 'Enter your first name.';
    if (!form.lastName.trim()) errors.lastName = 'Enter your last name.';
    if (!isValidBookingEmail(form.email)) errors.email = 'Enter a valid email address.';
    if (!isValidBookingMobile(form.mobile)) errors.mobile = 'Use 8 to 15 digits and only +, spaces, brackets, dots or hyphens.';
  }
  if (step === 4 && form.appointmentPreferenceMode === 'specific') {
    if (!form.preferredDate) errors.preferredDate = 'Choose a preferred date or select “I’m flexible”.';
    else {
      const today = localIsoDate(new Date());
      const latestDate = localIsoDate(maxBookingDate());
      if (form.preferredDate < today) errors.preferredDate = 'Choose today or a future date.';
      if (form.preferredDate > latestDate) errors.preferredDate = 'Choose a date within the next 18 months.';
      if (!errors.preferredDate && !isEligibleBookingDate(form.bookingType, form.preferredDate)) {
        errors.preferredDate = form.bookingType === 'dyno'
          ? 'Dyno requests are currently available Monday, Wednesday or Thursday.'
          : 'Service requests are available Monday to Friday.';
      }
    }
  }
  if (step === 5) {
    if (!form.consent) errors.consent = 'Please agree so PSI can contact you about this request.';
    if (!form.bookingTermsAccepted) errors.bookingTermsAccepted = 'Acknowledge the approval, deposit and booking policy.';
  }
  return errors;
}

export function bookingRequestApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!configured) throw new Error('PSI booking requests are not connected in this preview. No details were sent or saved online.');
  let origin: URL;
  try { origin = new URL(configured); } catch { throw new Error('PSI booking requests have an invalid server address. No details were sent.'); }
  const localDevelopmentHost = ['localhost', '127.0.0.1', '10.0.2.2'].includes(origin.hostname);
  const secureProductionOrigin = origin.protocol === 'https:';
  const permittedDevelopmentOrigin = __DEV__ && origin.protocol === 'http:' && localDevelopmentHost;
  if ((!secureProductionOrigin && !permittedDevelopmentOrigin) || origin.username || origin.password || origin.search || origin.hash || (origin.pathname !== '/' && origin.pathname !== '')) {
    throw new Error('PSI booking requests require a verified HTTPS server address. No details were sent.');
  }
  return `${origin.origin}/api/v1/booking-requests`;
}

function normaliseApiFieldErrors(fields: unknown): BookingErrors {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};
  const fieldErrors: BookingErrors = {};
  const allowedTuningKeys = new Set(Object.keys(EMPTY_TUNING_DETAILS));
  const aliases: Record<string, BookingErrorKey> = {
    appointmentPreference: 'preferredDate',
    'appointmentPreference.mode': 'appointmentPreferenceMode',
    'appointmentPreference.preferredDate': 'preferredDate',
    setupConfidence: 'setupConfidence',
    bookingPolicyVersion: 'bookingTermsAccepted',
  };
  const addError = (key: string, value: unknown) => {
    const formKey = aliases[key] || key;
    const allowedTopLevel = formKey in EMPTY_BOOKING && formKey !== 'tuningDetails';
    const tuningKey = formKey.startsWith('tuningDetails.') ? formKey.slice('tuningDetails.'.length) : '';
    if (!allowedTopLevel && !allowedTuningKeys.has(tuningKey) && formKey !== 'tuningDetails') return;
    const message = Array.isArray(value) ? value.filter((item) => typeof item === 'string').join(' ') : value;
    if (typeof message === 'string' && message.trim()) fieldErrors[formKey as BookingErrorKey] = message.trim();
  };
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'tuningDetails' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) addError(`tuningDetails.${nestedKey}`, nestedValue);
    } else addError(key, value);
  }
  return fieldErrors;
}

type RequestErrorPayload = { error?: string | { code?: string; message?: string; fields?: unknown } };

function isBookingRequestResult(value: unknown): value is BookingRequestResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Partial<BookingRequestResult>;
  return typeof result.reference === 'string' && result.reference.trim().length > 0
    && result.state === 'pending_staff_review' && result.paymentRequiredNow === false
    && typeof result.message === 'string' && result.message.trim().length > 0;
}

function compactTuningDetails(tuning: TuningDetails, includeAll: boolean) {
  return Object.fromEntries(Object.entries(tuning).filter(([, value]) => includeAll || value.trim().length > 0));
}

export async function createBookingRequest(form: BookingFormState, idempotencyKey: string, vehicleId?: string): Promise<BookingRequestResult> {
  if (idempotencyKey.trim().length < 16) throw new Error('This request could not be safely identified. Please restart the booking.');
  if (SUPABASE_CONNECTION.bookingEnabled) {
    if (!vehicleId) throw new Error('Choose a vehicle saved in your private PSI account before submitting this request.');
    return createAuthenticatedBookingRequest(form, idempotencyKey, vehicleId);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const appointmentPreference = form.appointmentPreferenceMode === 'specific'
      ? { mode: 'specific' as const, preferredDate: form.preferredDate }
      : { mode: 'flexible' as const };
    const response = await fetch(bookingRequestApiUrl(), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      signal: controller.signal,
      body: JSON.stringify({
        bookingType: form.bookingType,
        firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim(), vehicleMake: form.vehicleMake.trim(), vehicleModel: form.vehicleModel.trim(),
        vehicleYear: Number(form.vehicleYear), registration: form.registration.trim().toUpperCase(),
        ...(form.vin.trim() ? { vin: form.vin.trim().toUpperCase() } : {}),
        appointmentPreference, arrivalArrangement: form.arrivalArrangement,
        afterHoursCollection: form.afterHoursCollection, notifyEarlierAvailability: form.notifyEarlierAvailability,
        serviceReminderConsent: form.bookingType === 'service' && form.serviceReminderConsent,
        requestDetails: form.requestDetails.trim(), source: 'mobile', consent: true, bookingTermsAccepted: true,
        bookingPolicyVersion: BOOKING_POLICY_VERSION, company: '',
        ...(form.bookingType === 'dyno' ? {
          setupConfidence: form.setupConfidence,
          ...(form.setupConfidence === 'known'
            ? { tuningDetails: compactTuningDetails(form.tuningDetails, true) }
            : {}),
        } : {}),
      }),
    });
    const raw = await response.text();
    let data: BookingRequestResult | RequestErrorPayload | null = null;
    try { data = raw ? JSON.parse(raw) as BookingRequestResult | RequestErrorPayload : null; } catch { data = null; }
    if (!response.ok) {
      const apiError = data && 'error' in data ? data.error : undefined;
      const code = typeof apiError === 'object' ? apiError?.code || 'REQUEST_FAILED' : 'REQUEST_FAILED';
      const message = typeof apiError === 'string' ? apiError : apiError?.message || 'Your request could not be submitted. Please try again.';
      const fieldErrors = typeof apiError === 'object' ? normaliseApiFieldErrors(apiError?.fields) : {};
      throw new BookingApiError(message, fieldErrors, code, response.status);
    }
    if (!isBookingRequestResult(data)) throw new Error('PSI received an unexpected response. No booking, payment, email or calendar event has been confirmed.');
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The request timed out. Nothing has been confirmed. Please try again.');
    if (error instanceof TypeError) throw new Error('We could not reach PSI booking requests. Nothing has been confirmed. Check your connection and try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}

async function createAuthenticatedBookingRequest(
  form: BookingFormState,
  idempotencyKey: string,
  vehicleId: string,
): Promise<BookingRequestResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(idempotencyKey)) {
    throw new Error('This request could not be safely identified. Please restart the booking.');
  }
  if (form.bookingType !== 'service' && form.bookingType !== 'dyno') throw new Error('Choose a booking type before submitting.');

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user?.email) throw userError ?? new Error('Sign in to your approved PSI account before submitting a booking request.');

  const [profileResult, vehicleResult] = await Promise.all([
    supabase.from('customer_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('customer_vehicles').select('*').eq('id', vehicleId).eq('customer_id', user.id).is('archived_at', null).maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (vehicleResult.error) throw vehicleResult.error;
  if (!profileResult.data || profileResult.data.account_state !== 'active') throw new Error('Complete your private PSI account profile before submitting a booking request.');
  if (!vehicleResult.data) throw new Error('That vehicle is not available in your private PSI account. No request was submitted.');

  const identityErrors: BookingErrors = {};
  if (normaliseIdentity(form.email) !== normaliseIdentity(user.email)) identityErrors.email = 'Use the verified email shown in your PSI account.';
  if (normaliseIdentity(form.firstName) !== normaliseIdentity(profileResult.data.first_name ?? '')) identityErrors.firstName = 'Update your first name in Account before booking.';
  if (normaliseIdentity(form.lastName) !== normaliseIdentity(profileResult.data.last_name ?? '')) identityErrors.lastName = 'Update your last name in Account before booking.';
  if (normalisePhone(form.mobile) !== normalisePhone(profileResult.data.mobile ?? '')) identityErrors.mobile = 'Update your mobile number in Account before booking.';
  if (normaliseIdentity(form.vehicleMake) !== normaliseIdentity(vehicleResult.data.make)) identityErrors.vehicleMake = 'Use the make saved for this vehicle in My Garage.';
  if (normaliseIdentity(form.vehicleModel) !== normaliseIdentity(vehicleResult.data.model)) identityErrors.vehicleModel = 'Use the model saved for this vehicle in My Garage.';
  if (Number(form.vehicleYear) !== vehicleResult.data.year) identityErrors.vehicleYear = 'Use the year saved for this vehicle in My Garage.';
  if (normaliseIdentity(form.registration) !== normaliseIdentity(vehicleResult.data.registration)) identityErrors.registration = 'Use the registration saved for this vehicle in My Garage.';
  if (Object.keys(identityErrors).length > 0) {
    throw new BookingApiError('Your booking details no longer match the protected account record. Update Account or restart from My Garage.', identityErrors, 'ACCOUNT_DETAILS_CHANGED', 409);
  }

  const payload: Database['public']['Tables']['booking_requests']['Insert'] = {
    booking_type: form.bookingType,
    client_request_id: idempotencyKey,
    created_by: user.id,
    currency: 'AUD',
    customer_id: user.id,
    preferred_date: form.appointmentPreferenceMode === 'specific' ? form.preferredDate : null,
    request_context: {
      afterHoursCollection: form.afterHoursCollection,
      appointmentPreferenceMode: form.appointmentPreferenceMode,
      arrivalArrangement: form.arrivalArrangement,
      bookingPolicyVersion: BOOKING_POLICY_VERSION,
      notifyEarlierAvailability: form.notifyEarlierAvailability,
      schemaVersion: 1,
      serviceReminderConsent: form.bookingType === 'service' && form.serviceReminderConsent,
      ...(form.bookingType === 'dyno' ? {
        setupConfidence: form.setupConfidence,
        ...(form.setupConfidence === 'known' ? { tuningDetails: compactTuningDetails(form.tuningDetails, true) } : {}),
      } : {}),
    },
    request_notes: form.requestDetails.trim(),
    state: 'pending_staff_review',
    vehicle_id: vehicleId,
  };
  const insertResult = await supabase.from('booking_requests').insert(payload).select('*').single();
  let booking = insertResult.data;
  if (insertResult.error) {
    if (insertResult.error.code !== '23505') throw insertResult.error;
    const existingResult = await supabase
      .from('booking_requests')
      .select('*')
      .eq('customer_id', user.id)
      .eq('client_request_id', idempotencyKey)
      .maybeSingle();
    if (existingResult.error || !existingResult.data) throw existingResult.error ?? insertResult.error;
    booking = existingResult.data;
  }
  if (!booking) throw new Error('PSI could not verify that the request was stored. No success is being claimed.');

  await dispatchBookingPushNotifications(booking.id).catch(() => undefined);

  return {
    reference: `PSI-${booking.id.slice(0, 8).toUpperCase()}`,
    state: 'pending_staff_review',
    paymentRequiredNow: false,
    message: 'Your request is saved in your private PSI account for workshop review. No payment, confirmed date, email or calendar event has been created yet.',
  };
}

function normaliseIdentity(value: string) {
  return value.trim().toLocaleLowerCase('en-AU');
}

function normalisePhone(value: string) {
  return value.replace(/\D/gu, '');
}
