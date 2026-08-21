import { env } from "cloudflare:workers";
import { getBookingD1 } from "../../../../db";
import {
  isValidBookingEmail,
  isValidBookingMobile,
  isValidVehicleRegistration,
  isValidVin,
} from "../../../lib/booking-inputs";
import {
  depositAmountForBookingType,
  serviceOptionForBookingType,
  type CheckoutBookingType,
} from "../booking-catalog/catalog";
import {
  validatePartialTuningDetails,
  validateTuningDetails,
  type PartialTuningDetails,
  type TuningDetails,
  type TuningDetailsFieldName,
} from "../booking-checkouts/tuning-details";
import {
  BOOKING_POLICY_VERSION,
  DEPOSIT_POLICY_VERSION,
  addMonthsToIsoDate,
  dateEligibilityMessage,
  getMelbourneDateParts,
  isArrivalArrangement,
  isEligibleBookingDate,
  isRealIsoDate,
  type ArrivalArrangement,
} from "./contract";

const MAX_REQUEST_BYTES = 24_000;
const IDEMPOTENCY_KEY_MIN_LENGTH = 16;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_MAX_REQUESTS = 5;
const REQUEST_STATE = "pending_staff_review" as const;

type RuntimeEnv = typeof env & {
  PSI_EMAIL_OUTBOX_ENABLED?: string;
  PSI_EMAIL_PROVIDER_NAME?: string;
};
type JsonObject = Record<string, unknown>;
type BookingDatabase = Awaited<ReturnType<typeof getBookingD1>>;
type FieldName =
  | "bookingType"
  | "firstName"
  | "lastName"
  | "email"
  | "mobile"
  | "vehicleMake"
  | "vehicleModel"
  | "vehicleYear"
  | "registration"
  | "vin"
  | "appointmentPreference"
  | "appointmentPreference.mode"
  | "appointmentPreference.preferredDate"
  | "arrivalArrangement"
  | "afterHoursCollection"
  | "notifyEarlierAvailability"
  | "serviceReminderConsent"
  | "requestDetails"
  | "source"
  | "consent"
  | "bookingTermsAccepted"
  | "bookingPolicyVersion"
  | "setupConfidence"
  | "depositAmountCents"
  | "currency"
  | TuningDetailsFieldName;
type FieldErrors = Partial<Record<FieldName, string>>;

interface ValidBookingRequest {
  bookingType: CheckoutBookingType;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  registration: string;
  vin: string;
  appointmentPreference:
    | { mode: "specific"; preferredDate: string }
    | { mode: "flexible"; preferredDate: null };
  arrivalArrangement: ArrivalArrangement;
  afterHoursCollection: boolean;
  notifyEarlierAvailability: boolean;
  serviceReminderConsent: boolean;
  requestDetails: string;
  source: "web" | "mobile";
  consent: true;
  bookingTermsAccepted: true;
  bookingPolicyVersion: typeof BOOKING_POLICY_VERSION;
  depositPolicyVersion: typeof DEPOSIT_POLICY_VERSION;
  setupConfidence: "known" | "psi_inspection" | null;
  tuningDetails: TuningDetails | PartialTuningDetails | null;
}

interface ExistingRequest {
  requestHash: string;
  reference: string;
  state: string;
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
    { error: { code, message, ...(fields && Object.keys(fields).length ? { fields } : {}) } },
    { status, headers },
  );
}

function successResponse(reference: string, replayed: boolean, status = 201) {
  return Response.json(
    {
      reference,
      state: REQUEST_STATE,
      paymentRequiredNow: false,
      message:
        "Your booking request has been saved for PSI to review. Your selected date is not confirmed yet. PSI will confirm it or contact you to arrange another suitable date before sending any deposit link.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Idempotency-Replayed": replayed ? "true" : "false",
      },
    },
  );
}

