export type BookingType = 'service' | 'dyno';
export type ArrivalWindow = 'morning' | 'afternoon' | 'any';

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
  exhaustType: '' | 'stock' | 'cat_back' | 'full_system' | 'custom';
  exhaustSize: '' | 'stock' | '2_5_inch' | '3_inch' | '3_5_inch' | '4_inch' | 'other';
  varexControlled: '' | 'no' | 'yes' | 'unknown';
  exhaustDetails: string;
  camshaftType: '' | 'stock' | 'upgraded' | 'unknown';
  camshaftDetails: string;
};

export const DEPOSIT_CURRENCY = 'AUD';
export const DEPOSIT_POLICY_VERSION = 'psi-deposit-v2';

export const BOOKING_PURPOSES = {
  service: {
    label: 'Service & Report',
    priceGuide: 'From $385 + GST',
    priceGuideAmountCents: 38_500,
    depositAmountCents: 10_000,
  },
  dyno: {
    label: 'Dyno tuning',
    priceGuide: 'From $695 + GST',
    priceGuideAmountCents: 69_500,
    depositAmountCents: 30_000,
  },
} as const;

export const MIN_DEPOSIT_CENTS = Math.min(
  BOOKING_PURPOSES.service.depositAmountCents,
  BOOKING_PURPOSES.dyno.depositAmountCents,
);

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
  preferredDate: string;
  arrivalWindow: ArrivalWindow;
  consent: boolean;
  depositTermsAccepted: boolean;
  tuningDetails: TuningDetails;
};

export type BookingCheckoutResult = {
  checkoutId: string;
  reference: string;
  state: 'requires_payment';
  deposit: {
    amountCents: number;
    currency: string;
  };
  payment: {
    provider: string;
    checkoutUrl: string;
  };
};

export const EMPTY_TUNING_DETAILS: TuningDetails = {
  engineState: '',
  engineModifications: '',
  transmissionType: '',
  transmissionSetup: '',
  transmissionDetails: '',
  differentialType: '',
  differentialGearRatio: '',
  differentialDetails: '',
  fuelPumpType: '',
  fuelPumpDetails: '',
  injectorType: '',
  injectorDetails: '',
  fuelType: '',
  fuelTypeDetails: '',
  intakeType: '',
  intakeDetails: '',
  previouslyTuned: '',
  previousTuner: '',
  exhaustType: '',
  exhaustSize: '',
  varexControlled: '',
  exhaustDetails: '',
  camshaftType: '',
  camshaftDetails: '',
};

export const EMPTY_BOOKING: BookingFormState = {
  bookingType: '',
  requestDetails: '',
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  registration: '',
  vin: '',
  preferredDate: '',
  arrivalWindow: 'any',
  consent: false,
  depositTermsAccepted: false,
  tuningDetails: { ...EMPTY_TUNING_DETAILS },
};

export type TuningFieldKey = `tuningDetails.${keyof TuningDetails}`;
export type BookingErrorKey = Exclude<keyof BookingFormState, 'tuningDetails'> | 'tuningDetails' | TuningFieldKey;
export type BookingErrors = Partial<Record<BookingErrorKey, string>>;

export class BookingApiError extends Error {
  code: string;
  fieldErrors: BookingErrors;
  status: number;

  constructor(message: string, fieldErrors: BookingErrors = {}, code = 'CHECKOUT_FAILED', status = 0) {
    super(message);
    this.name = 'BookingApiError';
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}

export function localIsoDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
    timeZone: 'Australia/Melbourne',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dateFromIso(value));
}

export function displayMoney(amountCents: number, currency = DEPOSIT_CURRENCY) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function maxBookingDate() {
  const [year, month, day] = localIsoDate(new Date()).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  date.setUTCMonth(date.getUTCMonth() + 18);
  return date;
}

