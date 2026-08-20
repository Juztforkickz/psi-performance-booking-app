import { getBookingD1 } from "../../../../../../db";
import {
  DEPOSIT_CURRENCY,
  depositAmountForBookingType,
} from "../../../booking-catalog/catalog";
import {
  integrationError,
  integrationsReady,
  isAllowedProviderUrl,
  verifySignedProviderRequest,
} from "../_verify";

const MAX_BODY_BYTES = 8_192;

interface CheckoutRow {
  id: string;
  bookingRequestId: string;
  state: string;
  requestState: string;
  stateVersion: number;
  reference: string;
  bookingType: "service" | "dyno";
  email: string;
  firstName: string;
  depositAmountCents: number;
  currency: string;
  requestDepositAmountCents: number;
  requestCurrency: string;
  confirmedDate: string | null;
  confirmedArrivalArrangement: string | null;
  confirmedAllocationMode: "all_day" | "timed" | null;
  confirmedStartTime: string | null;
  confirmedEndTime: string | null;
  existingProviderCheckoutId: string | null;
  existingProviderCheckoutUrl: string | null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function POST(request: Request) {
  if (!integrationsReady()) {
    return integrationError(
      503,
      "INTEGRATIONS_NOT_CONFIGURED",
      "Checkout activation is disabled until payment, email and an explicit PSI Calendar are configured.",
    );
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return integrationError(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON data.");
  }
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return integrationError(400, "INVALID_REQUEST", "The request could not be read.");
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
  const checkoutId = typeof payload.checkoutId === "string" ? payload.checkoutId.trim() : "";
  const providerCheckoutId =
    typeof payload.providerCheckoutId === "string" ? payload.providerCheckoutId.trim() : "";
  const checkoutUrl = typeof payload.checkoutUrl === "string" ? payload.checkoutUrl.trim() : "";
  const expiresAt = typeof payload.expiresAt === "string" ? payload.expiresAt.trim() : "";
  if (
    !/^checkout_[0-9a-f-]{36}$/iu.test(checkoutId) ||
    !/^[A-Za-z0-9._:-]{8,200}$/u.test(providerCheckoutId) ||
    !isAllowedProviderUrl(checkoutUrl, "checkout") ||
    !Number.isFinite(Date.parse(expiresAt)) ||
    Date.parse(expiresAt) <= Date.now()
  ) {
    return integrationError(422, "VALIDATION_FAILED", "The checkout-ready event is invalid.");
  }

  try {
    const database = await getBookingD1();
    const row = await database
      .prepare(
        `SELECT
           c.id,
           c.booking_request_id AS bookingRequestId,
           c.state,
           r.state AS requestState,
           r.state_version AS stateVersion,
           r.public_reference AS reference,
           r.booking_type AS bookingType,
           r.email_snapshot AS email,
           r.first_name_snapshot AS firstName,
           c.deposit_amount_cents AS depositAmountCents,
           c.currency,
           r.deposit_amount_cents AS requestDepositAmountCents,
           r.currency AS requestCurrency,
           r.confirmed_date AS confirmedDate,
           r.confirmed_arrival_arrangement AS confirmedArrivalArrangement,
           r.confirmed_allocation_mode AS confirmedAllocationMode,
           r.confirmed_start_time AS confirmedStartTime,
           r.confirmed_end_time AS confirmedEndTime,
           c.provider_checkout_id AS existingProviderCheckoutId,
           c.provider_checkout_url AS existingProviderCheckoutUrl
         FROM booking_request_checkouts c
         INNER JOIN booking_requests r ON r.id = c.booking_request_id
         WHERE c.id = ? AND c.payment_provider = ?`,
      )
      .bind(checkoutId, verification.provider)
      .first<CheckoutRow>();
    if (!row) return integrationError(404, "CHECKOUT_NOT_FOUND", "The approved checkout was not found.");
    if (row.state === "awaiting_payment") {
      if (
        row.existingProviderCheckoutId === providerCheckoutId &&
        row.existingProviderCheckoutUrl === checkoutUrl
      ) {
        return Response.json(
          { accepted: true, state: "awaiting_deposit" },
          { headers: { "Cache-Control": "no-store", "Idempotency-Replayed": "true" } },
        );
      }
      return integrationError(409, "CHECKOUT_CONFLICT", "A different checkout is already active.");
    }
    if (row.state !== "provider_pending" || row.requestState !== "date_approved") {
      return integrationError(409, "INVALID_STATE_TRANSITION", "This checkout is not awaiting provider creation.");
    }
    const canonicalAmountCents = depositAmountForBookingType(row.bookingType);
    if (
      row.depositAmountCents !== canonicalAmountCents ||
      row.requestDepositAmountCents !== canonicalAmountCents ||
      row.currency !== DEPOSIT_CURRENCY ||
      row.requestCurrency !== DEPOSIT_CURRENCY
    ) {
      return integrationError(
        409,
        "BOOKING_AMOUNT_MISMATCH",
        "The provider checkout does not match PSI's approved deposit amount.",
      );
    }
    if (
      !row.confirmedDate ||
      !row.confirmedArrivalArrangement ||
      !["all_day", "timed"].includes(row.confirmedAllocationMode ?? "") ||
      (row.confirmedAllocationMode === "timed" &&
        (!row.confirmedStartTime || !row.confirmedEndTime))
    ) {
      return integrationError(
        409,
        "APPROVED_DATE_INCOMPLETE",
        "The staff-approved date and workshop allocation must be complete before a deposit link is sent.",
      );
    }

    const depositEmailPayload = JSON.stringify({
      template: "approved_booking_deposit_request",
      to: row.email,
      firstName: row.firstName,
      reference: row.reference,
      checkoutUrl,
      expiresAt,
      approvedAppointment: {
        date: row.confirmedDate,
        arrivalArrangement: row.confirmedArrivalArrangement,
        allocationMode: row.confirmedAllocationMode,
        startTime: row.confirmedStartTime,
        endTime: row.confirmedEndTime,
        timeZone: "Australia/Melbourne",
      },
      deposit: { amountCents: row.depositAmountCents, currency: row.currency },
      depositPolicyVersion: "psi-deposit-v3",
      depositPolicy:
        "Once paid, the deposit ordinarily cannot be refunded because PSI reserves technician time, hoist or dyno capacity and workshop planning for your vehicle. If PSI needs to move your booking, we will work with you to reschedule and keep the deposit attached to the agreed replacement date, or provide another remedy where required. Nothing in this policy limits rights that cannot be excluded under the Australian Consumer Law.",
    });
    const actionKeyHash = await sha256(
      `checkout-ready:${verification.provider}:${rawBody}`,
    );
    await database.batch([
      database
        .prepare(
          `INSERT INTO booking_request_action_claims (
             booking_request_id, expected_version, action_key_hash
           ) VALUES (?, ?, ?)`,
        )
        .bind(row.bookingRequestId, row.stateVersion, actionKeyHash),
      database
        .prepare(
          `UPDATE booking_request_checkouts
           SET state = 'awaiting_payment', provider_checkout_id = ?, provider_checkout_url = ?,
               expires_at = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND state = 'provider_pending'`,
        )
        .bind(providerCheckoutId, checkoutUrl, expiresAt, checkoutId),
      database
        .prepare(
          `UPDATE booking_requests
              SET state = 'awaiting_deposit', state_version = state_version + 1,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND state = 'date_approved' AND state_version = ?`,
        )
        .bind(row.bookingRequestId, row.stateVersion),
      database
        .prepare(
          `INSERT INTO booking_request_transitions (
             id, booking_request_id, from_state, to_state, action, actor
           ) VALUES (?, ?, 'date_approved', 'awaiting_deposit', 'checkout_ready', 'system')`,
        )
        .bind(`transition_${crypto.randomUUID()}`, row.bookingRequestId),
      database
        .prepare(
          `INSERT OR IGNORE INTO integration_outbox (
             id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
           ) VALUES (?, 'deposit_request.customer_email', 'booking_request', ?, ?, ?)`,
        )
        .bind(
          `outbox_${crypto.randomUUID()}`,
          row.bookingRequestId,
          `deposit-request:customer:${row.bookingRequestId}:${checkoutId}`,
          depositEmailPayload,
        ),
    ]);
    return Response.json(
      { accepted: true, state: "awaiting_deposit" },
      { headers: { "Cache-Control": "no-store", "Idempotency-Replayed": "false" } },
    );
  } catch {
    console.error("Checkout-ready event persistence failed.");
    return integrationError(503, "INTEGRATION_STORAGE_UNAVAILABLE", "The provider event could not be saved.");
  }
}
