import { getBookingD1 } from "../../../../db";
import {
  isValidBookingEmail,
  isValidBookingMobile,
  isValidVin,
  isValidVehicleRegistration,
} from "../../../lib/booking-inputs";
import {
  DEPOSIT_CURRENCY,
  DEPOSIT_POLICY_VERSION,
  depositAmountForBookingType,
  serviceOptionForBookingType,
  type CheckoutBookingType,
  type DepositAmountCents,
} from "../booking-catalog/catalog";
import {
  validateTuningDetails,
  type TuningDetails,
  type TuningDetailsFieldName,
} from "./tuning-details";

const MAX_REQUEST_BYTES = 24_000;
const IDEMPOTENCY_KEY_MIN_LENGTH = 16;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_MAX_REQUESTS = 5;

const FIELD_LIMITS = {
  bookingType: 16,
  firstName: 80,
  lastName: 80,
  email: 254,
  mobile: 32,
  vehicleMake: 60,
  vehicleModel: 80,
  registration: 20,
  vin: 32,
  preferredDate: 10,
  arrivalWindow: 16,
  requestDetails: 2_000,
  source: 16,
  depositPolicyVersion: 64,
} as const;

type TextField = keyof typeof FIELD_LIMITS;
type FieldName =
  | TextField
  | TuningDetailsFieldName
  | "vehicleYear"
  | "consent"
  | "depositTermsAccepted"
  | "depositAmountCents"
  | "currency";
type FieldErrors = Partial<Record<FieldName, string>>;
type JsonObject = Record<string, unknown>;
type CheckoutDatabase = Awaited<ReturnType<typeof getBookingD1>>;

interface ValidCheckout {
  bookingType: CheckoutBookingType;
  serviceOption: "service_report" | "dyno_tuning";
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  registration: string;
  vin: string;
  preferredDate: string;
  arrivalWindow: "morning" | "afternoon" | "any";
  requestDetails: string;
  tuningDetails: TuningDetails | null;
  source: "web" | "mobile";
  consent: true;
  depositTermsAccepted: true;
  depositPolicyVersion: typeof DEPOSIT_POLICY_VERSION;
  depositAmountCents: DepositAmountCents;
  currency: typeof DEPOSIT_CURRENCY;
}

interface CheckoutIdempotencyRecord {
  requestHash: string;
  checkoutId: string;
  publicReference: string;
  bookingType: string;
  state: string;
  paymentProvider: string | null;
  providerCheckoutUrl: string | null;
  depositAmountCents: number;
  currency: string;
  expiresAt: string;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  fields?: FieldErrors,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");

  return Response.json(
    {
      error: {
        code,
        message,
        ...(fields && Object.keys(fields).length > 0 ? { fields } : {}),
      },
    },
    { status, headers },
  );
}

function readText(
  body: JsonObject,
  field: TextField,
  errors: FieldErrors,
  options: { required?: boolean; defaultValue?: string; allowNewlines?: boolean } = {},
) {
  const rawValue = body[field];
  if (rawValue === undefined || rawValue === null) {
    if (options.required) errors[field] = "This field is required.";
    return options.defaultValue ?? "";
  }
  if (typeof rawValue !== "string") {
    errors[field] = "Must be text.";
    return options.defaultValue ?? "";
  }

  const value = rawValue.trim();
  if (options.required && value.length === 0) {
    errors[field] = "This field is required.";
  } else if (value.length > FIELD_LIMITS[field]) {
    errors[field] = `Must be ${FIELD_LIMITS[field]} characters or fewer.`;
  } else {
    const hasUnsupportedControl = Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      if (options.allowNewlines && (codePoint === 9 || codePoint === 10 || codePoint === 13)) {
        return false;
      }
      return codePoint < 32 || codePoint === 127;
    });
    if (hasUnsupportedControl) errors[field] = "Contains unsupported control characters.";
  }
  return value;
}

function getMelbourneDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(value("year")),
    isoDate: `${value("year")}-${value("month")}-${value("day")}`,
  };
}