function isValidBookingEmail(rawValue: string) {
  const value = rawValue.trim();
  if (value.length === 0 || value.length > 254) return false;

  const separator = value.indexOf('@');
  if (separator <= 0 || separator !== value.lastIndexOf('@')) return false;

  const localPart = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  if (
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/iu.test(localPart)
  ) {
    return false;
  }

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

export function validateBookingStep(form: BookingFormState, step: number): BookingErrors {
  const errors: BookingErrors = {};

  if (step === 1) {
    if (!form.bookingType) errors.bookingType = 'Choose Service & Report or Dyno tuning.';
    if (form.requestDetails.trim().length < 10) {
      errors.requestDetails = 'Tell PSI what you need in at least 10 characters.';
    }

    if (form.bookingType === 'dyno') {
      const tuning = form.tuningDetails;
      if (!tuning.engineState) errors['tuningDetails.engineState'] = 'Choose whether the engine is stock or modified.';
      if (tuning.engineState === 'modified' && tuning.engineModifications.trim().length < 3) {
        errors['tuningDetails.engineModifications'] = 'List the engine modifications.';
      }
      if (!tuning.transmissionType) errors['tuningDetails.transmissionType'] = 'Choose automatic or manual.';
      if (!tuning.transmissionSetup) errors['tuningDetails.transmissionSetup'] = 'Choose the transmission setup.';
      if (tuning.transmissionSetup && tuning.transmissionSetup !== 'stock' && tuning.transmissionDetails.trim().length < 3) {
        errors['tuningDetails.transmissionDetails'] = 'Tell PSI exactly what transmission equipment is fitted.';
      }
      if (!tuning.differentialType) errors['tuningDetails.differentialType'] = 'Choose the differential type.';
      if (!tuning.differentialGearRatio.trim()) errors['tuningDetails.differentialGearRatio'] = 'Enter the differential gear ratio.';
      if (tuning.differentialType === 'other' && tuning.differentialDetails.trim().length < 3) {
        errors['tuningDetails.differentialDetails'] = 'Describe the differential setup.';
      }
      if (!tuning.fuelPumpType) errors['tuningDetails.fuelPumpType'] = 'Choose the fuel pump setup.';
      if (tuning.fuelPumpType === 'upgraded' && tuning.fuelPumpDetails.trim().length < 3) {
        errors['tuningDetails.fuelPumpDetails'] = 'Enter the upgraded fuel pump details.';
      }
      if (!tuning.injectorType) errors['tuningDetails.injectorType'] = 'Choose the injector setup.';
      if (tuning.injectorType === 'upgraded' && tuning.injectorDetails.trim().length < 3) {
        errors['tuningDetails.injectorDetails'] = 'Enter the injector brand and size.';
      }
      if (!tuning.fuelType) errors['tuningDetails.fuelType'] = 'Choose the fuel PSI will tune for.';
      if (tuning.fuelType === 'other' && tuning.fuelTypeDetails.trim().length < 3) {
        errors['tuningDetails.fuelTypeDetails'] = 'Enter the fuel details.';
      }
      if (!tuning.intakeType) errors['tuningDetails.intakeType'] = 'Choose the intake setup.';
      if (tuning.intakeType === 'upgraded' && tuning.intakeDetails.trim().length < 3) {
        errors['tuningDetails.intakeDetails'] = 'Enter the upgraded intake details.';
      }
      if (!tuning.previouslyTuned) errors['tuningDetails.previouslyTuned'] = 'Tell PSI whether the vehicle has been tuned before.';
      if (tuning.previouslyTuned === 'yes' && tuning.previousTuner.trim().length < 2) {
        errors['tuningDetails.previousTuner'] = 'Enter who previously tuned the vehicle.';
      }
      if (!tuning.exhaustType) errors['tuningDetails.exhaustType'] = 'Choose the exhaust setup.';
      if (!tuning.exhaustSize) errors['tuningDetails.exhaustSize'] = 'Choose the exhaust size.';
      if (!tuning.varexControlled) errors['tuningDetails.varexControlled'] = 'Tell PSI whether Varex control is fitted.';
      if (tuning.exhaustType && tuning.exhaustType !== 'stock' && tuning.exhaustDetails.trim().length < 3) {
        errors['tuningDetails.exhaustDetails'] = 'Describe the exhaust modifications.';
      }
      if (!tuning.camshaftType) errors['tuningDetails.camshaftType'] = 'Choose the camshaft setup.';
      if (tuning.camshaftType === 'upgraded' && tuning.camshaftDetails.trim().length < 3) {
        errors['tuningDetails.camshaftDetails'] = 'Enter the camshaft code or specifications.';
      }
    }
  }

  if (step === 2) {
    if (!form.vehicleMake.trim()) errors.vehicleMake = 'Enter the vehicle make.';
    if (!form.vehicleModel.trim()) errors.vehicleModel = 'Enter the vehicle model.';
    const year = Number(form.vehicleYear);
    const latestYear = Number(localIsoDate(new Date()).slice(0, 4)) + 1;
    if (!Number.isInteger(year) || year < 1900 || year > latestYear) {
      errors.vehicleYear = `Enter a year between 1900 and ${latestYear}.`;
    }
    if (!form.registration.trim()) errors.registration = 'Enter the registration.';
    else if (!/^[A-Z0-9][A-Z0-9 .-]*$/u.test(form.registration.trim().toUpperCase())) {
      errors.registration = 'Use only letters, numbers, spaces, dots or hyphens.';
    }
    if (form.vin && !/^[A-HJ-NPR-Z0-9]{17}$/u.test(form.vin.trim().toUpperCase())) {
      errors.vin = 'Enter a 17-character VIN. The letters I, O and Q are not used.';
    }
  }

  if (step === 3) {
    if (!form.firstName.trim()) errors.firstName = 'Enter your first name.';
    if (!form.lastName.trim()) errors.lastName = 'Enter your last name.';
    if (!isValidBookingEmail(form.email)) errors.email = 'Enter a valid email address.';
    if (!isValidBookingMobile(form.mobile)) {
      errors.mobile = 'Use 8 to 15 digits and only +, spaces, brackets, dots or hyphens.';
    }
  }

  if (step === 4) {
    if (!form.preferredDate) {
      errors.preferredDate = 'Choose a preferred booking date.';
    } else {
      const today = localIsoDate(new Date());
      const latestDate = localIsoDate(maxBookingDate());
      if (form.preferredDate < today) errors.preferredDate = 'Choose today or a future date.';
      if (form.preferredDate > latestDate) errors.preferredDate = 'Choose a date within the next 18 months.';
      if (!errors.preferredDate && dateFromIso(form.preferredDate).getUTCDay() === 0) {
        errors.preferredDate = 'The workshop is closed Sundays. Choose Monday to Saturday.';
      }
    }
  }

  if (step === 5) {
    if (!form.consent) errors.consent = 'Please agree so PSI can contact you about this request.';
    if (!form.depositTermsAccepted) {
      errors.depositTermsAccepted = 'Acknowledge the deposit and booking confirmation terms.';
    }
  }

  return errors;
}

export function bookingCheckoutApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!configured) {
    throw new Error('PSI secure booking is not configured on this app build. No details were sent.');
  }

  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    throw new Error('PSI secure booking has an invalid server address. No details were sent.');
  }

  const localDevelopmentHost = ['localhost', '127.0.0.1', '10.0.2.2'].includes(origin.hostname);
  const secureProductionOrigin = origin.protocol === 'https:';
  const permittedDevelopmentOrigin = __DEV__ && origin.protocol === 'http:' && localDevelopmentHost;
  if (
    (!secureProductionOrigin && !permittedDevelopmentOrigin) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    (origin.pathname !== '/' && origin.pathname !== '')
  ) {
    throw new Error('PSI secure booking requires a verified HTTPS server address. No details were sent.');
  }

  return `${origin.origin}/api/v1/booking-checkouts`;
}

