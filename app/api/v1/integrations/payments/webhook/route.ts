import { getBookingD1 } from "../../../../../../db";
import {
  DEPOSIT_CURRENCY,
  depositAmountForBookingType,
} from "../../../booking-catalog/catalog";
import { getMelbourneDateParts } from "../../../booking-requests/contract";
import {
  integrationError,
  isAllowedProviderUrl,
  verifySignedProviderRequest,
} from "../_verify";

const MAX_BODY_BYTES = 16_384;

interface PayableCheckout {
  checkoutId: string;
  checkoutState: string;
  bookingRequestId: string;
  requestState: string;
  stateVersion: number;
  reference: string;
  bookingType: "service" | "dyno";
  confirmedDate: string;
  confirmedArrivalArrangement: string;
  confirmedAllocationMode: "all_day" | "timed";
  confirmedStartTime: string | null;
  confirmedEndTime: string | null;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  vehicleMake: string;
  vehicleModel: string;
  registration: string;
  expectedAmountCents: number;
  currency: string;
  requestDepositAmountCents: number;
  requestCurrency: string;
  calendarIdSnapshot: string | null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
    return integrationError(413, "REQUEST_TOO_LARGE", "The payment event is too large.");
  }
  const verification = await verifySignedProviderRequest(request, rawBody);
  if (verification.error || !verification.provider) return verification.error;

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return integrationError(400, "INVALID_JSON", "The payment event is not valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return integrationError(400, "INVALID_REQUEST", "The payment event must be an object.");
  }
  const payload = body as Record<string, unknown>;
  const eventId = typeof payload.eventId === "string" ? payload.eventId.trim() : "";
  const checkoutId = typeof payload.checkoutId === "string" ? payload.checkoutId.trim() : "";
  const providerPaymentId =
    typeof payload.providerPaymentId === "string" ? payload.providerPaymentId.trim() : "";
  const paidAt = typeof payload.paidAt === "string" ? payload.paidAt.trim() : "";
  const rawReceiptUrl =
    typeof payload.providerReceiptUrl === "string" ? payload.providerReceiptUrl.trim() : null;
  const receiptUrl =
    rawReceiptUrl && isAllowedProviderUrl(rawReceiptUrl, "receipt")
      ? rawReceiptUrl
      : null;
  if (
    payload.type !== "payment.succeeded" ||
    !/^[A-Za-z0-9._:-]{8,200}$/u.test(eventId) ||
    !/^checkout_[0-9a-f-]{36}$/iu.test(checkoutId) ||
    !/^[A-Za-z0-9._:-]{8,200}$/u.test(providerPaymentId) ||
    !Number.isInteger(payload.amountCents) ||
    payload.currency !== "AUD" ||
    !Number.isFinite(Date.parse(paidAt)) ||
    (rawReceiptUrl !== null && rawReceiptUrl.length > 2_000)
  ) {
    return integrationError(422, "VALIDATION_FAILED", "The payment event is invalid.");
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
      return integrationError(
        409,
        "EVENT_CONFLICT",
        "This provider event identifier was already used with different payment data.",
      );
    }
    if (processed?.state === "processed") {
      return Response.json(
        { accepted: true, state: "confirmed" },
        { headers: { "Cache-Control": "no-store", "Idempotency-Replayed": "true" } },
      );
    }
    if (processed) {
      return integrationError(409, "EVENT_ALREADY_RECEIVED", "This event is already being processed.");
    }

    const checkout = await database
      .prepare(
        `SELECT
           c.id AS checkoutId,
           c.state AS checkoutState,
           r.id AS bookingRequestId,
           r.state AS requestState,
           r.state_version AS stateVersion,
           r.public_reference AS reference,
           r.booking_type AS bookingType,
           r.confirmed_date AS confirmedDate,
           r.confirmed_arrival_arrangement AS confirmedArrivalArrangement,
           r.confirmed_allocation_mode AS confirmedAllocationMode,
           r.confirmed_start_time AS confirmedStartTime,
           r.confirmed_end_time AS confirmedEndTime,
           r.first_name_snapshot AS firstName,
           r.last_name_snapshot AS lastName,
           r.email_snapshot AS email,
           r.mobile_snapshot AS mobile,
           r.vehicle_make_snapshot AS vehicleMake,
           r.vehicle_model_snapshot AS vehicleModel,
           r.registration_snapshot AS registration,
           c.deposit_amount_cents AS expectedAmountCents,
           c.currency,
           r.deposit_amount_cents AS requestDepositAmountCents,
           r.currency AS requestCurrency
           ,c.calendar_id_snapshot AS calendarIdSnapshot
         FROM booking_request_checkouts c
         INNER JOIN booking_requests r ON r.id = c.booking_request_id
         WHERE c.id = ? AND c.payment_provider = ?`,
      )
      .bind(checkoutId, verification.provider)
      .first<PayableCheckout>();
    if (!checkout) return integrationError(404, "CHECKOUT_NOT_FOUND", "The checkout was not found.");
    if (
      !["awaiting_payment", "processing", "cancellation_pending"].includes(checkout.checkoutState) ||
      checkout.requestState !== "awaiting_deposit"
    ) {
      return integrationError(409, "INVALID_STATE_TRANSITION", "This booking is not awaiting deposit verification.");
    }
    const canonicalAmountCents = depositAmountForBookingType(checkout.bookingType);
    if (
      payload.amountCents !== checkout.expectedAmountCents ||
      payload.currency !== checkout.currency ||
      checkout.expectedAmountCents !== canonicalAmountCents ||
      checkout.currency !== DEPOSIT_CURRENCY ||
      checkout.requestDepositAmountCents !== canonicalAmountCents ||
      checkout.requestCurrency !== DEPOSIT_CURRENCY ||
      !checkout.calendarIdSnapshot ||
      checkout.calendarIdSnapshot.toLowerCase() === "primary" ||
      !checkout.confirmedDate ||
      !checkout.confirmedArrivalArrangement ||
      !["all_day", "timed"].includes(checkout.confirmedAllocationMode) ||
      (checkout.confirmedAllocationMode === "timed" &&
        (!checkout.confirmedStartTime || !checkout.confirmedEndTime))
    ) {
      return integrationError(409, "PAYMENT_MISMATCH", "The verified payment does not match the approved booking.");
    }

    const paymentId = `payment_${crypto.randomUUID()}`;
    const calendarId = checkout.calendarIdSnapshot;
    const calendarSyncId = `calendar_${crypto.randomUUID()}`;
    const calendarEnd = addDays(checkout.confirmedDate, 1);
    const calendarPayload = JSON.stringify({
      calendarId,
      reference: checkout.reference,
      summary: `${checkout.bookingType === "dyno" ? "Dyno" : "Service"}: ${checkout.vehicleMake} ${checkout.vehicleModel} (${checkout.registration})`,
      description: `PSI internal booking ${checkout.reference}. Arrival: ${checkout.confirmedArrivalArrangement}.`,
      ...(checkout.confirmedAllocationMode === "all_day"
        ? {
            start: { date: checkout.confirmedDate },
            end: { date: calendarEnd },
          }
        : {
            start: {
              dateTime: `${checkout.confirmedDate}T${checkout.confirmedStartTime}:00`,
              timeZone: "Australia/Melbourne",
            },
            end: {
              dateTime: `${checkout.confirmedDate}T${checkout.confirmedEndTime}:00`,
              timeZone: "Australia/Melbourne",
            },
          }),
      visibility: "private",
      transparency: "opaque",
      attendees: [],
      sendUpdates: "none",
    });
    const confirmation = {
      template: "paid_booking_confirmation",
      reference: checkout.reference,
      confirmedDate: checkout.confirmedDate,
      arrivalArrangement: checkout.confirmedArrivalArrangement,
      allocationMode: checkout.confirmedAllocationMode,
      startTime: checkout.confirmedStartTime,
      endTime: checkout.confirmedEndTime,
      deposit: {
        amountCents: checkout.expectedAmountCents,
        currency: checkout.currency,
        providerReceiptUrl: receiptUrl,
      },
    };
    const appointmentReminderStatements: D1PreparedStatement[] = [];
    const today = getMelbourneDateParts().isoDate;
    for (const [kind, days] of [
      ["seven_days", -7],
      ["twenty_four_hours", -1],
    ] as const) {
      const dueAt = addDays(checkout.confirmedDate, days);
      if (dueAt <= today) continue;
      appointmentReminderStatements.push(
        database
          .prepare(
            `INSERT OR IGNORE INTO appointment_reminder_jobs (
               id, booking_request_id, reminder_kind, due_at, state, schedule_version
             ) VALUES (?, ?, ?, ?, 'scheduled', 1)`,
          )
          .bind(`appointment_reminder_${crypto.randomUUID()}`, checkout.bookingRequestId, kind, dueAt),
      );
    }

    await database.batch([
      database
        .prepare(
          `INSERT INTO booking_request_action_claims (
             booking_request_id, expected_version, action_key_hash
           ) VALUES (?, ?, ?)`,
        )
        .bind(checkout.bookingRequestId, checkout.stateVersion, payloadHash),
      database
        .prepare(
          `INSERT INTO payment_webhook_events (
             provider, event_id, event_type, payload_hash, state
           ) VALUES (?, ?, 'payment.succeeded', ?, 'received')`,
        )
        .bind(verification.provider, eventId, payloadHash),
      database
        .prepare(
          `INSERT INTO booking_request_payments (
             id, booking_request_id, checkout_id, provider, provider_payment_id,
             amount_cents, currency, status, provider_receipt_url, paid_at
           ) VALUES (?, ?, ?, ?, ?, ?, 'AUD', 'verified', ?, ?)`,
        )
        .bind(
          paymentId,
          checkout.bookingRequestId,
          checkout.checkoutId,
          verification.provider,
          providerPaymentId,
          checkout.expectedAmountCents,
          receiptUrl,
          paidAt,
        ),
      database
        .prepare("UPDATE booking_request_checkouts SET state = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state IN ('awaiting_payment', 'processing', 'cancellation_pending')")
        .bind(checkout.checkoutId),
      database
        .prepare(
          `UPDATE integration_outbox
              SET state = 'dead_letter', last_error_code = 'PAYMENT_COMPLETED',
                  updated_at = CURRENT_TIMESTAMP
            WHERE dedupe_key = ? AND kind = 'payment_checkout.cancel'
              AND state IN ('pending', 'processing', 'failed')`,
        )
        .bind(`payment-checkout:cancel:${checkout.checkoutId}`),
      database
        .prepare("UPDATE booking_requests SET state = 'confirmed', state_version = state_version + 1, deposit_payment_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = 'awaiting_deposit' AND state_version = ?")
        .bind(paymentId, checkout.bookingRequestId, checkout.stateVersion),
      database
        .prepare("INSERT INTO booking_request_transitions (id, booking_request_id, from_state, to_state, action, actor) VALUES (?, ?, 'awaiting_deposit', 'confirmed', 'payment_verified', 'payment_webhook')")
        .bind(`transition_${crypto.randomUUID()}`, checkout.bookingRequestId),
      database
        .prepare("INSERT INTO booking_request_calendar_events (id, booking_request_id, state, calendar_id) VALUES (?, ?, 'queued', ?)")
        .bind(calendarSyncId, checkout.bookingRequestId, calendarId),
      database
        .prepare("INSERT OR IGNORE INTO integration_outbox (id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json) VALUES (?, 'calendar.create_internal', 'booking_request', ?, ?, ?)")
        .bind(`outbox_${crypto.randomUUID()}`, checkout.bookingRequestId, `calendar:create:${checkout.bookingRequestId}`, calendarPayload),
      database
        .prepare("INSERT OR IGNORE INTO integration_outbox (id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json) VALUES (?, 'booking_confirmation.customer_email', 'booking_request', ?, ?, ?)")
        .bind(
          `outbox_${crypto.randomUUID()}`,
          checkout.bookingRequestId,
          `booking-confirmation:customer:${checkout.bookingRequestId}`,
          JSON.stringify({ ...confirmation, to: checkout.email, firstName: checkout.firstName }),
        ),
      database
        .prepare("INSERT OR IGNORE INTO integration_outbox (id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json) VALUES (?, 'booking_confirmation.staff_email', 'booking_request', ?, ?, ?)")
        .bind(
          `outbox_${crypto.randomUUID()}`,
          checkout.bookingRequestId,
          `booking-confirmation:staff:${checkout.bookingRequestId}`,
          JSON.stringify({
            ...confirmation,
            to: "info@psiperformance.com.au",
            customer: `${checkout.firstName} ${checkout.lastName}`,
            mobile: checkout.mobile,
          }),
        ),
      database
        .prepare("INSERT OR IGNORE INTO integration_outbox (id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json) VALUES (?, 'deposit_receipt.create', 'booking_request', ?, ?, ?)")
        .bind(
          `outbox_${crypto.randomUUID()}`,
          checkout.bookingRequestId,
          `deposit-receipt:${checkout.bookingRequestId}`,
          JSON.stringify({
            paymentId,
            reference: checkout.reference,
            customerName: `${checkout.firstName} ${checkout.lastName}`,
            customerEmail: checkout.email,
            amountCents: checkout.expectedAmountCents,
            currency: checkout.currency,
            providerReceiptUrl: receiptUrl,
          }),
        ),
      ...appointmentReminderStatements,
      database
        .prepare("UPDATE payment_webhook_events SET state = 'processed', processed_at = CURRENT_TIMESTAMP WHERE provider = ? AND event_id = ?")
        .bind(verification.provider, eventId),
    ]);

    return Response.json(
      { accepted: true, state: "confirmed" },
      { headers: { "Cache-Control": "no-store", "Idempotency-Replayed": "false" } },
    );
  } catch {
    console.error("Verified payment event persistence failed.");
    return integrationError(503, "INTEGRATION_STORAGE_UNAVAILABLE", "The verified event could not be saved yet.");
  }
}
