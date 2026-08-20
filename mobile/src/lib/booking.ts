export type BookingType = 'service' | 'dyno';
export type ArrivalWindow = 'morning' | 'afternoon' | 'any';

export type BookingFormState = {
  bookingType: BookingType | '';
  serviceOption: string;
  customerName: string;
  email: string;
  phone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  registration: string;
  vin: string;
  preferredDate: string;
  arrivalWindow: ArrivalWindow;
  notes: string;
  consent: boolean;
};

export type BookingResult = {
  reference: string;
  status: string;
  message?: string;
};

export type BookingOption = {
  value: string;
  label: string;
  detail: string;
};

export const SERVICE_OPTIONS: BookingOption[] = [
  {
    value: 'logbook_service',
    label: 'Logbook service',
    detail: 'Scheduled servicing to keep your car on track.',
  },
  {
    value: 'minor_service',
    label: 'Minor service',
    detail: 'Oil, filters and essential safety checks.',
  },
  {
    value: 'major_service',
    label: 'Major service',
    detail: 'A deeper inspection and maintenance visit.',
  },
  {
    value: 'diagnostics_repairs',
    label: 'Diagnostics or repairs',
    detail: 'Fault-finding, warning lights and mechanical issues.',
  },
];

export const DYNO_OPTIONS: BookingOption[] = [
  {
    value: 'dyno_tune',
    label: 'Dyno tune',
    detail: 'Calibration focused on safe power and drivability.',
  },
  {
    value: 'dyno_health_check',
    label: 'Dyno health check',
    detail: 'Measure, inspect and identify the next step.',
  },
  {
    value: 'existing_tune_review',
    label: 'Existing tune review',
    detail: 'Review a previous calibration or changed setup.',
  },
  {
    value: 'performance_consultation',
    label: 'Performance consultation',
    detail: 'Plan an upgrade path before workshop work begins.',
  },
];

export const EMPTY_BOOKING: BookingFormState = {
  bookingType: '',
  serviceOption: '',
  customerName: '',
  email: '',
  phone: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  registration: '',
  vin: '',
  preferredDate: '',
  arrivalWindow: 'any',
  notes: '',
  consent: false,
};

export type BookingErrors = Partial<Record<keyof BookingFormState, string>>;

export class BookingApiError extends Error {
  fieldErrors: BookingErrors;

  constructor(message: string, fieldErrors: BookingErrors = {}) {
    super(message);
    this.name = 'BookingApiError';
    this.fieldErrors = fieldErrors;
  }
}

export function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function displayDate(value: string) {
  if (!value) return 'Choose a date';
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dateFromIso(value));
}

export function maxBookingDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 18);
  return date;
}

export function validateBookingStep(form: BookingFormState, step: number): BookingErrors {
  const errors: BookingErrors = {};

  if (step === 1) {
    if (!form.bookingType) errors.bookingType = 'Choose vehicle service or dyno tuning.';
    if (!form.serviceOption) errors.serviceOption = 'Choose the closest job type.';
  }

  if (step === 2) {
    if (!form.vehicleMake.trim()) errors.vehicleMake = 'Enter the vehicle make.';
    if (!form.vehicleModel.trim()) errors.vehicleModel = 'Enter the vehicle model.';
    const year = Number(form.vehicleYear);
    const latestYear = new Date().getFullYear() + 1;
    if (!Number.isInteger(year) || year < 1900 || year > latestYear) {
      errors.vehicleYear = `Enter a year between 1900 and ${latestYear}.`;
    }
    if (!form.registration.trim()) errors.registration = 'Enter the registration.';
    if (form.vin && form.vin.trim().length !== 17) errors.vin = 'A VIN must contain 17 characters.';
  }

  if (step === 3) {
    if (!form.customerName.trim()) errors.customerName = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) errors.phone = 'Enter a valid phone number.';
    if (!form.preferredDate) {
      errors.preferredDate = 'Choose a preferred drop-off date.';
    } else {
      const today = localIsoDate(new Date());
      if (form.preferredDate < today) errors.preferredDate = 'Choose today or a future date.';
      if (dateFromIso(form.preferredDate).getDay() === 0) {
        errors.preferredDate = 'The workshop is closed Sundays. Choose Monday to Saturday.';
      }
    }
    if (!form.consent) errors.consent = 'Please agree so PSI can contact you about this request.';
  }

  return errors;
}

const DEFAULT_API_BASE_URL = 'https://book.psiperformance.com.au';

export function bookingApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
  return `${configured.replace(/\/+$/, '')}/api/v1/bookings`;
}

function normaliseApiFieldErrors(fields: unknown): BookingErrors {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return {};

  const fieldErrors: BookingErrors = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!(key in EMPTY_BOOKING)) continue;
    const message = Array.isArray(value) ? value.filter((item) => typeof item === 'string').join(' ') : value;
    if (typeof message === 'string' && message.trim()) {
      fieldErrors[key as keyof BookingFormState] = message.trim();
    }
  }
  return fieldErrors;
}

export async function submitBooking(form: BookingFormState, idempotencyKey: string): Promise<BookingResult> {
  if (idempotencyKey.trim().length < 16) {
    throw new Error('This request could not be safely identified. Please restart the booking.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(bookingApiUrl(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        bookingType: form.bookingType,
        serviceOption: form.serviceOption,
        customerName: form.customerName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        vehicleMake: form.vehicleMake.trim(),
        vehicleModel: form.vehicleModel.trim(),
        vehicleYear: Number(form.vehicleYear),
        registration: form.registration.trim().toUpperCase(),
        vin: form.vin.trim().toUpperCase(),
        preferredDate: form.preferredDate,
        arrivalWindow: form.arrivalWindow,
        notes: form.notes.trim(),
        source: 'mobile',
        consent: true,
        company: '',
      }),
    });

    const raw = await response.text();
    let data: (Partial<BookingResult> & {
      error?: string | { code?: string; message?: string; fields?: unknown };
    }) | null = null;
    try {
      data = raw
        ? (JSON.parse(raw) as Partial<BookingResult> & {
            error?: string | { code?: string; message?: string; fields?: unknown };
          })
        : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const apiError = data?.error;
      const message = typeof apiError === 'string'
        ? apiError
        : apiError?.message || 'We could not submit that request. Please try again.';
      const fieldErrors = typeof apiError === 'object'
        ? normaliseApiFieldErrors(apiError.fields)
        : {};
      throw new BookingApiError(message, fieldErrors);
    }
    if (!data?.reference || !data.status) {
      throw new Error('PSI received an unexpected response. Please call the workshop to confirm.');
    }

    return {
      reference: data.reference,
      status: data.status,
      message: data.message,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The request timed out. Check your connection and try again.');
    }
    if (error instanceof TypeError) {
      throw new Error('We could not reach PSI. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