function normaliseApiFieldErrors(fields: unknown): BookingErrors {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};

  const fieldErrors: BookingErrors = {};
  const allowedTuningKeys = new Set(Object.keys(EMPTY_TUNING_DETAILS));

  const addError = (key: string, value: unknown) => {
    const formKey = key === 'depositPolicyVersion' ? 'depositTermsAccepted' : key;
    const allowedTopLevel = formKey in EMPTY_BOOKING && formKey !== 'tuningDetails';
    const tuningKey = formKey.startsWith('tuningDetails.') ? formKey.slice('tuningDetails.'.length) : '';
    if (!allowedTopLevel && !allowedTuningKeys.has(tuningKey) && formKey !== 'tuningDetails') return;
    const message = Array.isArray(value) ? value.filter((item) => typeof item === 'string').join(' ') : value;
    if (typeof message === 'string' && message.trim()) {
      fieldErrors[formKey as BookingErrorKey] = message.trim();
    }
  };

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'tuningDetails' && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) addError(`tuningDetails.${nestedKey}`, nestedValue);
      continue;
    }
    addError(key, value);
  }
  return fieldErrors;
}

type CheckoutErrorPayload = {
  error?: string | {
    code?: string;
    message?: string;
    fields?: unknown;
  };
};

function isSecureCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isCheckoutResult(value: unknown, bookingType: BookingType | ''): value is BookingCheckoutResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const expectedDepositAmountCents = depositAmountForBookingType(bookingType);
  if (expectedDepositAmountCents === null) return false;
  const result = value as Partial<BookingCheckoutResult>;
  return Boolean(
    typeof result.checkoutId === 'string' &&
    result.checkoutId.trim().length > 0 &&
    typeof result.reference === 'string' &&
    result.reference.trim().length > 0 &&
    result.state === 'requires_payment' &&
    result.deposit?.amountCents === expectedDepositAmountCents &&
    result.deposit.currency === DEPOSIT_CURRENCY &&
    typeof result.payment?.provider === 'string' &&
    result.payment.provider.length > 0 &&
    isSecureCheckoutUrl(result.payment.checkoutUrl),
  );
}

