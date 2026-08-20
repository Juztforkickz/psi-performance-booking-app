import { env } from "cloudflare:workers";
import { getBookingD1 } from "../../../../../db";
import {
  DEPOSIT_CURRENCY,
  depositAmountForBookingType,
  type CheckoutBookingType,
} from "../../booking-catalog/catalog";
import {
  BOOKING_REQUEST_STATES,
  addMonthsToIsoDate,
  dateEligibilityMessage,
  getMelbourneDateParts,
  isArrivalArrangement,
  isEligibleBookingDate,
  isRealIsoDate,
  type BookingRequestState,
} from "../../booking-requests/contract";
import {
  integrationsReady,
  paymentVerificationReady,
} from "../../integrations/payments/_verify";
import {
  adminError,
  adminJson,
  authorizeAdmin,
  readAdminIdempotencyKey,
  readJsonObject,
  sha256,
} from "../_auth";

const MAX_PATCH_BYTES = 8_192;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type RuntimeEnv = typeof env & {
  PSI_EMAIL_OUTBOX_ENABLED?: string;
  PSI_EMAIL_PROVIDER_NAME?: string;
  PSI_PAYMENT_CHECKOUT_OUTBOX_ENABLED?: string;
  PSI_PAYMENT_PROVIDER_NAME?: string;
  PSI_PAYMENT_WEBHOOK_SECRET?: string;
  PSI_GOOGLE_CALENDAR_ID?: string;
  PSI_PAYMENT_CHECKOUT_ORIGINS?: string;
};

interface RequestRow {
  id: string;
  reference: string;
  bookingType: CheckoutBookingType;
  state: BookingRequestState;
  stateVersion: number;
  customerProfileId: string | null;
  email: string;
  firstName: string;
  serviceReminderConsent: number;
  appointmentPreferenceMode: string;
  preferredDate: string | null;
  arrivalArrangement: string;
  confirmedDate: string | null;
  confirmedArrivalArrangement: string | null;
  confirmedAllocationMode: "all_day" | "timed" | null;
  confirmedStartTime: string | null;
  confirmedEndTime: string | null;
  depositAmountCents: number;
  currency: string;
  checkoutId: string | null;
  checkoutState: string | null;
  checkoutExpiresAt: string | null;
  paymentProvider: string | null;
  providerCheckoutId: string | null;
  calendarSyncId: string | null;
  calendarSyncState: string | null;
  calendarId: string | null;
  providerCalendarEventId: string | null;
}

const ADMIN_REQUEST_COLUMNS = `
  r.id,
  r.public_reference AS reference,
  r.booking_type AS bookingType,
  r.service_option AS serviceOption,
  r.appointment_preference_mode AS appointmentPreferenceMode,
  r.preferred_date AS preferredDate,
  r.arrival_arrangement AS arrivalArrangement,
  r.after_hours_collection AS afterHoursCollection,
  r.notify_earlier_availability AS notifyEarlierAvailability,
  r.service_reminder_consent AS serviceReminderConsent,
  r.request_details AS requestDetails,
  r.setup_confidence AS setupConfidence,
  r.tuning_details_json AS tuningDetailsJson,
  r.source,
  r.state,
  r.state_version AS stateVersion,
  r.proposed_date AS proposedDate,
  r.confirmed_date AS confirmedDate,
  r.confirmed_arrival_arrangement AS confirmedArrivalArrangement,
  r.confirmed_allocation_mode AS confirmedAllocationMode,
  r.confirmed_start_time AS confirmedStartTime,
  r.confirmed_end_time AS confirmedEndTime,
  r.staff_notes AS staffNotes,
  r.deposit_amount_cents AS depositAmountCents,
  r.currency,
  c.state AS checkoutState,
  c.expires_at AS checkoutExpiresAt,
  ce.state AS calendarSyncState,
  ce.calendar_id AS calendarId,
  ce.provider_event_id AS providerCalendarEventId,
  r.completed_at AS completedAt,
  r.created_at AS createdAt,
  r.updated_at AS updatedAt,
  r.customer_profile_id AS customerProfileId,
  r.first_name_snapshot AS firstName,
  r.last_name_snapshot AS lastName,
  r.email_snapshot AS email,
  r.mobile_snapshot AS mobile,
  r.vehicle_id AS vehicleId,
  r.vehicle_make_snapshot AS vehicleMake,
  r.vehicle_model_snapshot AS vehicleModel,
  r.vehicle_year_snapshot AS vehicleYear,
  r.registration_snapshot AS registration,
  r.vin_snapshot AS vin
`;

function isState(value: string): value is BookingRequestState {
  return (BOOKING_REQUEST_STATES as readonly string[]).includes(value);
}

function emailOutboxEnabled() {
  const runtime = env as RuntimeEnv;
  return (
    runtime.PSI_EMAIL_OUTBOX_ENABLED === "true" &&
    Boolean(runtime.PSI_EMAIL_PROVIDER_NAME?.trim())
  );
}