function textField(
  body: JsonObject,
  field: keyof JsonObject & FieldName,
  maxLength: number,
  errors: FieldErrors,
  options: { required?: boolean; allowNewlines?: boolean } = {},
) {
  const raw = body[field];
  if (raw === undefined || raw === null) {
    if (options.required) errors[field] = "This field is required.";
    return "";
  }
  if (typeof raw !== "string") {
    errors[field] = "Must be text.";
    return "";
  }
  const value = raw.trim();
  if (options.required && !value) errors[field] = "This field is required.";
  else if (value.length > maxLength) errors[field] = `Must be ${maxLength} characters or fewer.`;
  else if (
    Array.from(value).some((character) => {
      const point = character.codePointAt(0) ?? 0;
      if (options.allowNewlines && [9, 10, 13].includes(point)) return false;
      return point < 32 || (point >= 127 && point <= 159);
    })
  ) {
    errors[field] = "Contains unsupported control characters.";
  }
  return value;
}

function requiredBoolean(body: JsonObject, field: FieldName, errors: FieldErrors) {
  const value = body[field];
  if (typeof value !== "boolean") {
    errors[field] = "Choose yes or no.";
    return false;
  }
  return value;
}

function parseAppointmentPreference(
  body: JsonObject,
  bookingType: CheckoutBookingType | null,
  errors: FieldErrors,
) {
  const raw = body.appointmentPreference;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    errors.appointmentPreference = "Choose a preferred date or select I'm flexible.";
    return { mode: "flexible" as const, preferredDate: null };
  }
  const preference = raw as JsonObject;
  const mode = preference.mode;
  if (mode !== "specific" && mode !== "flexible") {
    errors["appointmentPreference.mode"] = "Choose a preferred date or select I'm flexible.";
    return { mode: "flexible" as const, preferredDate: null };
  }
  if (mode === "flexible") {
    if (Object.hasOwn(preference, "preferredDate") && preference.preferredDate != null) {
      errors["appointmentPreference.preferredDate"] =
        "Remove the preferred date when selecting I'm flexible.";
    }
    return { mode, preferredDate: null };
  }

  const preferredDate =
    typeof preference.preferredDate === "string" ? preference.preferredDate.trim() : "";
  const today = getMelbourneDateParts().isoDate;
  if (!isRealIsoDate(preferredDate)) {
    errors["appointmentPreference.preferredDate"] = "Choose a valid preferred date.";
  } else if (preferredDate < today) {
    errors["appointmentPreference.preferredDate"] = "The preferred date cannot be in the past.";
  } else if (preferredDate > addMonthsToIsoDate(today, 18)) {
    errors["appointmentPreference.preferredDate"] =
      "Choose a preferred date within the next 18 months.";
  } else if (bookingType && !isEligibleBookingDate(bookingType, preferredDate)) {
    errors["appointmentPreference.preferredDate"] = dateEligibilityMessage(bookingType);
  }
  return { mode, preferredDate };
}

