import { getBookingD1 } from "../../../../db";

const MAX_REQUEST_BYTES = 20_000;
const BOOKING_STATUS = "requested" as const;
const BOOKING_MESSAGE =
  "Your booking request is pending confirmation. PSI Performance will contact you to confirm the date and details.";
const CONSENT_POLICY_VERSION = "psi-booking-contact-v1";
const IDEMPOTENCY_KEY_MIN_LENGTH = 16;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_MAX_REQUESTS = 5;

function requiresPaidCheckout() {
  // Explicitly gate the legacy endpoint. New requests must enter the staff
  // approval workflow; no direct caller can create a confirmed booking.
  return true;
}

const SERVICE_OPTIONS = [
  "logbook_service",
  "minor_service",
  "major_service",
  "diagnostics_repairs",
] as const;
const DYNO_OPTIONS = [
  "dyno_tune",
  "dyno_health_check",
  "existing_tune_review",
  "performance_consultation",
] as const;

const FIELD_LIMITS = {
  bookingType: 16,
  serviceOption: 80,
  customerName: 100,
  email: 254,
  phone: 32,
  vehicleMake: 60,
  vehicleModel: 80,
  registration: 20,
  vin: 32,
  preferredDate: 10,
  arrivalWindow: 16,
  notes: 2_000,
  source: 16,
} as const;

type FieldName = keyof typeof FIELD_LIMITS | "vehicleYear" | "consent";
type FieldErrors = Partial<Record<FieldName, string>>;
type JsonObject = Record<string, unknown>;
type BookingDatabase = Awaited<ReturnType<typeof getBookingD1>>;

interface ValidBooking {
  bookingType: "service" | "dyno";
  serviceOption: string;
  customerName: string;
  email: string;
  phone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  registration: string;
  vin: string;
  preferredDate: string;
  arrivalWindow: "morning" | "afternoon" | "any";
  notes: string;
  source: "web" | "mobile";
}

interface IdempotencyRecord {
  requestHash: string;
  publicReference: string;
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

function bookingResponse(
  reference: string,
  options: { replayed: boolean; rateLimit?: RateLimitResult },
) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Idempotency-Replayed": options.replayed ? "true" : "false",
  });

  if (options.rateLimit) {
    headers.set("RateLimit-Limit", String(options.rateLimit.limit));
    headers.set("RateLimit-Remaining", String(options.rateLimit.remaining));
  }

  return Response.json(
    { reference, status: BOOKING_STATUS, message: BOOKING_MESSAGE },
    { status: 201, headers },
  );
}

function readText(
  body: JsonObject,
  field: keyof typeof FIELD_LIMITS,
  errors: FieldErrors,
  options: { required?: boolean; defaultValue?: string } = {},
) {
  const rawValue = body[field];

  if (rawValue === undefined || rawValue === null) {
    if (options.required) {
      errors[field] = "This field is required.";
    }
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
  } else if (/\p{Cc}/u.test(value)) {
    errors[field] = "Contains unsupported control characters.";
  }

  return value;
}