function addMonthsToIsoDate(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function isRealIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateCheckout(body: JsonObject):
  | { checkout: ValidCheckout; errors: null }
  | { checkout: null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const bookingType = readText(body, "bookingType", errors, { required: true });
  const firstName = readText(body, "firstName", errors, { required: true });
  const lastName = readText(body, "lastName", errors, { required: true });
  const email = readText(body, "email", errors, { required: true }).toLowerCase();
  const mobile = readText(body, "mobile", errors, { required: true });
  const vehicleMake = readText(body, "vehicleMake", errors, { required: true });
  const vehicleModel = readText(body, "vehicleModel", errors, { required: true });
  const registration = readText(body, "registration", errors, {
    required: true,
  }).toUpperCase();
  const vin = readText(body, "vin", errors).toUpperCase();
  const preferredDate = readText(body, "preferredDate", errors, { required: true });
  const arrivalWindow = readText(body, "arrivalWindow", errors, { required: true });
  const requestDetails = readText(body, "requestDetails", errors, {
    required: true,
    allowNewlines: true,
  });
  const source = readText(body, "source", errors, { required: true });
  const depositPolicyVersion = readText(body, "depositPolicyVersion", errors, {
    required: true,
  });

  if (bookingType !== "service" && bookingType !== "dyno") {
    errors.bookingType = "Choose service or dyno tuning.";
  }
  let tuningDetails: TuningDetails | null = null;
  if (bookingType === "dyno") {
    const tuningResult = validateTuningDetails(body.tuningDetails);
    if (tuningResult.errors) {
      Object.assign(errors, tuningResult.errors);
    } else {
      tuningDetails = tuningResult.details;
    }
  }
  if (!errors.email && !isValidBookingEmail(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!errors.mobile && !isValidBookingMobile(mobile)) {
    errors.mobile = "Enter a valid mobile number with 8 to 15 digits.";
  }
  if (registration && !isValidVehicleRegistration(registration)) {
    errors.registration = "Use only letters, numbers, spaces, dots, or hyphens.";
  }
  if (vin && !isValidVin(vin)) {
    errors.vin = "Enter a 17-character VIN. The letters I, O, and Q are not used.";
  }
  if (
    arrivalWindow !== "morning" &&
    arrivalWindow !== "afternoon" &&
    arrivalWindow !== "any"
  ) {
    errors.arrivalWindow = "Choose morning, afternoon, or any time.";
  }
  if (source !== "web" && source !== "mobile") {
    errors.source = "Must be web or mobile.";
  }

  const { year: currentYear, isoDate: today } = getMelbourneDateParts();
  const rawVehicleYear = body.vehicleYear;
  const vehicleYear =
    typeof rawVehicleYear === "number" && Number.isInteger(rawVehicleYear)
      ? rawVehicleYear
      : typeof rawVehicleYear === "string" && /^\d{4}$/u.test(rawVehicleYear.trim())
        ? Number(rawVehicleYear.trim())
        : Number.NaN;
  if (!Number.isInteger(vehicleYear)) {
    errors.vehicleYear = "Enter a four-digit vehicle year.";
  } else if (vehicleYear < 1900 || vehicleYear > currentYear + 1) {
    errors.vehicleYear = `Enter a year from 1900 to ${currentYear + 1}.`;
  }

  const maxPreferredDate = addMonthsToIsoDate(today, 18);
  if (!isRealIsoDate(preferredDate)) {
    errors.preferredDate = "Use a valid date in YYYY-MM-DD format.";
  } else if (preferredDate < today) {
    errors.preferredDate = "The preferred date cannot be in the past.";
  } else if (preferredDate > maxPreferredDate) {
    errors.preferredDate = "Choose a preferred date within the next 18 months.";
  } else if (new Date(`${preferredDate}T00:00:00Z`).getUTCDay() === 0) {
    errors.preferredDate = "PSI Performance is closed on Sundays.";
  }

  if (body.consent !== true) {
    errors.consent = "Consent is required so PSI can contact you about this request.";
  }
  if (body.depositTermsAccepted !== true) {
    errors.depositTermsAccepted = "Accept the deposit terms before continuing.";
  }
  if (depositPolicyVersion !== DEPOSIT_POLICY_VERSION) {
    errors.depositPolicyVersion = "Review and accept the current deposit policy.";
  }
  if (Object.hasOwn(body, "depositAmountCents")) {
    errors.depositAmountCents = "The deposit amount is set securely by PSI Performance.";
  }
  if (Object.hasOwn(body, "currency")) {
    errors.currency = "The payment currency is set securely by PSI Performance.";
  }

  if (Object.keys(errors).length > 0) return { checkout: null, errors };

  const validBookingType = bookingType as CheckoutBookingType;
  return {
    checkout: {
      bookingType: validBookingType,
      serviceOption: serviceOptionForBookingType(validBookingType),
      firstName,
      lastName,
      email,
      mobile,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      registration,
      vin,
      preferredDate,
      arrivalWindow: arrivalWindow as ValidCheckout["arrivalWindow"],
      requestDetails,
      tuningDetails,
      source: source as ValidCheckout["source"],
      consent: true,
      depositTermsAccepted: true,
      depositPolicyVersion: DEPOSIT_POLICY_VERSION,
      depositAmountCents: depositAmountForBookingType(validBookingType),
      currency: DEPOSIT_CURRENCY,
    },
    errors: null,
  };
}

function validateIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key");
  if (!value) return { key: null, error: "An Idempotency-Key header is required." };
  if (
    value.length < IDEMPOTENCY_KEY_MIN_LENGTH ||
    value.length > IDEMPOTENCY_KEY_MAX_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  ) {
    return {
      key: null,
      error:
        "Idempotency-Key must be 16 to 128 characters using letters, numbers, dots, underscores, colons, or hyphens.",
    };
  }
  return { key: value, error: null };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function getRateLimitIdentity(request: Request) {
  const candidate = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  if (
    candidate.length === 0 ||
    candidate.length > 64 ||
    !/^[0-9a-f:.]+$/iu.test(candidate)
  ) {
    return "unavailable";
  }
  return candidate.toLowerCase();
}

async function applyRateLimit(database: CheckoutDatabase, request: Request) {
  const now = Math.floor(Date.now() / 1_000);
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_SECONDS) * RATE_LIMIT_WINDOW_SECONDS;
  const retryAfter = Math.max(1, windowStart + RATE_LIMIT_WINDOW_SECONDS - now);
  const identityHash = await sha256(
    `psi-performance-paid-checkout-v1:${getRateLimitIdentity(request)}`,
  );

  await database
    .prepare("DELETE FROM booking_rate_limits WHERE window_start < ?")
    .bind(windowStart - RATE_LIMIT_WINDOW_SECONDS * 8)
    .run();

  const row = await database
    .prepare(
      `INSERT INTO booking_rate_limits (ip_hash, window_start, request_count)
       VALUES (?, ?, 1)
       ON CONFLICT (ip_hash, window_start)
       DO UPDATE SET request_count = request_count + 1
       RETURNING request_count AS requestCount`,
    )
    .bind(identityHash, windowStart)
    .first<{ requestCount: number }>();

  if (!row || !Number.isInteger(row.requestCount)) {
    throw new Error("Rate-limit counter was not returned.");
  }
  return {
    allowed: row.requestCount <= RATE_LIMIT_MAX_REQUESTS,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - row.requestCount),
    retryAfter,
  } satisfies RateLimitResult;
}