function validatePayload(body: JsonObject):
  | { value: ValidBookingRequest; errors: null }
  | { value: null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const rawBookingType = textField(body, "bookingType", 16, errors, { required: true });
  const bookingType =
    rawBookingType === "service" || rawBookingType === "dyno"
      ? rawBookingType
      : null;
  if (!bookingType && !errors.bookingType) errors.bookingType = "Choose Service or Dyno Tuning.";
  const firstName = textField(body, "firstName", 80, errors, { required: true });
  const lastName = textField(body, "lastName", 80, errors, { required: true });
  const email = textField(body, "email", 254, errors, { required: true }).toLowerCase();
  const mobile = textField(body, "mobile", 32, errors, { required: true });
  const vehicleMake = textField(body, "vehicleMake", 60, errors, { required: true });
  const vehicleModel = textField(body, "vehicleModel", 80, errors, { required: true });
  const registration = textField(body, "registration", 20, errors, { required: true }).toUpperCase();
  const vin = textField(body, "vin", 32, errors).toUpperCase();
  const requestDetails = textField(body, "requestDetails", 2_000, errors, {
    required: true,
    allowNewlines: true,
  });
  const source = textField(body, "source", 16, errors, { required: true });
  const bookingPolicyVersion = textField(body, "bookingPolicyVersion", 64, errors, {
    required: true,
  });
  const appointmentPreference = parseAppointmentPreference(body, bookingType, errors);

  if (!errors.email && !isValidBookingEmail(email)) errors.email = "Enter a valid email address.";
  if (!errors.mobile && !isValidBookingMobile(mobile)) {
    errors.mobile = "Enter a valid mobile number with 8 to 15 digits.";
  }
  if (registration && !isValidVehicleRegistration(registration)) {
    errors.registration = "Use only letters, numbers, spaces, dots, or hyphens.";
  }
  if (vin && !isValidVin(vin)) {
    errors.vin = "Enter a 17-character VIN. The letters I, O, and Q are not used.";
  }

  const rawYear = body.vehicleYear;
  const vehicleYear =
    typeof rawYear === "number" && Number.isInteger(rawYear)
      ? rawYear
      : typeof rawYear === "string" && /^\d{4}$/u.test(rawYear.trim())
        ? Number(rawYear.trim())
        : Number.NaN;
  const currentYear = getMelbourneDateParts().year;
  if (!Number.isInteger(vehicleYear) || vehicleYear < 1900 || vehicleYear > currentYear + 1) {
    errors.vehicleYear = `Enter a year from 1900 to ${currentYear + 1}.`;
  }

  if (!isArrivalArrangement(body.arrivalArrangement)) {
    errors.arrivalArrangement = "Choose a drop-off arrangement.";
  }
  const afterHoursCollection = requiredBoolean(body, "afterHoursCollection", errors);
  const notifyEarlierAvailability = requiredBoolean(
    body,
    "notifyEarlierAvailability",
    errors,
  );
  const serviceReminderConsent = requiredBoolean(body, "serviceReminderConsent", errors);
  if (source !== "web" && source !== "mobile") errors.source = "Must be web or mobile.";
  if (body.consent !== true) {
    errors.consent = "Consent is required so PSI can contact you about this request.";
  }
  if (body.bookingTermsAccepted !== true) {
    errors.bookingTermsAccepted = "Accept the booking and deposit terms before continuing.";
  }
  if (bookingPolicyVersion !== BOOKING_POLICY_VERSION) {
    errors.bookingPolicyVersion = "Review and accept the current booking policy.";
  }
  if (Object.hasOwn(body, "depositAmountCents")) {
    errors.depositAmountCents = "The deposit amount is set securely by PSI.";
  }
  if (Object.hasOwn(body, "currency")) errors.currency = "The currency is set securely by PSI.";

  let setupConfidence: ValidBookingRequest["setupConfidence"] = null;
  let tuningDetails: ValidBookingRequest["tuningDetails"] = null;
  if (bookingType === "dyno") {
    if (body.setupConfidence !== "known" && body.setupConfidence !== "psi_inspection") {
      errors.setupConfidence = "Choose whether you know the setup or would like PSI to inspect it.";
    } else {
      setupConfidence = body.setupConfidence;
      const result =
        setupConfidence === "known"
          ? validateTuningDetails(body.tuningDetails)
          : validatePartialTuningDetails(body.tuningDetails);
      if (result.errors) Object.assign(errors, result.errors);
      else tuningDetails = result.details;
    }
  } else if (bookingType === "service") {
    if (Object.hasOwn(body, "setupConfidence")) {
      errors.setupConfidence = "Setup confidence applies only to dyno bookings.";
    }
    if (Object.hasOwn(body, "tuningDetails")) {
      errors.tuningDetails = "Tuning details apply only to dyno bookings.";
    }
  }

  if (Object.keys(errors).length || !bookingType || !isArrivalArrangement(body.arrivalArrangement)) {
    return { value: null, errors };
  }
  return {
    value: {
      bookingType,
      firstName,
      lastName,
      email,
      mobile,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      registration,
      vin,
      appointmentPreference,
      arrivalArrangement: body.arrivalArrangement,
      afterHoursCollection,
      notifyEarlierAvailability,
      serviceReminderConsent,
      requestDetails,
      source: source as "web" | "mobile",
      consent: true,
      bookingTermsAccepted: true,
      bookingPolicyVersion: BOOKING_POLICY_VERSION,
      depositPolicyVersion: DEPOSIT_POLICY_VERSION,
      setupConfidence,
      tuningDetails,
    },
    errors: null,
  };
}

function validateIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key");
  if (
    !value ||
    value.length < IDEMPOTENCY_KEY_MIN_LENGTH ||
    value.length > IDEMPOTENCY_KEY_MAX_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  ) {
    return null;
  }
  return value;
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function rateLimitIdentity(request: Request) {
  const value = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  return value && value.length <= 64 && /^[0-9a-f:.]+$/iu.test(value)
    ? value.toLowerCase()
    : "unavailable";
}

async function applyRateLimit(database: BookingDatabase, request: Request) {
  const now = Math.floor(Date.now() / 1_000);
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_SECONDS) * RATE_LIMIT_WINDOW_SECONDS;
  const retryAfter = Math.max(1, windowStart + RATE_LIMIT_WINDOW_SECONDS - now);
  const ipHash = await sha256(`psi-booking-request-v1:${rateLimitIdentity(request)}`);
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
    .bind(ipHash, windowStart)
    .first<{ requestCount: number }>();
  if (!row || !Number.isInteger(row.requestCount)) throw new Error("Missing rate-limit result.");
  return {
    allowed: row.requestCount <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - row.requestCount),
    retryAfter,
  };
}

async function findExisting(database: BookingDatabase, keyHash: string) {
  return database
    .prepare(
      `SELECT i.request_hash AS requestHash, r.public_reference AS reference, r.state
       FROM booking_request_idempotency_keys i
       INNER JOIN booking_requests r ON r.id = i.booking_request_id
       WHERE i.key_hash = ?`,
    )
    .bind(keyHash)
    .first<ExistingRequest>();
}

function emailOutboxEnabled() {
  const runtime = env as RuntimeEnv;
  return (
    runtime.PSI_EMAIL_OUTBOX_ENABLED === "true" &&
    typeof runtime.PSI_EMAIL_PROVIDER_NAME === "string" &&
    runtime.PSI_EMAIL_PROVIDER_NAME.trim().length > 0
  );
}