function readNotes(body: JsonObject, errors: FieldErrors) {
  const rawValue = body.notes;
  if (rawValue === undefined || rawValue === null) {
    return "";
  }
  if (typeof rawValue !== "string") {
    errors.notes = "Must be text.";
    return "";
  }

  const value = rawValue.trim();
  if (value.length > FIELD_LIMITS.notes) {
    errors.notes = `Must be ${FIELD_LIMITS.notes} characters or fewer.`;
  } else if (
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        (codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13) ||
        codePoint === 127
      );
    })
  ) {
    errors.notes = "Contains unsupported control characters.";
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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

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

function validateBooking(body: JsonObject):
  | { booking: ValidBooking; errors: null }
  | { booking: null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const bookingType = readText(body, "bookingType", errors, { required: true });
  const serviceOption = readText(body, "serviceOption", errors, { required: true });
  const customerName = readText(body, "customerName", errors, { required: true });
  const email = readText(body, "email", errors, { required: true }).toLowerCase();
  const phone = readText(body, "phone", errors, { required: true });
  const vehicleMake = readText(body, "vehicleMake", errors, { required: true });
  const vehicleModel = readText(body, "vehicleModel", errors, { required: true });
  const registration = readText(body, "registration", errors, {
    required: true,
  }).toUpperCase();
  const vin = readText(body, "vin", errors).toUpperCase();
  const preferredDate = readText(body, "preferredDate", errors, { required: true });
  const arrivalWindow = readText(body, "arrivalWindow", errors, { required: true });
  const notes = readNotes(body, errors);
  const source = readText(body, "source", errors, { defaultValue: "web" });

  if (bookingType && bookingType !== "service" && bookingType !== "dyno") {
    errors.bookingType = "Choose either service or dyno.";
  }
  if (bookingType === "service" && !(SERVICE_OPTIONS as readonly string[]).includes(serviceOption)) {
    errors.serviceOption = "Choose a valid vehicle service option.";
  }
  if (bookingType === "dyno" && !(DYNO_OPTIONS as readonly string[]).includes(serviceOption)) {
    errors.serviceOption = "Choose a valid dyno option.";
  }
  if (
    arrivalWindow &&
    arrivalWindow !== "morning" &&
    arrivalWindow !== "afternoon" &&
    arrivalWindow !== "any"
  ) {
    errors.arrivalWindow = "Choose morning, afternoon, or any time.";
  }
  if (source !== "web" && source !== "mobile") {
    errors.source = "Must be web or mobile.";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  const phoneDigits = phone.replace(/\D/gu, "");
  if (
    phone &&
    (!/^[+\d() .-]+$/u.test(phone) || phoneDigits.length < 8 || phoneDigits.length > 15)
  ) {
    errors.phone = "Enter a valid phone number with 8 to 15 digits.";
  }

  if (registration && !/^[A-Z0-9][A-Z0-9 .-]*$/u.test(registration)) {
    errors.registration = "Use only letters, numbers, spaces, dots, or hyphens.";
  }
  if (vin && !/^[A-Z0-9][A-Z0-9 -]*$/u.test(vin)) {
    errors.vin = "Use only letters, numbers, spaces, or hyphens.";
  }

  const { year: currentYear, isoDate: today } = getMelbourneDateParts();
  const maxPreferredDate = addMonthsToIsoDate(today, 18);
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

  if (preferredDate) {
    if (!isRealIsoDate(preferredDate)) {
      errors.preferredDate = "Use a valid date in YYYY-MM-DD format.";
    } else if (preferredDate < today) {
      errors.preferredDate = "The preferred date cannot be in the past.";
    } else if (preferredDate > maxPreferredDate) {
      errors.preferredDate = "Choose a preferred date within the next 18 months.";
    } else if (new Date(`${preferredDate}T00:00:00Z`).getUTCDay() === 0) {
      errors.preferredDate = "PSI Performance is closed on Sundays.";
    }
  }

  if (body.consent !== true) {
    errors.consent = "Consent is required to submit a booking request.";
  }

  if (Object.keys(errors).length > 0) {
    return { booking: null, errors };
  }

  return {
    booking: {
      bookingType: bookingType as ValidBooking["bookingType"],
      serviceOption,
      customerName,
      email,
      phone,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      registration,
      vin,
      preferredDate,
      arrivalWindow: arrivalWindow as ValidBooking["arrivalWindow"],
      notes,
      source: source as ValidBooking["source"],
    },
    errors: null,
  };
}

function validateIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key");
  if (!value) {
    return { key: null, error: "An Idempotency-Key header is required." };
  }
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

async function findIdempotencyRecord(database: BookingDatabase, keyHash: string) {
  return database
    .prepare(
      `SELECT
         request_hash AS requestHash,
         public_reference AS publicReference
       FROM booking_idempotency_keys
       WHERE key_hash = ?`,
    )
    .bind(keyHash)
    .first<IdempotencyRecord>();
}

async function applyRateLimit(database: BookingDatabase, request: Request) {
  const now = Math.floor(Date.now() / 1_000);
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_SECONDS) * RATE_LIMIT_WINDOW_SECONDS;
  const retryAfter = Math.max(1, windowStart + RATE_LIMIT_WINDOW_SECONDS - now);
  const identityHash = await sha256(
    `psi-performance-booking-v1:${getRateLimitIdentity(request)}`,
  );

  // Bound retained rate-limit state without storing the source IP address.
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

function generatePublicReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `PSI-${token}`;
}

function isReferenceCollision(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("UNIQUE constraint failed: bookings.public_reference") ||
    message.includes("idx_bookings_public_reference")
  );
}

