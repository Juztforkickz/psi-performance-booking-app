import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const bookings = sqliteTable(
  "bookings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicReference: text("public_reference").notNull(),
    bookingType: text("booking_type").notNull(),
    serviceOption: text("service_option").notNull(),
    customerName: text("customer_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    vehicleMake: text("vehicle_make").notNull(),
    vehicleModel: text("vehicle_model").notNull(),
    vehicleYear: integer("vehicle_year").notNull(),
    registration: text("registration").notNull().default(""),
    vin: text("vin").notNull().default(""),
    preferredDate: text("preferred_date").notNull(),
    arrivalWindow: text("arrival_window").notNull(),
    notes: text("notes").notNull().default(""),
    tuningDetailsJson: text("tuning_details_json"),
    source: text("source").notNull().default("web"),
    status: text("status").notNull().default("requested"),
    consent: integer("consent", { mode: "boolean" })
      .notNull()
      .default(sql`1`),
    consentedAt: text("consented_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    consentPolicyVersion: text("consent_policy_version")
      .notNull()
      .default("psi-booking-contact-v1"),
    checkoutId: text("checkout_id"),
    depositPaymentId: text("deposit_payment_id"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_bookings_public_reference").on(table.publicReference),
    uniqueIndex("idx_bookings_checkout_id").on(table.checkoutId),
    uniqueIndex("idx_bookings_deposit_payment_id").on(table.depositPaymentId),
    check(
      "bookings_booking_type_check",
      sql`${table.bookingType} in ('service', 'dyno')`,
    ),
    check(
      "bookings_arrival_window_check",
      sql`${table.arrivalWindow} in ('morning', 'afternoon', 'any')`,
    ),
    check(
      "bookings_source_check",
      sql`${table.source} in ('web', 'mobile')`,
    ),
    check(
      "bookings_status_check",
      sql`${table.status} in ('requested', 'confirmed', 'completed', 'cancelled')`,
    ),
    check(
      "bookings_tuning_details_json_check",
      sql`${table.tuningDetailsJson} is null or json_valid(${table.tuningDetailsJson})`,
    ),
    check("bookings_consent_check", sql`${table.consent} = 1`),
  ],
);

export const bookingCheckouts = sqliteTable(
  "booking_checkouts",
  {
    id: text("id").primaryKey(),
    publicReference: text("public_reference").notNull(),
    accountId: text("account_id"),
    bookingType: text("booking_type").notNull(),
    serviceOption: text("service_option").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    mobile: text("mobile").notNull(),
    vehicleMake: text("vehicle_make").notNull(),
    vehicleModel: text("vehicle_model").notNull(),
    vehicleYear: integer("vehicle_year").notNull(),
    registration: text("registration").notNull(),
    vin: text("vin").notNull().default(""),
    preferredDate: text("preferred_date").notNull(),
    arrivalWindow: text("arrival_window").notNull().default("any"),
    requestDetails: text("request_details").notNull(),
    tuningDetailsJson: text("tuning_details_json"),
    source: text("source").notNull().default("web"),
    state: text("state").notNull().default("awaiting_payment"),
    depositAmountCents: integer("deposit_amount_cents").notNull().default(10_000),
    currency: text("currency").notNull().default("AUD"),
    paymentProvider: text("payment_provider"),
    providerCheckoutUrl: text("provider_checkout_url"),
    contactConsent: integer("contact_consent", { mode: "boolean" })
      .notNull()
      .default(sql`1`),
    consentPolicyVersion: text("consent_policy_version")
      .notNull()
      .default("psi-booking-contact-v1"),
    depositTermsAccepted: integer("deposit_terms_accepted", { mode: "boolean" })
      .notNull()
      .default(sql`1`),
    depositPolicyVersion: text("deposit_policy_version")
      .notNull()
      .default("psi-deposit-v2"),
    depositTermsAcceptedAt: text("deposit_terms_accepted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_booking_checkouts_public_reference").on(table.publicReference),
    index("idx_booking_checkouts_account_created").on(table.accountId, table.createdAt),
    index("idx_booking_checkouts_state_expires").on(table.state, table.expiresAt),
    check(
      "booking_checkouts_booking_type_check",
      sql`${table.bookingType} in ('service', 'dyno')`,
    ),
    check(
      "booking_checkouts_arrival_window_check",
      sql`${table.arrivalWindow} in ('morning', 'afternoon', 'any')`,
    ),
    check(
      "booking_checkouts_source_check",
      sql`${table.source} in ('web', 'mobile')`,
    ),
    check(
      "booking_checkouts_state_check",
      sql`${table.state} in ('awaiting_payment', 'processing', 'paid', 'expired', 'cancelled')`,
    ),
    check(
      "booking_checkouts_tuning_details_json_check",
      sql`${table.tuningDetailsJson} is null or json_valid(${table.tuningDetailsJson})`,
    ),
    check(
      "booking_checkouts_deposit_amount_check",
      sql`${table.depositAmountCents} >= 10000`,
    ),
    check("booking_checkouts_currency_check", sql`${table.currency} = 'AUD'`),
    check(
      "booking_checkouts_provider_url_check",
      sql`${table.providerCheckoutUrl} is null or ${table.providerCheckoutUrl} like 'https://%'`,
    ),
    check("booking_checkouts_contact_consent_check", sql`${table.contactConsent} = 1`),
    check(
      "booking_checkouts_deposit_terms_check",
      sql`${table.depositTermsAccepted} = 1`,
    ),
  ],
);

export const bookingCheckoutIdempotencyKeys = sqliteTable(
  "booking_checkout_idempotency_keys",
  {
    keyHash: text("key_hash").primaryKey(),
    requestHash: text("request_hash").notNull(),
    checkoutId: text("checkout_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_booking_checkout_idempotency_checkout_id").on(table.checkoutId),
    check(
      "booking_checkout_idempotency_key_hash_check",
      sql`length(${table.keyHash}) = 64`,
    ),
    check(
      "booking_checkout_idempotency_request_hash_check",
      sql`length(${table.requestHash}) = 64`,
    ),
  ],
);

export const depositPayments = sqliteTable(
  "deposit_payments",
  {
    id: text("id").primaryKey(),
    checkoutId: text("checkout_id").notNull(),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    expectedAmountCents: integer("expected_amount_cents").notNull(),
    receivedAmountCents: integer("received_amount_cents").notNull().default(0),
    refundedAmountCents: integer("refunded_amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("AUD"),
    status: text("status").notNull().default("requires_payment_method"),
    providerReceiptUrl: text("provider_receipt_url"),
    paidAt: text("paid_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_deposit_payments_provider_payment").on(
      table.provider,
      table.providerPaymentId,
    ),
    index("idx_deposit_payments_checkout_status").on(table.checkoutId, table.status),
    uniqueIndex("idx_deposit_payments_one_successful_checkout")
      .on(table.checkoutId)
      .where(
        sql`${table.status} in ('succeeded', 'partially_refunded', 'refunded')`,
      ),
    check(
      "deposit_payments_expected_amount_check",
      sql`${table.expectedAmountCents} >= 10000`,
    ),
    check(
      "deposit_payments_received_amount_check",
      sql`${table.receivedAmountCents} >= 0`,
    ),
    check(
      "deposit_payments_refunded_amount_check",
      sql`${table.refundedAmountCents} >= 0 and ${table.refundedAmountCents} <= ${table.receivedAmountCents}`,
    ),
    check("deposit_payments_currency_check", sql`${table.currency} = 'AUD'`),
    check(
      "deposit_payments_status_check",
      sql`${table.status} in ('requires_payment_method', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded')`,
    ),
  ],
);

export const depositReceipts = sqliteTable(
  "deposit_receipts",
  {
    id: text("id").primaryKey(),
    receiptNumber: text("receipt_number").notNull(),
    paymentId: text("payment_id").notNull(),
    documentType: text("document_type").notNull().default("payment_receipt"),
    supplierName: text("supplier_name").notNull(),
    supplierAbn: text("supplier_abn"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    gstAmountCents: integer("gst_amount_cents"),
    currency: text("currency").notNull().default("AUD"),
    providerReceiptUrl: text("provider_receipt_url"),
    issuedAt: text("issued_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_deposit_receipts_receipt_number").on(table.receiptNumber),
    uniqueIndex("idx_deposit_receipts_payment_id").on(table.paymentId),
    check(
      "deposit_receipts_document_type_check",
      sql`${table.documentType} in ('payment_receipt', 'tax_invoice')`,
    ),
    check("deposit_receipts_amount_check", sql`${table.amountCents} >= 10000`),
    check(
      "deposit_receipts_gst_amount_check",
      sql`${table.gstAmountCents} is null or (${table.gstAmountCents} >= 0 and ${table.gstAmountCents} <= ${table.amountCents})`,
    ),
    check(
      "deposit_receipts_tax_invoice_identity_check",
      sql`${table.documentType} = 'payment_receipt' or (${table.supplierAbn} is not null and length(trim(${table.supplierAbn})) > 0 and ${table.gstAmountCents} is not null)`,
    ),
    check("deposit_receipts_currency_check", sql`${table.currency} = 'AUD'`),
  ],
);

export const paymentWebhookEvents = sqliteTable(
  "payment_webhook_events",
  {
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    state: text("state").notNull().default("received"),
    lastErrorCode: text("last_error_code"),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    processedAt: text("processed_at"),
  },
  (table) => [
    primaryKey({
      columns: [table.provider, table.eventId],
      name: "payment_webhook_events_provider_event_pk",
    }),
    index("idx_payment_webhook_events_state_received").on(
      table.state,
      table.receivedAt,
    ),
    check(
      "payment_webhook_events_payload_hash_check",
      sql`length(${table.payloadHash}) = 64`,
    ),
    check(
      "payment_webhook_events_state_check",
      sql`${table.state} in ('received', 'processed', 'failed')`,
    ),
  ],
);

export const integrationOutbox = sqliteTable(
  "integration_outbox",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    state: text("state").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: text("next_attempt_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    providerResultId: text("provider_result_id"),
    lastErrorCode: text("last_error_code"),
    payloadJson: text("payload_json"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    sentAt: text("sent_at"),
  },
  (table) => [
    uniqueIndex("idx_integration_outbox_dedupe_key").on(table.dedupeKey),
    index("idx_integration_outbox_state_next_attempt").on(
      table.state,
      table.nextAttemptAt,
    ),
    check(
      "integration_outbox_state_check",
      sql`${table.state} in ('pending', 'processing', 'sent', 'failed', 'dead_letter')`,
    ),
    check(
      "integration_outbox_attempt_count_check",
      sql`${table.attemptCount} >= 0`,
    ),
    check(
      "integration_outbox_payload_json_check",
      sql`${table.payloadJson} is null or json_valid(${table.payloadJson})`,
    ),
  ],
);

export const bookingCalendarEvents = sqliteTable(
  "booking_calendar_events",
  {
    id: text("id").primaryKey(),
    checkoutId: text("checkout_id").notNull(),
    bookingReference: text("booking_reference").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    state: text("state").notNull().default("pending"),
    etag: text("etag"),
    lastErrorCode: text("last_error_code"),
    lastSyncedAt: text("last_synced_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_booking_calendar_events_checkout_id").on(table.checkoutId),
    uniqueIndex("idx_booking_calendar_events_booking_reference").on(
      table.bookingReference,
    ),
    uniqueIndex("idx_booking_calendar_events_provider_event_id").on(
      table.providerEventId,
    ),
    check(
      "booking_calendar_events_state_check",
      sql`${table.state} in ('pending', 'confirmed', 'cancelled', 'sync_failed')`,
    ),
  ],
);

export const bookingIdempotencyKeys = sqliteTable(
  "booking_idempotency_keys",
  {
    keyHash: text("key_hash").primaryKey(),
    requestHash: text("request_hash").notNull(),
    publicReference: text("public_reference").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_booking_idempotency_public_reference").on(
      table.publicReference,
    ),
    check(
      "booking_idempotency_key_hash_check",
      sql`length(${table.keyHash}) = 64`,
    ),
    check(
      "booking_idempotency_request_hash_check",
      sql`length(${table.requestHash}) = 64`,
    ),
  ],
);

export const bookingRateLimits = sqliteTable(
  "booking_rate_limits",
  {
    ipHash: text("ip_hash").notNull(),
    windowStart: integer("window_start").notNull(),
    requestCount: integer("request_count").notNull().default(1),
  },
  (table) => [
    primaryKey({
      columns: [table.ipHash, table.windowStart],
      name: "booking_rate_limits_ip_window_pk",
    }),
    index("idx_booking_rate_limits_window_start").on(table.windowStart),
    check(
      "booking_rate_limits_ip_hash_check",
      sql`length(${table.ipHash}) = 64`,
    ),
    check(
      "booking_rate_limits_request_count_check",
      sql`${table.requestCount} >= 1`,
    ),
  ],
);

/**
 * Approval-first booking model. The earlier checkout tables are retained for
 * migration compatibility; new requests use these tables and cannot become
 * payable until PSI records an approved date.
 */
export const customerProfiles = sqliteTable(
  "customer_profiles",
  {
    id: text("id").primaryKey(),
    accountUserId: text("account_user_id"),
    accountState: text("account_state").notNull().default("unclaimed"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    mobile: text("mobile").notNull(),
    contactConsent: integer("contact_consent", { mode: "boolean" })
      .notNull()
      .default(sql`1`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_customer_profiles_email").on(table.email),
    uniqueIndex("idx_customer_profiles_account_user_id").on(table.accountUserId),
    index("idx_customer_profiles_mobile").on(table.mobile),
    check(
      "customer_profiles_account_state_check",
      sql`${table.accountState} in ('unclaimed', 'active', 'disabled')`,
    ),
    check(
      "customer_profiles_contact_consent_check",
      sql`${table.contactConsent} in (0, 1)`,
    ),
  ],
);

export const customerVehicles = sqliteTable(
  "customer_vehicles",
  {
    id: text("id").primaryKey(),
    customerProfileId: text("customer_profile_id").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year").notNull(),
    registration: text("registration").notNull(),
    vin: text("vin").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_customer_vehicles_profile_registration").on(
      table.customerProfileId,
      table.registration,
    ),
    index("idx_customer_vehicles_profile_updated").on(
      table.customerProfileId,
      table.updatedAt,
    ),
    check(
      "customer_vehicles_year_check",
      sql`${table.year} between 1900 and 2200`,
    ),
  ],
);

export const bookingRequests = sqliteTable(
  "booking_requests",
  {
    id: text("id").primaryKey(),
    publicReference: text("public_reference").notNull(),
    customerProfileId: text("customer_profile_id"),
    vehicleId: text("vehicle_id"),
    firstNameSnapshot: text("first_name_snapshot").notNull(),
    lastNameSnapshot: text("last_name_snapshot").notNull(),
    emailSnapshot: text("email_snapshot").notNull(),
    mobileSnapshot: text("mobile_snapshot").notNull(),
    vehicleMakeSnapshot: text("vehicle_make_snapshot").notNull(),
    vehicleModelSnapshot: text("vehicle_model_snapshot").notNull(),
    vehicleYearSnapshot: integer("vehicle_year_snapshot").notNull(),
    registrationSnapshot: text("registration_snapshot").notNull(),
    vinSnapshot: text("vin_snapshot").notNull().default(""),
    bookingType: text("booking_type").notNull(),
    serviceOption: text("service_option").notNull(),
    appointmentPreferenceMode: text("appointment_preference_mode").notNull(),
    preferredDate: text("preferred_date"),
    arrivalArrangement: text("arrival_arrangement").notNull(),
    afterHoursCollection: integer("after_hours_collection", { mode: "boolean" })
      .notNull()
      .default(sql`0`),
    notifyEarlierAvailability: integer("notify_earlier_availability", {
      mode: "boolean",
    })
      .notNull()
      .default(sql`0`),
    serviceReminderConsent: integer("service_reminder_consent", {
      mode: "boolean",
    })
      .notNull()
      .default(sql`0`),
    requestDetails: text("request_details").notNull(),
    setupConfidence: text("setup_confidence"),
    tuningDetailsJson: text("tuning_details_json"),
    source: text("source").notNull(),
    contactConsent: integer("contact_consent", { mode: "boolean" }).notNull(),
    bookingTermsAccepted: integer("booking_terms_accepted", { mode: "boolean" })
      .notNull(),
    bookingPolicyVersion: text("booking_policy_version").notNull(),
    depositPolicyVersion: text("deposit_policy_version").notNull(),
    depositAmountCents: integer("deposit_amount_cents").notNull(),
    currency: text("currency").notNull().default("AUD"),
    state: text("state").notNull().default("pending_staff_review"),
    stateVersion: integer("state_version").notNull().default(0),
    proposedDate: text("proposed_date"),
    confirmedDate: text("confirmed_date"),
    confirmedArrivalArrangement: text("confirmed_arrival_arrangement"),
    confirmedAllocationMode: text("confirmed_allocation_mode"),
    confirmedStartTime: text("confirmed_start_time"),
    confirmedEndTime: text("confirmed_end_time"),
    staffNotes: text("staff_notes").notNull().default(""),
    checkoutId: text("checkout_id"),
    depositPaymentId: text("deposit_payment_id"),
    completedAt: text("completed_at"),
    cancelledAt: text("cancelled_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_booking_requests_public_reference").on(table.publicReference),
    uniqueIndex("idx_booking_requests_checkout_id").on(table.checkoutId),
    uniqueIndex("idx_booking_requests_deposit_payment_id").on(table.depositPaymentId),
    index("idx_booking_requests_state_created").on(table.state, table.createdAt),
    index("idx_booking_requests_customer_created").on(
      table.customerProfileId,
      table.createdAt,
    ),
    index("idx_booking_requests_vehicle_created").on(table.vehicleId, table.createdAt),
    index("idx_booking_requests_confirmed_date").on(table.confirmedDate),
    index("idx_booking_requests_earlier_candidate").on(
      table.notifyEarlierAvailability,
      table.state,
      table.preferredDate,
    ),
    check(
      "booking_requests_booking_type_check",
      sql`${table.bookingType} in ('service', 'dyno')`,
    ),
    check(
      "booking_requests_service_option_check",
      sql`(${table.bookingType} = 'service' and ${table.serviceOption} = 'service_report') or (${table.bookingType} = 'dyno' and ${table.serviceOption} = 'dyno_tuning')`,
    ),
    check(
      "booking_requests_preference_check",
      sql`(${table.appointmentPreferenceMode} = 'specific' and ${table.preferredDate} is not null) or (${table.appointmentPreferenceMode} = 'flexible' and ${table.preferredDate} is null)`,
    ),
    check(
      "booking_requests_arrival_arrangement_check",
      sql`${table.arrivalArrangement} in ('business_hours', 'before_hours_drop_off', 'after_hours_drop_off', 'flexible')`,
    ),
    check(
      "booking_requests_confirmed_arrangement_check",
      sql`${table.confirmedArrivalArrangement} is null or ${table.confirmedArrivalArrangement} in ('business_hours', 'before_hours_drop_off', 'after_hours_drop_off', 'flexible')`,
    ),
    check(
      "booking_requests_confirmed_allocation_check",
      sql`(${table.confirmedAllocationMode} is null and ${table.confirmedStartTime} is null and ${table.confirmedEndTime} is null) or (${table.confirmedAllocationMode} = 'all_day' and ${table.confirmedStartTime} is null and ${table.confirmedEndTime} is null) or (${table.confirmedAllocationMode} = 'timed' and ${table.confirmedStartTime} glob '[0-2][0-9]:[0-5][0-9]' and substr(${table.confirmedStartTime}, 1, 2) between '00' and '23' and ${table.confirmedEndTime} glob '[0-2][0-9]:[0-5][0-9]' and substr(${table.confirmedEndTime}, 1, 2) between '00' and '23' and ${table.confirmedStartTime} < ${table.confirmedEndTime})`,
    ),
    check(
      "booking_requests_setup_confidence_check",
      sql`(${table.bookingType} = 'service' and ${table.setupConfidence} is null and ${table.tuningDetailsJson} is null) or (${table.bookingType} = 'dyno' and ${table.setupConfidence} in ('known', 'psi_inspection'))`,
    ),
    check(
      "booking_requests_tuning_details_json_check",
      sql`${table.tuningDetailsJson} is null or json_valid(${table.tuningDetailsJson})`,
    ),
    check(
      "booking_requests_source_check",
      sql`${table.source} in ('web', 'mobile')`,
    ),
    check(
      "booking_requests_boolean_flags_check",
      sql`${table.afterHoursCollection} in (0, 1) and ${table.notifyEarlierAvailability} in (0, 1) and ${table.serviceReminderConsent} in (0, 1)`,
    ),
    check("booking_requests_contact_consent_check", sql`${table.contactConsent} = 1`),
    check(
      "booking_requests_booking_terms_check",
      sql`${table.bookingTermsAccepted} = 1`,
    ),
    check(
      "booking_requests_deposit_amount_check",
      sql`(${table.bookingType} = 'service' and ${table.depositAmountCents} = 10000) or (${table.bookingType} = 'dyno' and ${table.depositAmountCents} = 30000)`,
    ),
    check("booking_requests_currency_check", sql`${table.currency} = 'AUD'`),
    check(
      "booking_requests_state_check",
      sql`${table.state} in ('pending_staff_review', 'date_proposed', 'date_approved', 'awaiting_deposit', 'confirmed', 'completed', 'cancelled')`,
    ),
    check("booking_requests_state_version_check", sql`${table.stateVersion} >= 0`),
  ],
);

export const bookingRequestIdempotencyKeys = sqliteTable(
  "booking_request_idempotency_keys",
  {
    keyHash: text("key_hash").primaryKey(),
    requestHash: text("request_hash").notNull(),
    bookingRequestId: text("booking_request_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_booking_request_idempotency_request_id").on(
      table.bookingRequestId,
    ),
    check("booking_request_idempotency_key_hash_check", sql`length(${table.keyHash}) = 64`),
    check(
      "booking_request_idempotency_request_hash_check",
      sql`length(${table.requestHash}) = 64`,
    ),
  ],
);

export const bookingRequestTransitions = sqliteTable(
  "booking_request_transitions",
  {
    id: text("id").primaryKey(),
    bookingRequestId: text("booking_request_id").notNull(),
    fromState: text("from_state"),
    toState: text("to_state").notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_booking_request_transitions_request_created").on(
      table.bookingRequestId,
      table.createdAt,
    ),
    check(
      "booking_request_transitions_actor_check",
      sql`${table.actor} in ('customer', 'staff', 'payment_webhook', 'system')`,
    ),
  ],
);

export const bookingRequestActionClaims = sqliteTable(
  "booking_request_action_claims",
  {
    bookingRequestId: text("booking_request_id").notNull(),
    expectedVersion: integer("expected_version").notNull(),
    actionKeyHash: text("action_key_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.bookingRequestId, table.expectedVersion] }),
    uniqueIndex("idx_booking_request_action_claims_key").on(table.actionKeyHash),
    check(
      "booking_request_action_claims_version_check",
      sql`${table.expectedVersion} >= 0`,
    ),
    check(
      "booking_request_action_claims_key_hash_check",
      sql`length(${table.actionKeyHash}) = 64`,
    ),
  ],
);

export const adminActionIdempotencyKeys = sqliteTable(
  "admin_action_idempotency_keys",
  {
    keyHash: text("key_hash").primaryKey(),
    requestHash: text("request_hash").notNull(),
    bookingRequestId: text("booking_request_id").notNull(),
    responseJson: text("response_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_admin_action_idempotency_request").on(table.bookingRequestId),
    check("admin_action_idempotency_key_hash_check", sql`length(${table.keyHash}) = 64`),
    check(
      "admin_action_idempotency_request_hash_check",
      sql`length(${table.requestHash}) = 64`,
    ),
    check(
      "admin_action_idempotency_response_json_check",
      sql`json_valid(${table.responseJson})`,
    ),
  ],
);

export const bookingRequestCheckouts = sqliteTable(
  "booking_request_checkouts",
  {
    id: text("id").primaryKey(),
    bookingRequestId: text("booking_request_id").notNull(),
    state: text("state").notNull().default("provider_pending"),
    depositAmountCents: integer("deposit_amount_cents").notNull(),
    currency: text("currency").notNull().default("AUD"),
    paymentProvider: text("payment_provider"),
    providerCheckoutId: text("provider_checkout_id"),
    providerCheckoutUrl: text("provider_checkout_url"),
    calendarIdSnapshot: text("calendar_id_snapshot"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_booking_request_checkouts_request_id").on(
      table.bookingRequestId,
    ),
    uniqueIndex("idx_booking_request_checkouts_provider_checkout").on(
      table.paymentProvider,
      table.providerCheckoutId,
    ),
    check(
      "booking_request_checkouts_state_check",
      sql`${table.state} in ('provider_pending', 'awaiting_payment', 'processing', 'cancellation_pending', 'paid', 'expired', 'cancelled')`,
    ),
    check(
      "booking_request_checkouts_amount_check",
      sql`${table.depositAmountCents} in (10000, 30000)`,
    ),
    check("booking_request_checkouts_currency_check", sql`${table.currency} = 'AUD'`),
    check(
      "booking_request_checkouts_url_check",
      sql`${table.providerCheckoutUrl} is null or ${table.providerCheckoutUrl} like 'https://%'`,
    ),
  ],
);

export const bookingRequestPayments = sqliteTable(
  "booking_request_payments",
  {
    id: text("id").primaryKey(),
    bookingRequestId: text("booking_request_id").notNull(),
    checkoutId: text("checkout_id").notNull(),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("AUD"),
    status: text("status").notNull().default("verified"),
    providerReceiptUrl: text("provider_receipt_url"),
    verifiedAt: text("verified_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    paidAt: text("paid_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_booking_request_payments_request_id").on(table.bookingRequestId),
    uniqueIndex("idx_booking_request_payments_checkout_id").on(table.checkoutId),
    uniqueIndex("idx_booking_request_payments_provider_payment").on(
      table.provider,
      table.providerPaymentId,
    ),
    check(
      "booking_request_payments_amount_check",
      sql`${table.amountCents} in (10000, 30000)`,
    ),
    check("booking_request_payments_currency_check", sql`${table.currency} = 'AUD'`),
    check("booking_request_payments_status_check", sql`${table.status} = 'verified'`),
  ],
);

export const bookingRequestCalendarEvents = sqliteTable(
  "booking_request_calendar_events",
  {
    id: text("id").primaryKey(),
    bookingRequestId: text("booking_request_id").notNull(),
    state: text("state").notNull().default("queued"),
    calendarId: text("calendar_id").notNull(),
    providerEventId: text("provider_event_id"),
    lastErrorCode: text("last_error_code"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_booking_request_calendar_request_id").on(
      table.bookingRequestId,
    ),
    uniqueIndex("idx_booking_request_calendar_provider_event").on(
      table.calendarId,
      table.providerEventId,
    ),
    check(
      "booking_request_calendar_state_check",
      sql`${table.state} in ('queued', 'created', 'cancelled', 'failed')`,
    ),
  ],
);

export const appointmentReminderJobs = sqliteTable(
  "appointment_reminder_jobs",
  {
    id: text("id").primaryKey(),
    bookingRequestId: text("booking_request_id").notNull(),
    reminderKind: text("reminder_kind").notNull(),
    dueAt: text("due_at").notNull(),
    state: text("state").notNull().default("scheduled"),
    scheduleVersion: integer("schedule_version").notNull().default(1),
    dispatchedAt: text("dispatched_at"),
    cancelledAt: text("cancelled_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_appointment_reminders_request_kind_version").on(
      table.bookingRequestId,
      table.reminderKind,
      table.scheduleVersion,
    ),
    index("idx_appointment_reminders_state_due").on(table.state, table.dueAt),
    check(
      "appointment_reminders_kind_check",
      sql`${table.reminderKind} in ('seven_days', 'twenty_four_hours')`,
    ),
    check(
      "appointment_reminders_state_check",
      sql`${table.state} in ('scheduled', 'processing', 'sent', 'cancelled', 'failed')`,
    ),
    check(
      "appointment_reminders_schedule_version_check",
      sql`${table.scheduleVersion} >= 1`,
    ),
  ],
);

export const serviceReminderJobs = sqliteTable(
  "service_reminder_jobs",
  {
    id: text("id").primaryKey(),
    bookingRequestId: text("booking_request_id").notNull(),
    customerProfileId: text("customer_profile_id"),
    intervalMonths: integer("interval_months").notNull(),
    dueAt: text("due_at").notNull(),
    state: text("state").notNull().default("scheduled"),
    unsubscribeTokenHash: text("unsubscribe_token_hash").notNull(),
    recipientEmailHash: text("recipient_email_hash").notNull(),
    dispatchedAt: text("dispatched_at"),
    unsubscribedAt: text("unsubscribed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_service_reminder_jobs_request_interval").on(
      table.bookingRequestId,
      table.intervalMonths,
    ),
    uniqueIndex("idx_service_reminder_jobs_unsubscribe_hash").on(
      table.unsubscribeTokenHash,
    ),
    index("idx_service_reminder_jobs_state_due").on(table.state, table.dueAt),
    index("idx_service_reminder_jobs_customer_state").on(
      table.customerProfileId,
      table.state,
    ),
    check(
      "service_reminder_jobs_interval_check",
      sql`${table.intervalMonths} in (6, 12)`,
    ),
    check(
      "service_reminder_jobs_state_check",
      sql`${table.state} in ('scheduled', 'processing', 'sent', 'cancelled', 'unsubscribed', 'failed')`,
    ),
    check(
      "service_reminder_jobs_unsubscribe_hash_check",
      sql`length(${table.unsubscribeTokenHash}) = 64`,
    ),
    check(
      "service_reminder_jobs_recipient_email_hash_check",
      sql`length(${table.recipientEmailHash}) = 64`,
    ),
  ],
);

export const serviceReminderSuppressions = sqliteTable(
  "service_reminder_suppressions",
  {
    recipientEmailHash: text("recipient_email_hash").primaryKey(),
    reason: text("reason").notNull().default("customer_unsubscribe"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "service_reminder_suppressions_email_hash_check",
      sql`length(${table.recipientEmailHash}) = 64`,
    ),
    check(
      "service_reminder_suppressions_reason_check",
      sql`${table.reason} in ('customer_unsubscribe', 'staff_suppression')`,
    ),
  ],
);