function publicReference() {
  return `PSI-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
}

export async function POST(request: Request) {
  const idempotencyKey = validateIdempotencyKey(request);
  if (!idempotencyKey) {
    return errorResponse(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "An Idempotency-Key of 16 to 128 safe characters is required.",
    );
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request as application/json.");
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) {
    return errorResponse(413, "REQUEST_TOO_LARGE", "The booking request is too large.");
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return errorResponse(413, "REQUEST_TOO_LARGE", "The booking request is too large.");
    }
    body = JSON.parse(raw);
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
  if (typeof payload.company === "string" && payload.company.trim()) {
    return errorResponse(400, "INVALID_REQUEST", "The booking request is invalid.");
  }

  const parsed = validatePayload(payload);
  if (parsed.errors) {
    return errorResponse(
      422,
      "VALIDATION_FAILED",
      "Please correct the highlighted booking details.",
      parsed.errors,
    );
  }

  try {
    const database = await getBookingD1();
    const keyHash = await sha256(idempotencyKey);
    const requestHash = await sha256(JSON.stringify(parsed.value));
    const existing = await findExisting(database, keyHash);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return errorResponse(
          409,
          "IDEMPOTENCY_KEY_REUSED",
          "This Idempotency-Key was already used for different booking details.",
        );
      }
      return successResponse(existing.reference, true, 200);
    }

    const rateLimit = await applyRateLimit(database, request);
    if (!rateLimit.allowed) {
      return errorResponse(429, "RATE_LIMITED", "Too many booking requests were submitted. Please wait before trying again.", undefined, {
        "Retry-After": String(rateLimit.retryAfter),
        "RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
        "RateLimit-Remaining": "0",
      });
    }

    const value = parsed.value;
    const bookingRequestId = `request_${crypto.randomUUID()}`;
    const reference = publicReference();
    const transitionId = `transition_${crypto.randomUUID()}`;
    const outboxStatements: D1PreparedStatement[] = [];
    if (emailOutboxEnabled()) {
      const customerPayload = JSON.stringify({
        template: "booking_request_received",
        to: value.email,
        reference,
        paymentRequiredNow: false,
      });
      const staffPayload = JSON.stringify({
        template: "staff_booking_request_received",
        to: "info@psiperformance.com.au",
        reference,
      });
      outboxStatements.push(
        database
          .prepare(
            `INSERT OR IGNORE INTO integration_outbox (
               id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
             ) VALUES (?, 'booking_request_received.customer_email', 'booking_request', ?, ?, ?)`,
          )
          .bind(
            `outbox_${crypto.randomUUID()}`,
            bookingRequestId,
            `booking-request-received:customer:${bookingRequestId}`,
            customerPayload,
          ),
        database
          .prepare(
            `INSERT OR IGNORE INTO integration_outbox (
               id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
             ) VALUES (?, 'booking_request_received.staff_email', 'booking_request', ?, ?, ?)`,
          )
          .bind(
            `outbox_${crypto.randomUUID()}`,
            bookingRequestId,
            `booking-request-received:staff:${bookingRequestId}`,
            staffPayload,
          ),
      );
    }

    await database.batch([
      database
        .prepare(
          `INSERT INTO booking_requests (
             id, public_reference, customer_profile_id, vehicle_id,
             first_name_snapshot, last_name_snapshot, email_snapshot, mobile_snapshot,
             vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot,
             registration_snapshot, vin_snapshot, booking_type,
             service_option, appointment_preference_mode, preferred_date,
             arrival_arrangement, after_hours_collection, notify_earlier_availability,
             service_reminder_consent, request_details, setup_confidence,
             tuning_details_json, source, contact_consent, booking_terms_accepted,
             booking_policy_version, deposit_policy_version, deposit_amount_cents,
             currency, state
           ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, 'AUD', ?)`,
        )
        .bind(
          bookingRequestId,
          reference,
          value.firstName,
          value.lastName,
          value.email,
          value.mobile,
          value.vehicleMake,
          value.vehicleModel,
          value.vehicleYear,
          value.registration,
          value.vin,
          value.bookingType,
          serviceOptionForBookingType(value.bookingType),
          value.appointmentPreference.mode,
          value.appointmentPreference.preferredDate,
          value.arrivalArrangement,
          value.afterHoursCollection ? 1 : 0,
          value.notifyEarlierAvailability ? 1 : 0,
          value.serviceReminderConsent ? 1 : 0,
          value.requestDetails,
          value.setupConfidence,
          value.tuningDetails ? JSON.stringify(value.tuningDetails) : null,
          value.source,
          value.bookingPolicyVersion,
          value.depositPolicyVersion,
          depositAmountForBookingType(value.bookingType),
          REQUEST_STATE,
        ),
      database
        .prepare(
          `INSERT INTO booking_request_idempotency_keys (
             key_hash, request_hash, booking_request_id
           ) VALUES (?, ?, ?)`,
        )
        .bind(keyHash, requestHash, bookingRequestId),
      database
        .prepare(
          `INSERT INTO booking_request_transitions (
             id, booking_request_id, from_state, to_state, action, actor
           ) VALUES (?, ?, NULL, ?, 'submit_request', 'customer')`,
        )
        .bind(transitionId, bookingRequestId, REQUEST_STATE),
      ...outboxStatements,
    ]);

    return Response.json(
      {
        reference,
        state: REQUEST_STATE,
        paymentRequiredNow: false,
        message:
          "Your booking request has been saved for PSI to review. Your selected date is not confirmed yet. PSI will confirm it or contact you to arrange another suitable date before sending any deposit link.",
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "Idempotency-Replayed": "false",
          "RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
          "RateLimit-Remaining": String(rateLimit.remaining),
        },
      },
    );
  } catch {
    // Customer and vehicle details must never be emitted to logs.
    console.error("Booking request persistence failed.");
    return errorResponse(
      503,
      "BOOKING_STORAGE_UNAVAILABLE",
      "Your request could not be saved right now. No payment was requested. Please try again.",
    );
  }
}