async function findIdempotencyRecord(
  database: CheckoutDatabase,
  keyHash: string,
) {
  return database
    .prepare(
      `SELECT
         i.request_hash AS requestHash,
         i.checkout_id AS checkoutId,
         c.public_reference AS publicReference,
         c.booking_type AS bookingType,
         c.state,
         c.payment_provider AS paymentProvider,
         c.provider_checkout_url AS providerCheckoutUrl,
         c.deposit_amount_cents AS depositAmountCents,
         c.currency,
         c.expires_at AS expiresAt
       FROM booking_checkout_idempotency_keys i
       INNER JOIN booking_checkouts c ON c.id = i.checkout_id
       WHERE i.key_hash = ?`,
    )
    .bind(keyHash)
    .first<CheckoutIdempotencyRecord>();
}

function replayResponse(record: CheckoutIdempotencyRecord) {
  if (record.state === "paid" || record.state === "processing") {
    return errorResponse(
      409,
      "CHECKOUT_ALREADY_PAID_OR_PROCESSING",
      "This deposit has already been paid or is being verified. Do not start another payment. Contact PSI Performance if you need help.",
    );
  }

  if (record.state === "expired") {
    return errorResponse(
      409,
      "CHECKOUT_EXPIRED",
      "This secure checkout has expired. Start a new checkout to continue.",
    );
  }

  if (record.state === "cancelled") {
    return errorResponse(
      409,
      "CHECKOUT_CANCELLED",
      "This secure checkout was cancelled. Start a new checkout when you are ready.",
    );
  }

  if (
    (record.bookingType !== "service" && record.bookingType !== "dyno") ||
    record.currency !== DEPOSIT_CURRENCY ||
    record.depositAmountCents !== depositAmountForBookingType(record.bookingType)
  ) {
    return errorResponse(
      409,
      "CHECKOUT_NOT_PAYABLE",
      "This checkout cannot be resumed safely. No new payment has been requested. Contact PSI Performance for help.",
    );
  }

  if (
    record.state !== "awaiting_payment" ||
    !record.paymentProvider ||
    !record.providerCheckoutUrl
  ) {
    return errorResponse(
      409,
      "CHECKOUT_NOT_PAYABLE",
      "This checkout cannot be resumed safely. No new payment has been requested. Contact PSI Performance for help.",
    );
  }

  const expiresAt = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return errorResponse(
      409,
      "CHECKOUT_EXPIRED",
      "This secure checkout has expired. Start a new checkout to continue.",
    );
  }

  return Response.json(
    {
      checkoutId: record.checkoutId,
      reference: record.publicReference,
      state: "requires_payment",
      deposit: {
        amountCents: record.depositAmountCents,
        currency: record.currency,
      },
      payment: {
        provider: record.paymentProvider,
        checkoutUrl: record.providerCheckoutUrl,
        expiresAt: record.expiresAt,
      },
      message: "The existing secure checkout is ready to continue.",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Idempotency-Replayed": "true",
      },
    },
  );
}