function paymentOutboxEnabled() {
  const runtime = env as RuntimeEnv;
  return (
    runtime.PSI_PAYMENT_CHECKOUT_OUTBOX_ENABLED === "true" &&
    integrationsReady()
  );
}

function paymentCancellationOutboxEnabled() {
  const runtime = env as RuntimeEnv;
  return (
    runtime.PSI_PAYMENT_CHECKOUT_OUTBOX_ENABLED === "true" &&
    paymentVerificationReady()
  );
}

function safeNote(value: unknown) {
  if (value === undefined) return "";
  if (typeof value !== "string") return null;
  const note = value.trim();
  const hasUnsafeControlCharacter = Array.from(note).some((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
  });
  if (note.length > 2_000 || hasUnsafeControlCharacter) {
    return null;
  }
  return note;
}

async function findRequest(database: Awaited<ReturnType<typeof getBookingD1>>, reference: string) {
  return database
    .prepare(
      `SELECT
         r.id,
         r.public_reference AS reference,
         r.booking_type AS bookingType,
         r.state,
         r.state_version AS stateVersion,
         r.customer_profile_id AS customerProfileId,
         r.email_snapshot AS email,
         r.first_name_snapshot AS firstName,
         r.service_reminder_consent AS serviceReminderConsent,
         r.appointment_preference_mode AS appointmentPreferenceMode,
         r.preferred_date AS preferredDate,
         r.arrival_arrangement AS arrivalArrangement,
         r.confirmed_date AS confirmedDate,
         r.confirmed_arrival_arrangement AS confirmedArrivalArrangement,
         r.confirmed_allocation_mode AS confirmedAllocationMode,
         r.confirmed_start_time AS confirmedStartTime,
         r.confirmed_end_time AS confirmedEndTime,
         r.deposit_amount_cents AS depositAmountCents,
         r.currency
         ,r.checkout_id AS checkoutId
         ,c.state AS checkoutState
         ,c.expires_at AS checkoutExpiresAt
         ,c.payment_provider AS paymentProvider
         ,c.provider_checkout_id AS providerCheckoutId
         ,ce.id AS calendarSyncId
         ,ce.state AS calendarSyncState
         ,ce.calendar_id AS calendarId
         ,ce.provider_event_id AS providerCalendarEventId
       FROM booking_requests r
       LEFT JOIN booking_request_checkouts c ON c.id = r.checkout_id
       LEFT JOIN booking_request_calendar_events ce ON ce.booking_request_id = r.id
       WHERE r.public_reference = ?`,
    )
    .bind(reference)
    .first<RequestRow>();
}

function claimAction(
  database: Awaited<ReturnType<typeof getBookingD1>>,
  current: RequestRow,
  actionKeyHash: string,
) {
  return database
    .prepare(
      `INSERT INTO booking_request_action_claims (
         booking_request_id, expected_version, action_key_hash
       ) VALUES (?, ?, ?)`,
    )
    .bind(current.id, current.stateVersion, actionKeyHash);
}

export async function GET(request: Request) {
  const authError = await authorizeAdmin(request);
  if (authError) return authError;
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  const state = url.searchParams.get("state");
  const earlierOnly = url.searchParams.get("earlierOnly") === "true";
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return adminError(400, "INVALID_QUERY", `limit must be from 1 to ${MAX_LIMIT}.`);
  }
  if (state !== null && !isState(state)) {
    return adminError(400, "INVALID_QUERY", "state is not a valid booking request state.");
  }

  try {
    const database = await getBookingD1();
    const predicates: string[] = [];
    const values: Array<string | number> = [];
    if (state) {
      predicates.push("r.state = ?");
      values.push(state);
    }
    if (earlierOnly) {
      predicates.push("r.notify_earlier_availability = 1");
      predicates.push("r.state IN ('pending_staff_review', 'date_proposed', 'date_approved', 'awaiting_deposit', 'confirmed')");
    }
    const where = predicates.length ? `WHERE ${predicates.join(" AND ")}` : "";
    const result = await database
      .prepare(
        `SELECT ${ADMIN_REQUEST_COLUMNS}
         FROM booking_requests r
         LEFT JOIN booking_request_checkouts c ON c.id = r.checkout_id
         LEFT JOIN booking_request_calendar_events ce ON ce.booking_request_id = r.id
         ${where}
         ORDER BY r.created_at DESC
         LIMIT ?`,
      )
      .bind(...values, limit)
      .all<Record<string, unknown>>();
    const bookingRequests = result.results.map((row) => ({
      ...row,
      tuningDetails:
        typeof row.tuningDetailsJson === "string" ? JSON.parse(row.tuningDetailsJson) : null,
      tuningDetailsJson: undefined,
      staffOnlyEarlierAvailabilityCandidate: row.notifyEarlierAvailability === 1,
    }));
    return adminJson({ bookingRequests, count: bookingRequests.length });
  } catch {
    console.error("Staff booking request queue read failed.");
    return adminError(503, "ADMIN_STORAGE_UNAVAILABLE", "The staff queue is unavailable.");
  }
}