async function saveBooking(
  database: BookingDatabase,
  booking: ValidBooking,
  idempotencyKeyHash: string,
  requestHash: string,
) {
  const insertBooking = `
    INSERT INTO bookings (
      public_reference,
      booking_type,
      service_option,
      customer_name,
      email,
      phone,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      registration,
      vin,
      preferred_date,
      arrival_window,
      notes,
      source,
      status,
      consent,
      consent_policy_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const insertIdempotencyKey = `
    INSERT INTO booking_idempotency_keys (
      key_hash,
      request_hash,
      public_reference
    ) VALUES (?, ?, ?)
  `;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reference = generatePublicReference();
    try {
      await database.batch([
        database
          .prepare(insertBooking)
          .bind(
            reference,
            booking.bookingType,
            booking.serviceOption,
            booking.customerName,
            booking.email,
            booking.phone,
            booking.vehicleMake,
            booking.vehicleModel,
            booking.vehicleYear,
            booking.registration,
            booking.vin,
            booking.preferredDate,
            booking.arrivalWindow,
            booking.notes,
            booking.source,
            BOOKING_STATUS,
            1,
            CONSENT_POLICY_VERSION,
          ),
        database
          .prepare(insertIdempotencyKey)
          .bind(idempotencyKeyHash, requestHash, reference),
      ]);
      return { kind: "created" as const, reference };
    } catch (error) {
      const existing = await findIdempotencyRecord(database, idempotencyKeyHash);
      if (existing) {
        if (existing.requestHash === requestHash) {
          return {
            kind: "replayed" as const,
            reference: existing.publicReference,
          };
        }
        return { kind: "conflict" as const };
      }
      if (attempt < 2 && isReferenceCollision(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to allocate a unique booking reference.");
}

export async function POST(request: Request) {
  if (requiresPaidCheckout()) {
    return errorResponse(
      410,
      "APPROVAL_REQUIRED",
      "Use the approval-first booking request endpoint. PSI must approve a date before a deposit checkout can be created.",
      undefined,
      { Link: '</api/v1/booking-requests>; rel="successor-version"' },
    );
  }

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
      "Send the booking request as application/json.",
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return errorResponse(413, "REQUEST_TOO_LARGE", "The booking request is too large.");
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return errorResponse(413, "REQUEST_TOO_LARGE", "The booking request is too large.");
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
    return errorResponse(400, "INVALID_REQUEST", "The booking request is invalid.");
  }
  if (typeof payload.company === "string" && payload.company.trim().length > 0) {
    return errorResponse(400, "INVALID_REQUEST", "The booking request is invalid.");
  }

  const result = validateBooking(payload);
  if (result.errors) {
    return errorResponse(
      422,
      "VALIDATION_FAILED",
      "Please correct the highlighted booking details.",
      result.errors,
    );
  }

  try {
    const database = await getBookingD1();
    const idempotencyKeyHash = await sha256(idempotency.key);
    const requestHash = await sha256(JSON.stringify(result.booking));
    const existing = await findIdempotencyRecord(database, idempotencyKeyHash);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return errorResponse(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This Idempotency-Key was already used for a different booking request.",
        );
      }
      return bookingResponse(existing.publicReference, { replayed: true });
    }

    const rateLimit = await applyRateLimit(database, request);
    if (!rateLimit.allowed) {
      return errorResponse(
        429,
        "RATE_LIMITED",
        "Too many booking requests were submitted. Please wait before trying again.",
        undefined,
        {
          "Retry-After": String(rateLimit.retryAfter),
          "RateLimit-Limit": String(rateLimit.limit),
          "RateLimit-Remaining": "0",
        },
      );
    }

    const saved = await saveBooking(
      database,
      result.booking,
      idempotencyKeyHash,
      requestHash,
    );
    if (saved.kind === "conflict") {
      return errorResponse(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "This Idempotency-Key was already used for a different booking request.",
      );
    }
    return bookingResponse(saved.reference, {
      replayed: saved.kind === "replayed",
      ...(saved.kind === "created" ? { rateLimit } : {}),
    });
  } catch {
    // Deliberately omit the database error: bound values can contain customer PII.
    console.error("Booking storage operation failed.");
    return errorResponse(
      503,
      "BOOKING_STORAGE_UNAVAILABLE",
      "Your booking request could not be saved right now. Please try again or contact PSI Performance directly.",
    );
  }
}
