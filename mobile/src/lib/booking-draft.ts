import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  EMPTY_BOOKING,
  EMPTY_TUNING_DETAILS,
  type ArrivalArrangement,
  type BookingFormState,
  type BookingType,
  type SetupConfidence,
} from '@/lib/booking';

const DRAFT_VERSION = 1;
export const BOOKING_DRAFT_EXPIRY_DAYS = 30;
const DRAFT_LIFETIME_MS = BOOKING_DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1_000;

type StoredBookingDraft = {
  version: typeof DRAFT_VERSION;
  savedAt: number;
  expiresAt: number;
  form: unknown;
};

export type LoadedBookingDraft = {
  form: BookingFormState;
  savedAt: number;
  expiresAt: number;
};

function keyFor(type: BookingType) {
  return `@psi-performance/booking-draft/v${DRAFT_VERSION}/${type}`;
}

function stringValue(value: unknown, maxLength: number, fallback = '') {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback;
}

function realIsoDate(value: unknown) {
  if (typeof value !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : '';
}

function sanitiseDraftForm(value: unknown, bookingType: BookingType): BookingFormState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const rawTuning = raw.tuningDetails && typeof raw.tuningDetails === 'object' && !Array.isArray(raw.tuningDetails)
    ? raw.tuningDetails as Record<string, unknown>
    : {};
  const tuningDetails = Object.fromEntries(
    Object.keys(EMPTY_TUNING_DETAILS).map((key) => [key, stringValue(rawTuning[key], 2_000)]),
  ) as BookingFormState['tuningDetails'];
  return {
    ...EMPTY_BOOKING,
    bookingType,
    requestDetails: stringValue(raw.requestDetails, 1_200),
    firstName: stringValue(raw.firstName, 80),
    lastName: stringValue(raw.lastName, 80),
    email: stringValue(raw.email, 254),
    mobile: stringValue(raw.mobile, 32),
    vehicleMake: stringValue(raw.vehicleMake, 60),
    vehicleModel: stringValue(raw.vehicleModel, 80),
    vehicleYear: stringValue(raw.vehicleYear, 4),
    registration: stringValue(raw.registration, 20),
    vin: stringValue(raw.vin, 17),
    appointmentPreferenceMode: oneOf(raw.appointmentPreferenceMode, ['specific', 'flexible'] as const, 'specific'),
    preferredDate: realIsoDate(raw.preferredDate),
    arrivalArrangement: oneOf<ArrivalArrangement>(
      raw.arrivalArrangement,
      ['business_hours', 'before_hours_drop_off', 'after_hours_drop_off', 'flexible'],
      'flexible',
    ),
    afterHoursCollection: booleanValue(raw.afterHoursCollection),
    notifyEarlierAvailability: booleanValue(raw.notifyEarlierAvailability),
    // Optional rebooking messages require a fresh affirmative choice.
    serviceReminderConsent: false,
    setupConfidence: bookingType === 'dyno'
      ? oneOf<SetupConfidence>(raw.setupConfidence, ['', 'known', 'psi_inspection'], '')
      : '',
    // Fresh acknowledgement is required for every submission, even after a draft restore.
    consent: false,
    bookingTermsAccepted: false,
    tuningDetails,
  };
}

export async function loadBookingDraft(bookingType: BookingType): Promise<LoadedBookingDraft | null> {
  const stored = await AsyncStorage.getItem(keyFor(bookingType));
  if (!stored) return null;
  let parsed: StoredBookingDraft;
  try {
    parsed = JSON.parse(stored) as StoredBookingDraft;
  } catch {
    await AsyncStorage.removeItem(keyFor(bookingType));
    return null;
  }
  const now = Date.now();
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.version !== DRAFT_VERSION ||
    !Number.isFinite(parsed.savedAt) ||
    !Number.isFinite(parsed.expiresAt) ||
    parsed.savedAt < 0 ||
    parsed.savedAt > now + 5 * 60 * 1_000 ||
    parsed.expiresAt <= now ||
    parsed.expiresAt < parsed.savedAt ||
    parsed.expiresAt > parsed.savedAt + DRAFT_LIFETIME_MS
  ) {
    await AsyncStorage.removeItem(keyFor(bookingType));
    return null;
  }
  const form = sanitiseDraftForm(parsed.form, bookingType);
  if (!form) {
    await AsyncStorage.removeItem(keyFor(bookingType));
    return null;
  }
  return { form, savedAt: parsed.savedAt, expiresAt: parsed.expiresAt };
}

export async function saveBookingDraft(bookingType: BookingType, form: BookingFormState) {
  const savedAt = Date.now();
  const draft: StoredBookingDraft = {
    version: DRAFT_VERSION,
    savedAt,
    expiresAt: savedAt + DRAFT_LIFETIME_MS,
    form: { ...form, consent: false, bookingTermsAccepted: false },
  };
  await AsyncStorage.setItem(keyFor(bookingType), JSON.stringify(draft));
  return { savedAt: draft.savedAt, expiresAt: draft.expiresAt };
}

export async function clearBookingDraft(bookingType: BookingType) {
  await AsyncStorage.removeItem(keyFor(bookingType));
}