export async function POST(request: Request) {
  const idempotency = validateIdempotencyKey(request);
  if (!idempotency.key) {
    return errorResponse(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      idempotency.error ?? "The Idempotency-Key header is invalid.",
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send the checkout request as application/json.",
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return errorResponse(413, "REQUEST_TOO_LARGE", "The checkout request is too large.");
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return errorResponse(413, "REQUEST_TOO_LARGE", "The checkout request is too large.");
    }
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse(400, "INVALID_REQUEST", "The request body must be a JSON object.");
  }

  const payload = body as JsonObject;
  if (typeof payload.company !== "undefined" && typeof payload.company !== "string") {
    return errorResponse(400, "INVALID_REQUEST", "The checkout request is invalid.");
  }
  if (typeof payload.company === "string" && payload.company.trim().length > 0) {
    return errorResponse(400, "INVALID_REQUEST", "The checkout request is invalid.");
  }

  const result = validateCheckout(payload);
  if (result.errors) {
    return errorResponse(
      422,
      "VALIDATION_FAILED",
      "Please correct the highlighted checkout details.",
      result.errors,
    );
  }

  try {
    const database = await getBookingD1();
    const keyHash = await sha256(idempotency.key);
    const requestHash = await sha256(JSON.stringify(result.checkout));
    const existing = await findIdempotencyRecord(database, keyHash);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return errorResponse(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This Idempotency-Key was already used for different checkout details.",
        );
      }
      return replayResponse(existing);
    }

    const rateLimit = await applyRateLimit(database, request);
    if (!rateLimit.allowed) {
      return errorResponse(
        429,
        "RATE_LIMITED",
        "Too many checkout attempts were submitted. Please wait before trying again.",
        undefined,
        {
          "Retry-After": String(rateLimit.retryAfter),
          "RateLimit-Limit": String(rateLimit.limit),
          "RateLimit-Remaining": "0",
        },
      );
    }

    // No live payment adapter is deliberately installed yet. Crucially, this
    // branch does not persist the validated form or create a booking/payment.
    return errorResponse(
      503,
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
      "Online deposits are not configured yet. No booking or payment was created. Please contact PSI Performance for assistance.",
      undefined,
      {
        "Idempotency-Replayed": "false",
        "RateLimit-Limit": String(rateLimit.limit),
        "RateLimit-Remaining": String(rateLimit.remaining),
      },
    );
  } catch {
    // Never log the request or error object: both may contain customer PII.
    console.error("Paid checkout readiness check failed.");
    return errorResponse(
      503,
      "CHECKOUT_STORAGE_UNAVAILABLE",
      "The secure checkout is temporarily unavailable. No booking or payment was created.",
    );
  }
}
