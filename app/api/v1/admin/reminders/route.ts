import { env } from "cloudflare:workers";
import { getBookingD1 } from "../../../../../db";
import { getMelbourneDateParts, isRealIsoDate } from "../../booking-requests/contract";
import {
  adminError,
  adminJson,
  authorizeAdmin,
  readAdminIdempotencyKey,
  readJsonObject,
  sha256,
} from "../_auth";

const MAX_LIMIT = 50;
type ReminderKind = "appointment" | "service";
type RuntimeEnv = typeof env & {
  PSI_EMAIL_OUTBOX_ENABLED?: string;
  PSI_EMAIL_PROVIDER_NAME?: string;
  PSI_PUBLIC_APP_ORIGIN?: string;
};

interface ReminderRow {
  id: string;
  bookingRequestId: string;
  reference: string;
  email: string;
  firstName: string;
  dueAt: string;
  detail: string | number;
  state: string;
  unsubscribeTokenHash?: string;
  confirmedDate?: string;
  arrivalArrangement?: string;
}

function parseQuery(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const dueThrough = url.searchParams.get("dueThrough") ?? getMelbourneDateParts().isoDate;
  const limit = Number(url.searchParams.get("limit") ?? "25");
  if ((kind !== "appointment" && kind !== "service") || !isRealIsoDate(dueThrough)) {
    return null;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return null;
  return { kind, dueThrough, limit } as const;
}

function publicAppOrigin() {
  const runtime = env as RuntimeEnv;
  try {
    const origin = new URL(runtime.PSI_PUBLIC_APP_ORIGIN?.trim() ?? "");
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      (origin.pathname !== "/" && origin.pathname !== "")
    ) {
      return null;
    }
    return origin.origin;
  } catch {
    return null;
  }
}

function providerReady() {
  const runtime = env as RuntimeEnv;
  return (
    runtime.PSI_EMAIL_OUTBOX_ENABLED === "true" &&
    Boolean(runtime.PSI_EMAIL_PROVIDER_NAME?.trim()) &&
    Boolean(publicAppOrigin())
  );
}

async function dueRows(
  database: Awaited<ReturnType<typeof getBookingD1>>,
  kind: ReminderKind,
  dueThrough: string,
  limit: number,
) {
  if (kind === "service") {
    const result = await database
      .prepare(
        `SELECT
           j.id,
           j.booking_request_id AS bookingRequestId,
           r.public_reference AS reference,
           r.email_snapshot AS email,
           r.first_name_snapshot AS firstName,
           j.due_at AS dueAt,
           j.interval_months AS detail,
           j.state,
           j.unsubscribe_token_hash AS unsubscribeTokenHash
         FROM service_reminder_jobs j
         INNER JOIN booking_requests r ON r.id = j.booking_request_id
         WHERE j.state = 'scheduled' AND j.due_at <= ?
           AND j.recipient_email_hash IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM service_reminder_suppressions s
             WHERE s.recipient_email_hash = j.recipient_email_hash
           )
         ORDER BY j.due_at, j.id
         LIMIT ?`,
      )
      .bind(dueThrough, limit)
      .all<ReminderRow>();
    return result.results;
  }
  const result = await database
    .prepare(
      `SELECT
         j.id,
         j.booking_request_id AS bookingRequestId,
         r.public_reference AS reference,
         r.email_snapshot AS email,
         r.first_name_snapshot AS firstName,
         j.due_at AS dueAt,
         j.reminder_kind AS detail,
         j.state,
         r.confirmed_date AS confirmedDate,
         r.confirmed_arrival_arrangement AS arrivalArrangement
       FROM appointment_reminder_jobs j
       INNER JOIN booking_requests r ON r.id = j.booking_request_id
       WHERE j.state = 'scheduled' AND j.due_at <= ? AND r.state = 'confirmed'
       ORDER BY j.due_at, j.id
       LIMIT ?`,
    )
    .bind(dueThrough, limit)
    .all<ReminderRow>();
  return result.results;
}

function previewRow(row: ReminderRow, kind: ReminderKind) {
  return {
    id: row.id,
    reference: row.reference,
    to: row.email,
    dueAt: row.dueAt,
    kind,
    message:
      kind === "service"
        ? `PSI Performance: ${row.firstName}, are you ready for your next service? Rebook through the PSI app or contact our workshop. You can unsubscribe at any time.`
        : `PSI Performance appointment reminder for ${row.confirmedDate}. Reference ${row.reference}. This is a booking logistics message only.`,
  };
}

export async function GET(request: Request) {
  const authError = await authorizeAdmin(request);
  if (authError) return authError;
  const query = parseQuery(request);
  if (!query) return adminError(400, "INVALID_QUERY", "Choose a reminder kind, valid date and limit.");
  try {
    const database = await getBookingD1();
    const rows = await dueRows(database, query.kind, query.dueThrough, query.limit);
    return adminJson({
      mode: "preview",
      dispatchEnabled: providerReady(),
      reminders: rows.map((row) => previewRow(row, query.kind)),
      count: rows.length,
    });
  } catch {
    console.error("Reminder preview failed.");
    return adminError(503, "ADMIN_STORAGE_UNAVAILABLE", "Reminder preview is unavailable.");
  }
}

