export type BookingType = 'service' | 'dyno';
export type ArrivalWindow = 'morning' | 'afternoon' | 'any';

export const MIN_DEPOSIT_CENTS = 20_000;
export const DEPOSIT_CURRENCY = 'AUD';

export const BOOKING_PURPOSES = {
  service: {
    label: 'Service & Report',
    priceGuide: 'From $385 + GST',
  },
  dyno: {
    label: 'Dyno tuning',
    priceGuide: 'From $350 + GST',
  },
} as const;

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
};

export type BookingErrors = Partial<Record<keyof BookingFormState, string>>;

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

export function validateBookingStep(form: BookingFormState, step: number): BookingErrors {
  const errors: BookingErrors = {};

  if (step === 1) {
    if (!form.bookingType) errors.bookingType = 'Choose Service & Report or Dyno tuning.';
    if (form.requestDetails.trim().length < 10) {
      errors.requestDetails = 'Tell PSI what you need in at least 10 characters.';
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
    if (form.vin && form.vin.trim().length !== 17) errors.vin = 'A VIN must contain 17 characters.';
  }

  if (step === 3) {
    if (!form.firstName.trim()) errors.firstName = 'Enter your first name.';
    if (!form.lastName.trim()) errors.lastName = 'Enter your last name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
    const phoneDigits = form.mobile.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) errors.mobile = 'Enter a valid mobile number.';
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
  for (const [key, value] of Object.entries(fields)) {
    const formKey = key === 'depositPolicyVersion' ? 'depositTermsAccepted' : key;
    if (!(formKey in EMPTY_BOOKING)) continue;
    const message = Array.isArray(value) ? value.filter((item) => typeof item === 'string').join(' ') : value;
    if (typeof message === 'string' && message.trim()) {
      fieldErrors[formKey as keyof BookingFormState] = message.trim();
    }
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

function isCheckoutResult(value: unknown): value is BookingCheckoutResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Partial<BookingCheckoutResult>;
  return Boolean(
    result.checkoutId &&
    result.reference &&
    result.state === 'requires_payment' &&
    result.deposit?.amountCents === MIN_DEPOSIT_CENTS &&
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
        depositPolicyVersion: 'psi-deposit-v1',
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

    if (!isCheckoutResult(data)) {
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