export async function createBookingCheckout(
  form: BookingFormState,
  idempotencyKey: string,
): Promise<BookingCheckoutResult> {
  if (idempotencyKey.trim().length < 16) {
    throw new Error('This checkout could not be safely identified. Please restart the booking.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const tuning = form.tuningDetails;
    const tuningDetails = form.bookingType === 'dyno' ? {
      engineState: tuning.engineState,
      ...(tuning.engineState === 'modified' ? { engineModifications: tuning.engineModifications.trim() } : {}),
      transmissionType: tuning.transmissionType,
      transmissionSetup: tuning.transmissionSetup,
      ...(tuning.transmissionSetup !== 'stock' ? { transmissionDetails: tuning.transmissionDetails.trim() } : {}),
      differentialType: tuning.differentialType,
      differentialGearRatio: tuning.differentialGearRatio.trim(),
      ...(tuning.differentialType === 'other' ? { differentialDetails: tuning.differentialDetails.trim() } : {}),
      fuelPumpType: tuning.fuelPumpType,
      ...(tuning.fuelPumpType === 'upgraded' ? { fuelPumpDetails: tuning.fuelPumpDetails.trim() } : {}),
      injectorType: tuning.injectorType,
      ...(tuning.injectorType === 'upgraded' ? { injectorDetails: tuning.injectorDetails.trim() } : {}),
      fuelType: tuning.fuelType,
      ...(tuning.fuelType === 'other' ? { fuelTypeDetails: tuning.fuelTypeDetails.trim() } : {}),
      intakeType: tuning.intakeType,
      ...(tuning.intakeType === 'upgraded' ? { intakeDetails: tuning.intakeDetails.trim() } : {}),
      previouslyTuned: tuning.previouslyTuned,
      ...(tuning.previouslyTuned === 'yes' ? { previousTuner: tuning.previousTuner.trim() } : {}),
      exhaustType: tuning.exhaustType,
      exhaustSize: tuning.exhaustSize,
      varexControlled: tuning.varexControlled,
      ...(tuning.exhaustType !== 'stock' ? { exhaustDetails: tuning.exhaustDetails.trim() } : {}),
      camshaftType: tuning.camshaftType,
      ...(tuning.camshaftType === 'upgraded' ? { camshaftDetails: tuning.camshaftDetails.trim() } : {}),
    } : undefined;

    const response = await fetch(bookingCheckoutApiUrl(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        bookingType: form.bookingType,
        requestDetails: form.requestDetails.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        mobile: form.mobile.trim(),
        vehicleMake: form.vehicleMake.trim(),
        vehicleModel: form.vehicleModel.trim(),
        vehicleYear: Number(form.vehicleYear),
        registration: form.registration.trim().toUpperCase(),
        vin: form.vin.trim().toUpperCase(),
        preferredDate: form.preferredDate,
        arrivalWindow: form.arrivalWindow,
        source: 'mobile',
        consent: true,
        depositTermsAccepted: true,
        depositPolicyVersion: DEPOSIT_POLICY_VERSION,
        ...(tuningDetails ? { tuningDetails } : {}),
        company: '',
      }),
    });

    const raw = await response.text();
    let data: BookingCheckoutResult | CheckoutErrorPayload | null = null;
    try {
      data = raw ? JSON.parse(raw) as BookingCheckoutResult | CheckoutErrorPayload : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const apiError = data && 'error' in data ? data.error : undefined;
      const code = typeof apiError === 'object' ? apiError?.code || 'CHECKOUT_FAILED' : 'CHECKOUT_FAILED';
      const message = typeof apiError === 'string'
        ? apiError
        : apiError?.message || 'Secure checkout could not be prepared. Please try again.';
      const fieldErrors = typeof apiError === 'object' ? normaliseApiFieldErrors(apiError?.fields) : {};
      throw new BookingApiError(message, fieldErrors, code, response.status);
    }

    if (!isCheckoutResult(data, form.bookingType)) {
      throw new Error('PSI received an unexpected checkout response. No payment has been taken.');
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The checkout request timed out. No payment has been taken. Please try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('We could not reach secure checkout. No payment has been taken. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