export async function POST(request: Request) {
  const authError = await authorizeAdmin(request);
  if (authError) return authError;
  const idempotencyKey = readAdminIdempotencyKey(request);
  if (!idempotencyKey) {
    return adminError(400, "INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key is required.");
  }
  const parsed = await readJsonObject(request, 4_096);
  if (parsed.error || !parsed.body) return parsed.error;
  const kind = parsed.body.kind;
  const dueThrough = parsed.body.dueThrough;
  const limit = parsed.body.limit ?? 25;
  const dispatch = parsed.body.dispatch === true;
  if (
    (kind !== "appointment" && kind !== "service") ||
    typeof dueThrough !== "string" ||
    !isRealIsoDate(dueThrough) ||
    !Number.isInteger(limit) ||
    Number(limit) < 1 ||
    Number(limit) > MAX_LIMIT
  ) {
    return adminError(422, "VALIDATION_FAILED", "Choose a reminder kind, date and limit.");
  }
  if (!dispatch) {
    return adminError(422, "DISPATCH_NOT_CONFIRMED", "Set dispatch to true after reviewing the due reminder preview.");
  }
  if (!providerReady()) {
    return adminError(
      503,
      "EMAIL_PROVIDER_NOT_CONFIGURED",
      "No reminders were queued. Email and the public HTTPS app origin must be configured first.",
    );
  }

  try {
    const database = await getBookingD1();
    const keyHash = await sha256(idempotencyKey);
    const requestHash = await sha256(JSON.stringify(parsed.body));
    const replay = await database
      .prepare("SELECT request_hash AS requestHash, response_json AS responseJson FROM admin_action_idempotency_keys WHERE key_hash = ?")
      .bind(keyHash)
      .first<{ requestHash: string; responseJson: string }>();
    if (replay) {
      if (replay.requestHash !== requestHash) {
        return adminError(409, "IDEMPOTENCY_KEY_REUSED", "This key was used for another reminder run.");
      }
      return adminJson(JSON.parse(replay.responseJson), 200, { "Idempotency-Replayed": "true" });
    }

    const rows = await dueRows(database, kind, dueThrough, Number(limit));
    const statements: D1PreparedStatement[] = [];
    const origin = publicAppOrigin();
    if (!origin) {
      return adminError(
        503,
        "EMAIL_PROVIDER_NOT_CONFIGURED",
        "No reminders were queued because the public HTTPS app origin is invalid.",
      );
    }
    for (const row of rows) {
      let unsubscribeUrl: string | undefined;
      if (kind === "service") {
        const token = await sha256(`psi-reminder-unsubscribe-v1:${row.id}`);
        if ((await sha256(token)) !== row.unsubscribeTokenHash) {
          throw new Error("Reminder unsubscribe token integrity check failed.");
        }
        unsubscribeUrl = `${origin}/api/v1/service-reminders/unsubscribe?token=${token}`;
      }
      const payload =
        kind === "service"
          ? {
              template: "service_rebooking_reminder",
              to: row.email,
              firstName: row.firstName,
              reference: row.reference,
              subject: "Are you ready for your next service?",
              message:
                "PSI Performance is checking whether you are ready for your next service. Rebook through the PSI app or contact our workshop when it suits you.",
              rebookUrl: origin,
              contactEmail: "info@psiperformance.com.au",
              unsubscribeUrl,
              containsReviewRequest: false,
              containsPackagePromotion: false,
            }
          : {
              template: "appointment_reminder",
              to: row.email,
              firstName: row.firstName,
              reference: row.reference,
              confirmedDate: row.confirmedDate,
              arrivalArrangement: row.arrivalArrangement,
              transactionalOnly: true,
            };
      statements.push(
        database
          .prepare(
            kind === "service"
              ? `INSERT OR IGNORE INTO integration_outbox (
                   id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
                 ) SELECT ?, ?, ?, ?, ?, ?
                    WHERE EXISTS (
                      SELECT 1 FROM service_reminder_jobs j
                       WHERE j.id = ? AND j.state = 'scheduled'
                         AND j.recipient_email_hash IS NOT NULL
                         AND NOT EXISTS (
                           SELECT 1 FROM service_reminder_suppressions s
                            WHERE s.recipient_email_hash = j.recipient_email_hash
                         )
                    )`
              : `INSERT OR IGNORE INTO integration_outbox (
                   id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
                 ) SELECT ?, ?, ?, ?, ?, ?
                    WHERE EXISTS (
                      SELECT 1 FROM appointment_reminder_jobs j
                      INNER JOIN booking_requests r ON r.id = j.booking_request_id
                       WHERE j.id = ? AND j.state = 'scheduled' AND r.state = 'confirmed'
                    )`,
          )
          .bind(
            `outbox_${crypto.randomUUID()}`,
            kind === "service" ? "service_reminder.customer_email" : "appointment_reminder.customer_email",
            kind === "service" ? "service_reminder" : "appointment_reminder",
            row.id,
            `${kind}-reminder:${row.id}`,
            JSON.stringify(payload),
            row.id,
          ),
        database
          .prepare(
            kind === "service"
              ? "UPDATE service_reminder_jobs SET state = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = 'scheduled'"
              : "UPDATE appointment_reminder_jobs SET state = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = 'scheduled'",
          )
          .bind(row.id),
      );
    }
    const responseBody = { mode: "dispatch", queued: rows.length, kind, dueThrough };
    statements.push(
      database
        .prepare("INSERT INTO admin_action_idempotency_keys (key_hash, request_hash, booking_request_id, response_json) VALUES (?, ?, 'reminder-runner', ?)")
        .bind(keyHash, requestHash, JSON.stringify(responseBody)),
    );
    await database.batch(statements);
    return adminJson(responseBody, 202, { "Idempotency-Replayed": "false" });
  } catch {
    console.error("Reminder dispatch queueing failed.");
    return adminError(503, "ADMIN_STORAGE_UNAVAILABLE", "No reminder run was completed.");
  }
}
