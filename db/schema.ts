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