export async function PATCH(request: Request) {
  const authError = await authorizeAdmin(request);
  if (authError) return authError;
  const idempotencyKey = readAdminIdempotencyKey(request);
  if (!idempotencyKey) {
    return adminError(400, "INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key is required.");
  }
  const parsed = await readJsonObject(request, MAX_PATCH_BYTES);
  if (parsed.error || !parsed.body) return parsed.error;
  const body = parsed.body;
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!/^PSI-[A-F0-9]{32}$/u.test(reference)) {
    return adminError(422, "VALIDATION_FAILED", "Enter a valid PSI booking reference.");
  }
  if (!["propose_date", "approve_date", "issue_deposit", "expire_deposit", "reschedule", "complete", "cancel"].includes(action)) {
    return adminError(422, "VALIDATION_FAILED", "Choose a supported staff action.");
  }
  const staffNote = safeNote(body.staffNote);
  if (staffNote === null) {
    return adminError(422, "VALIDATION_FAILED", "The staff note is invalid or too long.");
  }

  try {
    const database = await getBookingD1();
    const keyHash = await sha256(idempotencyKey);
    const requestHash = await sha256(JSON.stringify(body));
    const replay = await database
      .prepare(
        `SELECT request_hash AS requestHash, response_json AS responseJson
         FROM admin_action_idempotency_keys WHERE key_hash = ?`,
      )
      .bind(keyHash)
      .first<{ requestHash: string; responseJson: string }>();
    if (replay) {
      if (replay.requestHash !== requestHash) {
        return adminError(409, "IDEMPOTENCY_KEY_REUSED", "This key was used for another action.");
      }
      return adminJson(JSON.parse(replay.responseJson), 200, { "Idempotency-Replayed": "true" });
    }

    const current = await findRequest(database, reference);
    if (!current) return adminError(404, "BOOKING_REQUEST_NOT_FOUND", "No request matches that reference.");

    if (action === "expire_deposit") {
      const expiresAt = current.checkoutExpiresAt
        ? Date.parse(current.checkoutExpiresAt)
        : Number.NaN;
      const mayExpire =
        current.state === "awaiting_deposit" &&
        current.checkoutId &&
        ["awaiting_payment", "expired"].includes(current.checkoutState ?? "") &&
        Number.isFinite(expiresAt) &&
        expiresAt <= Date.now();
      if (!mayExpire) {
        return adminError(
          409,
          "CHECKOUT_NOT_EXPIRED",
          "Only a genuinely expired, unpaid deposit checkout can be retired.",
        );
      }
      const responseBody = {
        reference,
        state: "date_approved",
        checkoutState: "expired",
        canReissueDeposit: true,
        message: "The expired payment link is retired. Staff may now issue a fresh deposit link for the same approved date.",
      };
      await database.batch([
        claimAction(database, current, keyHash),
        database
          .prepare(
            `UPDATE booking_request_checkouts
             SET state = 'expired', updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND state IN ('awaiting_payment', 'expired')`,
          )
          .bind(current.checkoutId),
        database
          .prepare(
            `INSERT INTO booking_request_transitions (
               id, booking_request_id, from_state, to_state, action, actor, note
             ) SELECT ?, id, 'awaiting_deposit', 'date_approved', 'checkout_expired', 'staff', ?
               FROM booking_requests
              WHERE id = ? AND state = 'awaiting_deposit'
                AND EXISTS (
                  SELECT 1 FROM booking_request_checkouts
                   WHERE id = ? AND state = 'expired'
                )`,
          )
          .bind(
            `transition_${crypto.randomUUID()}`,
            staffNote,
            current.id,
            current.checkoutId,
          ),
        database
          .prepare(
            `UPDATE booking_requests
                SET state = 'date_approved', state_version = state_version + 1,
                    updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND state = 'awaiting_deposit' AND state_version = ?
                AND EXISTS (
                  SELECT 1 FROM booking_request_checkouts
                   WHERE id = ? AND state = 'expired'
                )`,
          )
          .bind(current.id, current.stateVersion, current.checkoutId),
        database
          .prepare(
            `INSERT INTO admin_action_idempotency_keys (
               key_hash, request_hash, booking_request_id, response_json
             ) VALUES (?, ?, ?, ?)`,
          )
          .bind(keyHash, requestHash, current.id, JSON.stringify(responseBody)),
      ]);
      return adminJson(responseBody);
    }

    if (action === "propose_date" || action === "approve_date" || action === "reschedule") {
      const appointmentDate = typeof body.appointmentDate === "string" ? body.appointmentDate.trim() : "";
      const arrangement = body.arrivalArrangement;
      const allocationMode = body.allocationMode;
      const startTime = typeof body.startTime === "string" ? body.startTime.trim() : null;
      const endTime = typeof body.endTime === "string" ? body.endTime.trim() : null;
      if (!isRealIsoDate(appointmentDate) || appointmentDate < getMelbourneDateParts().isoDate) {
        return adminError(422, "VALIDATION_FAILED", "Choose a valid future appointment date.");
      }
      if (!isEligibleBookingDate(current.bookingType, appointmentDate)) {
        return adminError(422, "DATE_NOT_ELIGIBLE", dateEligibilityMessage(current.bookingType));
      }
      if (!isArrivalArrangement(arrangement)) {
        return adminError(422, "VALIDATION_FAILED", "Choose a valid confirmed arrival arrangement.");
      }
      if (allocationMode !== "all_day" && allocationMode !== "timed") {
        return adminError(422, "VALIDATION_FAILED", "Choose an all-day or timed workshop allocation.");
      }
      if (
        (allocationMode === "all_day" && (startTime !== null || endTime !== null)) ||
        (allocationMode === "timed" &&
          (!startTime ||
            !endTime ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(startTime) ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(endTime) ||
            startTime >= endTime))
      ) {
        return adminError(
          422,
          "VALIDATION_FAILED",
          "All-day allocations have no times; timed allocations require a valid start before end.",
        );
      }
      const allowed =
        action === "reschedule"
          ? current.state === "confirmed"
          : ["pending_staff_review", "date_proposed", "date_approved"].includes(current.state);
      if (!allowed) {
        return adminError(409, "INVALID_STATE_TRANSITION", `Cannot ${action} from ${current.state}.`);
      }
      if (
        action === "reschedule" &&
        (!current.calendarSyncId ||
          !current.calendarId ||
          current.calendarId.toLowerCase() === "primary" ||
          !["queued", "created", "failed"].includes(current.calendarSyncState ?? ""))
      ) {
        return adminError(
          409,
          "CALENDAR_RECONCILIATION_REQUIRED",
          "The internal Calendar record must be reconciled before this confirmed booking can be rescheduled.",
        );
      }
      if (
        action !== "reschedule" &&
        current.checkoutId &&
        ["provider_pending", "awaiting_payment", "processing", "paid"].includes(
          current.checkoutState ?? "",
        )
      ) {
        return adminError(
          409,
          "CHECKOUT_ALREADY_ISSUED",
          "Cancel or resolve the existing deposit checkout before changing the approved date.",
        );
      }
      const nextState: BookingRequestState =
        action === "propose_date"
          ? "date_proposed"
          : action === "reschedule"
            ? "confirmed"
            : "date_approved";
      const responseBody = {
        reference,
        state: nextState,
        appointmentDate,
        arrivalArrangement: arrangement,
        allocationMode,
        startTime,
        endTime,
        paymentLinkCreated: false,
        message:
          action === "approve_date"
            ? "The date is approved. Issue the deposit only after the payment integration is configured."
            : action === "propose_date"
              ? "The proposed date is saved for staff follow-up."
              : "The confirmed booking date has been rescheduled.",
      };
      const allocationFingerprint = [
        appointmentDate,
        arrangement,
        allocationMode,
        startTime ?? "-",
        endTime ?? "-",
      ].join(":");
      const statements: D1PreparedStatement[] = [];
      if (action === "reschedule") {
        const versionRow = await database
          .prepare(
            `SELECT COALESCE(MAX(schedule_version), 0) AS version
             FROM appointment_reminder_jobs WHERE booking_request_id = ?`,
          )
          .bind(current.id)
          .first<{ version: number }>();
        const scheduleVersion = (versionRow?.version ?? 0) + 1;
        statements.push(
          database
            .prepare(
              `UPDATE appointment_reminder_jobs
               SET state = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
               WHERE booking_request_id = ? AND state IN ('scheduled', 'processing')`,
            )
            .bind(current.id),
        );
        const today = getMelbourneDateParts().isoDate;
        for (const [kind, days] of [
          ["seven_days", -7],
          ["twenty_four_hours", -1],
        ] as const) {
          const date = new Date(`${appointmentDate}T00:00:00Z`);
          date.setUTCDate(date.getUTCDate() + days);
          const dueAt = date.toISOString().slice(0, 10);
          if (dueAt <= today) continue;
          statements.push(
            database
              .prepare(
                `INSERT INTO appointment_reminder_jobs (
                   id, booking_request_id, reminder_kind, due_at, state, schedule_version
                 ) VALUES (?, ?, ?, ?, 'scheduled', ?)`,
              )
              .bind(
                `appointment_reminder_${crypto.randomUUID()}`,
                current.id,
                kind,
                dueAt,
                scheduleVersion,
              ),
          );
        }
        if (current.calendarId && current.calendarSyncId) {
          const end = new Date(`${appointmentDate}T00:00:00Z`);
          end.setUTCDate(end.getUTCDate() + 1);
          statements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO integration_outbox (
                   id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
                 ) VALUES (?, 'calendar.update_internal', 'booking_request', ?, ?, ?)`,
              )
              .bind(
                `outbox_${crypto.randomUUID()}`,
                current.id,
                `calendar:reschedule:${current.id}:${allocationFingerprint}`,
                JSON.stringify({
                  calendarId: current.calendarId,
                  calendarSyncId: current.calendarSyncId,
                  providerEventId: current.providerCalendarEventId,
                  expectedCalendarState: current.calendarSyncState,
                  reference,
                  ...(allocationMode === "all_day"
                    ? {
                        start: { date: appointmentDate },
                        end: { date: end.toISOString().slice(0, 10) },
                      }
                    : {
                        start: {
                          dateTime: `${appointmentDate}T${startTime}:00`,
                          timeZone: "Australia/Melbourne",
                        },
                        end: {
                          dateTime: `${appointmentDate}T${endTime}:00`,
                          timeZone: "Australia/Melbourne",
                        },
                      }),
                  attendees: [],
                  sendUpdates: "none",
                  visibility: "private",
                }),
              ),
          );
        }
      }
      if (emailOutboxEnabled() && action !== "approve_date") {
        statements.push(
          database
            .prepare(
              `INSERT OR IGNORE INTO integration_outbox (
                 id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
               ) VALUES (?, ?, 'booking_request', ?, ?, ?)`,
            )
            .bind(
              `outbox_${crypto.randomUUID()}`,
              action === "propose_date" ? "booking_date_proposed.customer_email" : "booking_date_changed.customer_email",
              current.id,
              `${action}:${current.id}:${allocationFingerprint}`,
              JSON.stringify({
                to: current.email,
                reference,
                appointmentDate,
                arrivalArrangement: arrangement,
                paymentRequiredNow: false,
              }),
            ),
          database
            .prepare(
              `INSERT OR IGNORE INTO integration_outbox (
                 id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
               ) VALUES (?, ?, 'booking_request', ?, ?, ?)`,
            )
            .bind(
              `outbox_${crypto.randomUUID()}`,
              action === "propose_date" ? "booking_date_proposed.staff_email" : "booking_date_changed.staff_email",
              current.id,
              `${action}:staff:${current.id}:${allocationFingerprint}`,
              JSON.stringify({
                to: "info@psiperformance.com.au",
                reference,
                appointmentDate,
                arrivalArrangement: arrangement,
                allocationMode,
                startTime,
                endTime,
              }),
            ),
        );
      }
      await database.batch([
        claimAction(database, current, keyHash),
        database
          .prepare(
            action === "propose_date"
              ? `UPDATE booking_requests SET state = ?, state_version = state_version + 1, proposed_date = ?, confirmed_date = NULL, confirmed_arrival_arrangement = ?, confirmed_allocation_mode = ?, confirmed_start_time = ?, confirmed_end_time = ?, staff_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = ? AND state_version = ?`
              : `UPDATE booking_requests SET state = ?, state_version = state_version + 1, proposed_date = NULL, confirmed_date = ?, confirmed_arrival_arrangement = ?, confirmed_allocation_mode = ?, confirmed_start_time = ?, confirmed_end_time = ?, staff_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = ? AND state_version = ?`,
          )
          .bind(
            nextState,
            appointmentDate,
            arrangement,
            allocationMode,
            startTime,
            endTime,
            staffNote,
            current.id,
            current.state,
            current.stateVersion,
          ),
        database
          .prepare(
            `INSERT INTO booking_request_transitions (
               id, booking_request_id, from_state, to_state, action, actor, note
             ) VALUES (?, ?, ?, ?, ?, 'staff', ?)`,
          )
          .bind(`transition_${crypto.randomUUID()}`, current.id, current.state, nextState, action, staffNote),
        ...statements,
        database
          .prepare(
            `INSERT INTO admin_action_idempotency_keys (
               key_hash, request_hash, booking_request_id, response_json
             ) VALUES (?, ?, ?, ?)`,
          )
          .bind(keyHash, requestHash, current.id, JSON.stringify(responseBody)),
      ]);
      return adminJson(responseBody);
    }

    if (action === "issue_deposit") {
      if (current.checkoutId && ["provider_pending", "awaiting_payment", "processing", "paid"].includes(current.checkoutState ?? "")) {
        const responseBody = {
          reference,
          state: current.state,
          checkoutState: current.checkoutState,
          paymentLinkCreated: current.checkoutState === "awaiting_payment",
          message:
            current.checkoutState === "provider_pending"
              ? "Secure checkout creation is already queued. No duplicate was created."
              : "A deposit checkout already exists. No duplicate was created.",
        };
        await database
          .prepare(
            `INSERT INTO admin_action_idempotency_keys (
               key_hash, request_hash, booking_request_id, response_json
             ) VALUES (?, ?, ?, ?)`,
          )
          .bind(keyHash, requestHash, current.id, JSON.stringify(responseBody))
          .run();
        return adminJson(responseBody, 200, { "Idempotency-Replayed": "true" });
      }
      if (current.state !== "date_approved" || !current.confirmedDate) {
        return adminError(409, "INVALID_STATE_TRANSITION", "Approve a date before issuing a deposit.");
      }
      const canonicalAmountCents = depositAmountForBookingType(current.bookingType);
      if (
        current.depositAmountCents !== canonicalAmountCents ||
        current.currency !== DEPOSIT_CURRENCY
      ) {
        return adminError(
          409,
          "BOOKING_AMOUNT_MISMATCH",
          "The saved booking deposit does not match PSI's current booking type and must be reviewed before checkout.",
        );
      }
      if (!paymentOutboxEnabled()) {
        return adminError(
          503,
          "PAYMENT_PROVIDER_NOT_CONFIGURED",
          "The approved date remains saved, but no deposit checkout or email was created.",
        );
      }
      const checkoutId = `checkout_${crypto.randomUUID()}`;
      const provider = (env as RuntimeEnv).PSI_PAYMENT_PROVIDER_NAME!.trim();
      const calendarIdSnapshot = (env as RuntimeEnv).PSI_GOOGLE_CALENDAR_ID!.trim();
      const replacingInactiveCheckout =
        Boolean(current.checkoutId) &&
        ["expired", "cancelled"].includes(current.checkoutState ?? "");
      const responseBody = {
        reference,
        state: "date_approved",
        checkoutState: "provider_pending",
        paymentLinkCreated: false,
        message: "The secure checkout creation is queued. The deposit email is sent only after a provider URL is verified.",
      };
      await database.batch([
        claimAction(database, current, keyHash),
        database
          .prepare(
            `INSERT INTO booking_request_checkouts (
               id, booking_request_id, state, deposit_amount_cents, currency,
               payment_provider, calendar_id_snapshot
             ) VALUES (?, ?, 'provider_pending', ?, 'AUD', ?, ?)`,
          )
          .bind(
            checkoutId,
            current.id,
            canonicalAmountCents,
            provider,
            calendarIdSnapshot,
          ),
        database
          .prepare("UPDATE booking_requests SET checkout_id = ?, state_version = state_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = 'date_approved' AND state_version = ?")
          .bind(checkoutId, current.id, current.stateVersion),
        database
          .prepare(
            `INSERT INTO integration_outbox (
               id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
             ) VALUES (?, 'payment_checkout.create', 'booking_request', ?, ?, ?)`,
          )
          .bind(
            `outbox_${crypto.randomUUID()}`,
            current.id,
            `payment-checkout:${replacingInactiveCheckout ? "reissue" : "create"}:${current.id}:${checkoutId}`,
            JSON.stringify({
              checkoutId,
              reference,
              amountCents: canonicalAmountCents,
              currency: DEPOSIT_CURRENCY,
              calendarId: calendarIdSnapshot,
              email: current.email,
              confirmedDate: current.confirmedDate,
              allocationMode: current.confirmedAllocationMode,
              startTime: current.confirmedStartTime,
              endTime: current.confirmedEndTime,
              depositEmailAfterVerifiedUrl: true,
            }),
          ),
        database
          .prepare(
            `INSERT INTO booking_request_transitions (
               id, booking_request_id, from_state, to_state, action, actor, note
             ) VALUES (?, ?, 'date_approved', 'date_approved', 'issue_deposit', 'staff', ?)`,
          )
          .bind(`transition_${crypto.randomUUID()}`, current.id, staffNote),
        database
          .prepare(
            `INSERT INTO admin_action_idempotency_keys (
               key_hash, request_hash, booking_request_id, response_json
             ) VALUES (?, ?, ?, ?)`,
          )
          .bind(keyHash, requestHash, current.id, JSON.stringify(responseBody)),
      ]);
      return adminJson(responseBody, 202);
    }

    if (action === "complete") {
      if (current.state !== "confirmed") {
        return adminError(409, "INVALID_STATE_TRANSITION", "Only a confirmed booking can be completed.");
      }
      const completedDate = getMelbourneDateParts().isoDate;
      const recipientEmailHash = await sha256(current.email.trim().toLowerCase());
      const suppression = await database
        .prepare(
          "SELECT 1 AS suppressed FROM service_reminder_suppressions WHERE recipient_email_hash = ?",
        )
        .bind(recipientEmailHash)
        .first<{ suppressed: number }>();
      const responseBody = {
        reference,
        state: "completed",
        remindersScheduled:
          current.bookingType === "service" &&
          current.serviceReminderConsent === 1 &&
          !suppression,
      };
      const reminderStatements: D1PreparedStatement[] = [];
      if (responseBody.remindersScheduled) {
        for (const months of [6, 12] as const) {
          const reminderId = `reminder_${crypto.randomUUID()}`;
          const publicToken = await sha256(`psi-reminder-unsubscribe-v1:${reminderId}`);
          const tokenHash = await sha256(publicToken);
          reminderStatements.push(
            database
              .prepare(
                `INSERT OR IGNORE INTO service_reminder_jobs (
                   id, booking_request_id, customer_profile_id, interval_months,
                   due_at, state, unsubscribe_token_hash, recipient_email_hash
                 ) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?)`,
              )
              .bind(
                reminderId,
                current.id,
                current.customerProfileId,
                months,
                addMonthsToIsoDate(completedDate, months),
                tokenHash,
                recipientEmailHash,
              ),
          );
        }
      }
      await database.batch([
        claimAction(database, current, keyHash),
        database
          .prepare("UPDATE booking_requests SET state = 'completed', state_version = state_version + 1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = 'confirmed' AND state_version = ?")
          .bind(current.id, current.stateVersion),
        database
          .prepare("UPDATE appointment_reminder_jobs SET state = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE booking_request_id = ? AND state IN ('scheduled', 'processing')")
          .bind(current.id),
        ...reminderStatements,
        database
          .prepare("INSERT INTO booking_request_transitions (id, booking_request_id, from_state, to_state, action, actor, note) VALUES (?, ?, 'confirmed', 'completed', 'complete', 'staff', ?)")
          .bind(`transition_${crypto.randomUUID()}`, current.id, staffNote),
        database
          .prepare("INSERT INTO admin_action_idempotency_keys (key_hash, request_hash, booking_request_id, response_json) VALUES (?, ?, ?, ?)")
          .bind(keyHash, requestHash, current.id, JSON.stringify(responseBody)),
      ]);
      return adminJson(responseBody);
    }

    if (
      current.state === "awaiting_deposit" &&
      current.checkoutId &&
      ["awaiting_payment", "processing", "cancellation_pending"].includes(
        current.checkoutState ?? "",
      )
    ) {
      if (current.checkoutState === "cancellation_pending") {
        const responseBody = {
          reference,
          state: "awaiting_deposit",
          checkoutState: "cancellation_pending",
          cancellationPending: true,
          message: "Provider cancellation is already pending; the booking is not represented as cancelled yet.",
        };
        await database
          .prepare(
            "INSERT INTO admin_action_idempotency_keys (key_hash, request_hash, booking_request_id, response_json) VALUES (?, ?, ?, ?)",
          )
          .bind(keyHash, requestHash, current.id, JSON.stringify(responseBody))
          .run();
        return adminJson(responseBody, 200, { "Idempotency-Replayed": "true" });
      }
      if (!paymentCancellationOutboxEnabled() || !current.providerCheckoutId || !current.paymentProvider) {
        return adminError(
          503,
          "PAYMENT_CANCELLATION_UNAVAILABLE",
          "The delivered deposit link must be invalidated by the payment provider before this request can be cancelled.",
        );
      }
      const responseBody = {
        reference,
        state: "awaiting_deposit",
        checkoutState: "cancellation_pending",
        cancellationPending: true,
        message: "Provider cancellation is queued. PSI will not represent the request as cancelled until the signed provider confirmation arrives.",
      };
      await database.batch([
        claimAction(database, current, keyHash),
        database
          .prepare(
            `UPDATE booking_request_checkouts
                SET state = 'cancellation_pending', updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND state IN ('awaiting_payment', 'processing')`,
          )
          .bind(current.checkoutId),
        database
          .prepare(
            `UPDATE booking_requests
                SET state_version = state_version + 1, staff_notes = ?,
                    updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND state = 'awaiting_deposit' AND state_version = ?`,
          )
          .bind(staffNote, current.id, current.stateVersion),
        database
          .prepare(
            `INSERT INTO integration_outbox (
               id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json
             ) VALUES (?, 'payment_checkout.cancel', 'booking_request', ?, ?, ?)`,
          )
          .bind(
            `outbox_${crypto.randomUUID()}`,
            current.id,
            `payment-checkout:cancel:${current.checkoutId}`,
            JSON.stringify({
              checkoutId: current.checkoutId,
              provider: current.paymentProvider,
              providerCheckoutId: current.providerCheckoutId,
              reference,
              doNotCancelIfPaymentCaptured: true,
              reportCapturedPayment: true,
              adapterMustRecheckCheckoutState: true,
            }),
          ),
        database
          .prepare(
            "INSERT INTO booking_request_transitions (id, booking_request_id, from_state, to_state, action, actor, note) VALUES (?, ?, 'awaiting_deposit', 'awaiting_deposit', 'checkout_cancellation_requested', 'staff', ?)",
          )
          .bind(`transition_${crypto.randomUUID()}`, current.id, staffNote),
        database
          .prepare(
            "INSERT INTO admin_action_idempotency_keys (key_hash, request_hash, booking_request_id, response_json) VALUES (?, ?, ?, ?)",
          )
          .bind(keyHash, requestHash, current.id, JSON.stringify(responseBody)),
      ]);
      return adminJson(responseBody, 202);
    }

    if (current.state === "completed" || current.state === "cancelled") {
      return adminError(409, "INVALID_STATE_TRANSITION", `Cannot cancel from ${current.state}.`);
    }
    if (
      current.state === "confirmed" &&
      (!current.calendarSyncId ||
        !current.calendarId ||
        current.calendarId.toLowerCase() === "primary" ||
        !["queued", "created", "failed"].includes(current.calendarSyncState ?? ""))
    ) {
      return adminError(
        409,
        "CALENDAR_RECONCILIATION_REQUIRED",
        "The internal Calendar record must be reconciled before this confirmed booking can be cancelled.",
      );
    }
    const responseBody = { reference, state: "cancelled", remindersSuppressed: true };
    const cancellationOutbox: D1PreparedStatement[] = [];
    if (current.state === "confirmed" && current.calendarId && current.calendarSyncId) {
      cancellationOutbox.push(
        database
          .prepare("INSERT OR IGNORE INTO integration_outbox (id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json) VALUES (?, 'calendar.cancel_internal', 'booking_request', ?, ?, ?)")
          .bind(
            `outbox_${crypto.randomUUID()}`,
            current.id,
            `calendar:cancel:${current.id}`,
            JSON.stringify({
              calendarId: current.calendarId,
              calendarSyncId: current.calendarSyncId,
              providerEventId: current.providerCalendarEventId,
              expectedCalendarState: current.calendarSyncState,
              reference,
              attendees: [],
              sendUpdates: "none",
            }),
          ),
      );
    }
    if (emailOutboxEnabled()) {
      cancellationOutbox.push(
        database
          .prepare("INSERT OR IGNORE INTO integration_outbox (id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json) VALUES (?, 'booking_cancelled.customer_email', 'booking_request', ?, ?, ?)")
          .bind(
            `outbox_${crypto.randomUUID()}`,
            current.id,
            `booking-cancelled:customer:${current.id}`,
            JSON.stringify({
              to: current.email,
              firstName: current.firstName,
              reference,
              message:
                "PSI will contact you about rescheduling or the appropriate deposit remedy. This notice does not represent an automatic refund.",
            }),
          ),
        database
          .prepare("INSERT OR IGNORE INTO integration_outbox (id, kind, aggregate_type, aggregate_id, dedupe_key, payload_json) VALUES (?, 'booking_cancelled.staff_email', 'booking_request', ?, ?, ?)")
          .bind(
            `outbox_${crypto.randomUUID()}`,
            current.id,
            `booking-cancelled:staff:${current.id}`,
            JSON.stringify({
              to: "info@psiperformance.com.au",
              reference,
              depositActionRequired: current.state === "confirmed",
              automaticRefundStarted: false,
            }),
          ),
      );
    }
    await database.batch([
      claimAction(database, current, keyHash),
      database
        .prepare("UPDATE booking_requests SET state = 'cancelled', state_version = state_version + 1, cancelled_at = CURRENT_TIMESTAMP, staff_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state = ? AND state_version = ?")
        .bind(staffNote, current.id, current.state, current.stateVersion),
      database
        .prepare("UPDATE appointment_reminder_jobs SET state = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE booking_request_id = ? AND state IN ('scheduled', 'processing')")
        .bind(current.id),
      database
        .prepare("UPDATE service_reminder_jobs SET state = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE booking_request_id = ? AND state IN ('scheduled', 'processing')")
        .bind(current.id),
      database
        .prepare("UPDATE booking_request_checkouts SET state = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE booking_request_id = ? AND state IN ('provider_pending', 'awaiting_payment', 'processing')")
        .bind(current.id),
      database
        .prepare(
          `UPDATE integration_outbox
              SET state = 'dead_letter', last_error_code = 'BOOKING_CANCELLED',
                  updated_at = CURRENT_TIMESTAMP
            WHERE kind = 'payment_checkout.create' AND aggregate_id = ?
              AND state IN ('pending', 'processing', 'failed')`,
        )
        .bind(current.id),
      ...cancellationOutbox,
      database
        .prepare("INSERT INTO booking_request_transitions (id, booking_request_id, from_state, to_state, action, actor, note) VALUES (?, ?, ?, 'cancelled', 'cancel', 'staff', ?)")
        .bind(`transition_${crypto.randomUUID()}`, current.id, current.state, staffNote),
      database
        .prepare("INSERT INTO admin_action_idempotency_keys (key_hash, request_hash, booking_request_id, response_json) VALUES (?, ?, ?, ?)")
        .bind(keyHash, requestHash, current.id, JSON.stringify(responseBody)),
    ]);
    return adminJson(responseBody);
  } catch {
    console.error("Staff booking request action failed.");
    return adminError(503, "ADMIN_STORAGE_UNAVAILABLE", "The staff action could not be saved.");
  }
}
