import { getBookingD1 } from "../../../../../../db";
import {
  integrationError,
  verifySignedProviderRequest,
} from "../_verify";

const MAX_BODY_BYTES = 8_192;

interface CancellationRow {
  checkoutId: string;
  checkoutState: string;
  providerCheckoutId: string | null;
  bookingRequestId: string;
  requestState: string;
  stateVersion: number;
  reference: string;
  email: string;
  firstName: string;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return integrationError(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON data.");
  }
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return integrationError(400, "INVALID_REQUEST", "The event could not be read.");
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return integrationError(413, "REQUEST_TOO_LARGE", "The provider event is too large.");
  }
  const verification = await verifySignedProviderRequest(request, rawBody);
  if (verification.error || !verification.provider) return verification.error;

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return integrationError(400, "INVALID_JSON", "The provider event is not valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return integrationError(400, "INVALID_REQUEST", "The provider event must be an object.");
  }
  const payload = body as Record<string, unknown>;
  const eventId = typeof payload.eventId === "string" ? payload.eventId.trim() : "";
  const checkoutId = typeof payload.checkoutId === "string" ? payload.checkoutId.trim() : "";
  const providerCheckoutId =
    typeof payload.providerCheckoutId === "string" ? payload.providerCheckoutId.trim() : "";
  const cancelledAt = typeof payload.cancelledAt === "string" ? payload.cancelledAt.trim() : "";
  if (
    payload.type !== "checkout.cancelled" ||
    payload.paymentCaptured !== false ||
    !/^[A-Za-z0-9._:-]{8,200}$/u.test(eventId) ||
    !/^checkout_[0-9a-f-]{36}$/iu.test(checkoutId) ||
    !/^[A-Za-z0-9._:-]{8,200}$/u.test(providerCheckoutId) ||
    !Number.isFinite(Date.parse(cancelledAt))
  ) {
    return integrationError(422, "VALIDATION_FAILED", "The checkout cancellation event is invalid.");
  }

  try {
    const database = await getBookingD1();
    const payloadHash = await sha256(rawBody);
    const processed = await database
      .prepare(
        "SELECT state, payload_hash AS payloadHash FROM payment_webhook_events WHERE provider = ? AND event_id = ?",
      )
      .bind(verification.provider, eventId)
      .first<{ state: string; payloadHash: string }>();
    if (processed && processed.payloadHash !== payloadHash) {
      return integrationError(409, "EVENT_CONFLICT", "This provider event identifier was reused with different data.");
    }
    if (processed?.state === "processed") {
      return Response.json(
        { accepted: true, state: "cancelled" },
        { headers: { "Cache-Control": "no-store", "Idempotency-Replayed": "true" } },
      );
    }
    if (processed) {
      return integrationError(409, "EVENT_ALREADY_RECEIVED", "This event is already being processed.");
    }

    const row = await database
      .prepare(
        `SELECT
           c.id AS checkoutId,
           c.state AS checkoutState,
           c.provider_checkout_id AS providerCheckoutId,
           r.id AS bookingRequestId,
           r.state AS requestState,
           r.state_version AS stateVersion,
           r.public_reference AS reference,
           r.email_snapshot AS email,
           r.first_name_snapshot AS firstName
         FROM booking_request_checkouts c
         INNER JOIN booking_requests r ON r.id = c.booking_request_id
         WHERE c.id = ? AND c.payment_provider = ?`,
      )
      .bind(checkoutId, verification.provider)
      .first<CancellationRow>();
    if (!row) return integrationError(404, "CHECKOUT_NOT_FOUND", "The checkout was not found.");
    if (
      row.checkoutState !== "cancellation_pending" ||
      row.requestState !== "awaiting_deposit" ||
      row.providerCheckoutId !== providerCheckoutId
    ) {
      return integrationError(409, "INVALID_STATE_TRANSITION", "This checkout is not awaiting provider cancellation.");
    }

    const customerMessage = {
      template: "booking_request_cancelled_after_checkout_invalidation",
      reference: row.reference,
      message:
        "Your unpaid PSI deposit link has been securely invalidated and the request is now cancelled. Contact PSI if you would like to arrange another date.",
      automaticRefundStarted: false,
    };
    await database.batch([
      database
        .prepare(
          "INSERT INTO booking_request_action_claims (booking_request_id, expected_version, action_key_hash) VALUES (?, ?, ?)",
        )
        .bind(row.bookingRequestId, row.stateVersion, payloadHash),
      database
        .prepare(
          "INSERT INTO payment_webhook_events (provider, event_id, event_type, payload_hash, state) VALUES (?, ?, 'checkout.cancelled', ?, 'received')",
        )
        .bind(verification.provider, eventId, payloadHash),
      database
        .prepare(
          "UPDATE booking_request_checkouts SET state = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = 'cancellation_pending'",
        )
        .bind(row.checkoutId),
      database
        .prepare(
          "UPDATE booking_requests SET state = 'cancelled', state_version = state_version + 1, cancelled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = 'awaiting_deposit' AND state_version = ?",
        )
        .bind(cancelledAt, row.bookingRequestId, row.stateVersion),
      database
        .prepare(
          "INSERT INTO booking_request_transitions (id, booking_request_id, from_state, to_state, action, actor) VALUES (?, ?, 'awaiting_deposit', 'cancelled', 'checkout_cancelled', 'payment_webhook')",
        )
        .bind(`transition_${crypto.randomUUID()}`, row.bookingRequestId),
      database
        .prepare(
          "INSERT OR IGNORE INTO integration_outbox (id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json) VALUES (?, 'booking_cancelled.customer_email', 'booking_request', ?, ?, ?)",
        )
        .bind(
          `outbox_${crypto.randomUUID()}`,
          row.bookingRequestId,
          `booking-cancelled-after-provider:customer:${row.bookingRequestId}`,
          JSON.stringify({ ...customerMessage, to: row.email, firstName: row.firstName }),
        ),
      database
        .prepare(
          "INSERT OR IGNORE INTO integration_outbox (id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json) VALUES (?, 'booking_cancelled.staff_email', 'booking_request', ?, ?, ?)",
        )
        .bind(
          `outbox_${crypto.randomUUID()}`,
          row.bookingRequestId,
          `booking-cancelled-after-provider:staff:${row.bookingRequestId}`,
          JSON.stringify({
            ...customerMessage,
            to: "info@psiperformance.com.au",
            provider: verification.provider,
            providerCheckoutId,
          }),
        ),
      database
        .prepare(
          "UPDATE payment_webhook_events SET state = 'processed', processed_at = CURRENT_TIMESTAMP WHERE provider = ? AND event_id = ?",
        )
        .bind(verification.provider, eventId),
    ]);
    return Response.json(
      { accepted: true, state: "cancelled" },
      { headers: { "Cache-Control": "no-store", "Idempotency-Replayed": "false" } },
    );
  } catch {
    console.error("Checkout cancellation event persistence failed.");
    return integrationError(503, "INTEGRATION_STORAGE_UNAVAILABLE", "The cancellation event could not be saved yet.");
  }
}
