import { env } from "cloudflare:workers";
import { getBookingD1 } from "../../../../../db";

const MAX_PATCH_BYTES = 4_096;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "completed",
  "cancelled",
] as const;

type BookingStatus = (typeof BOOKING_STATUSES)[number];
type RuntimeEnv = typeof env & { PSI_ADMIN_KEY?: string };

interface AdminBooking {
  reference: string;
  bookingType: string;
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
  arrivalWindow: string;
  notes: string;
  source: string;
  status: BookingStatus;
  consentPolicyVersion: string;
  consentedAt: string;
  createdAt: string;
}

const ADMIN_BOOKING_COLUMNS = `
  public_reference AS reference,
  booking_type AS bookingType,
  service_option AS serviceOption,
  customer_name AS customerName,
  email,
  phone,
  vehicle_make AS vehicleMake,
  vehicle_model AS vehicleModel,
  vehicle_year AS vehicleYear,
  registration,
  vin,
  preferred_date AS preferredDate,
  arrival_window AS arrivalWindow,
  notes,
  source,
  status,
  consent_policy_version AS consentPolicyVersion,
  consented_at AS consentedAt,
  created_at AS createdAt
`;

function adminError(
  status: number,
  code: string,
  message: string,
  extraHeaders?: HeadersInit,
) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  return Response.json({ error: { code, message } }, { status, headers });
}

function adminJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function sha256Bytes(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function constantTimeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([
    sha256Bytes(left),
    sha256Bytes(right),
  ]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }
  return difference === 0;
}

async function authorize(request: Request) {
  const configuredKey = (env as RuntimeEnv).PSI_ADMIN_KEY;
  if (!configuredKey || configuredKey.length < 32) {
    return adminError(
      503,
      "ADMIN_API_UNAVAILABLE",
      "The staff booking queue is not configured.",
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._~-]{32,256})$/u.exec(authorization);
  if (!match || !(await constantTimeEqual(match[1], configuredKey))) {
    return adminError(
      401,
      "UNAUTHORIZED",
      "A valid staff API credential is required.",
      { "WWW-Authenticate": "Bearer" },
    );
  }
  return null;
}

function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    typeof value === "string" &&
    (BOOKING_STATUSES as readonly string[]).includes(value)
  );
}

function readListParameters(request: Request) {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const rawStatus = url.searchParams.get("status");

  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT ||
    (rawLimit !== null && !/^\d+$/u.test(rawLimit))
  ) {
    return {
      parameters: null,
      error: adminError(
        400,
        "INVALID_QUERY",
        `limit must be an integer from 1 to ${MAX_LIMIT}.`,
      ),
    };
  }
  if (rawStatus !== null && !isBookingStatus(rawStatus)) {
    return {
      parameters: null,
      error: adminError(
        400,
        "INVALID_QUERY",
        "status must be requested, confirmed, completed, or cancelled.",
      ),
    };
  }

  return {
    parameters: { limit, status: rawStatus as BookingStatus | null },
    error: null,
  };
}

export async function GET(request: Request) {
  const authError = await authorize(request);
  if (authError) {
    return authError;
  }

  const parsed = readListParameters(request);
  if (parsed.error) {
    return parsed.error;
  }

  try {
    const database = await getBookingD1();
    const { limit, status } = parsed.parameters;
    const statement = status
      ? database
          .prepare(
            `SELECT ${ADMIN_BOOKING_COLUMNS}
             FROM bookings
             WHERE status = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ?`,
          )
          .bind(status, limit)
      : database
          .prepare(
            `SELECT ${ADMIN_BOOKING_COLUMNS}
             FROM bookings
             ORDER BY created_at DESC, id DESC
             LIMIT ?`,
          )
          .bind(limit);
    const result = await statement.all<AdminBooking>();
    return adminJson({ bookings: result.results, count: result.results.length });
  } catch {
    // Do not log query results or bound values: this route returns customer PII.
    console.error("Staff booking queue read failed.");
    return adminError(
      503,
      "ADMIN_STORAGE_UNAVAILABLE",
      "The staff booking queue is temporarily unavailable.",
    );
  }
}

export async function PATCH(request: Request) {
  const authError = await authorize(request);
  if (authError) {
    return authError;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return adminError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send the status update as application/json.",
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_PATCH_BYTES) {
    return adminError(413, "REQUEST_TOO_LARGE", "The status update is too large.");
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_PATCH_BYTES) {
      return adminError(413, "REQUEST_TOO_LARGE", "The status update is too large.");
    }
    body = JSON.parse(rawBody);
  } catch {
    return adminError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return adminError(400, "INVALID_REQUEST", "The request body must be a JSON object.");
  }

  const payload = body as Record<string, unknown>;
  const reference =
    typeof payload.reference === "string" ? payload.reference.trim() : "";
  if (!/^PSI-[A-F0-9]{32}$/u.test(reference)) {
    return adminError(422, "VALIDATION_FAILED", "Enter a valid PSI booking reference.");
  }
  if (!isBookingStatus(payload.status)) {
    return adminError(
      422,
      "VALIDATION_FAILED",
      "status must be requested, confirmed, completed, or cancelled.",
    );
  }

  try {
    const database = await getBookingD1();
    const updated = await database
      .prepare(
        `UPDATE bookings
         SET status = ?
         WHERE public_reference = ?
         RETURNING ${ADMIN_BOOKING_COLUMNS}`,
      )
      .bind(payload.status, reference)
      .first<AdminBooking>();

    if (!updated) {
      return adminError(404, "BOOKING_NOT_FOUND", "No booking matches that reference.");
    }
    return adminJson({ reference: updated.reference, status: updated.status });
  } catch {
    // Deliberately omit the database error to keep booking data out of logs.
    console.error("Staff booking status update failed.");
    return adminError(
      503,
      "ADMIN_STORAGE_UNAVAILABLE",
      "The booking status could not be updated right now.",
    );
  }
}
