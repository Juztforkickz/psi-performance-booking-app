import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const CREATE_BOOKINGS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    public_reference TEXT NOT NULL,
    booking_type TEXT NOT NULL CHECK (booking_type IN ('service', 'dyno')),
    service_option TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_make TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_year INTEGER NOT NULL,
    registration TEXT NOT NULL DEFAULT '',
    vin TEXT NOT NULL DEFAULT '',
    preferred_date TEXT NOT NULL,
    arrival_window TEXT NOT NULL CHECK (arrival_window IN ('morning', 'afternoon', 'any')),
    notes TEXT NOT NULL DEFAULT '',
    tuning_details_json TEXT CHECK (tuning_details_json IS NULL OR json_valid(tuning_details_json)),
    source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mobile')),
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled')),
    consent INTEGER NOT NULL DEFAULT 1 CHECK (consent = 1),
    consented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consent_policy_version TEXT NOT NULL DEFAULT 'psi-booking-contact-v1',
    checkout_id TEXT,
    deposit_payment_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_BOOKINGS_REFERENCE_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_public_reference
  ON bookings (public_reference)
`;

const ADD_BOOKINGS_CONSENT_POLICY_VERSION_SQL = `
  ALTER TABLE bookings
  ADD COLUMN consent_policy_version TEXT NOT NULL DEFAULT 'psi-booking-contact-v1'
`;

const ADD_BOOKINGS_CHECKOUT_ID_SQL = `
  ALTER TABLE bookings
  ADD COLUMN checkout_id TEXT
`;

const ADD_BOOKINGS_DEPOSIT_PAYMENT_ID_SQL = `
  ALTER TABLE bookings
  ADD COLUMN deposit_payment_id TEXT
`;

const ADD_BOOKINGS_TUNING_DETAILS_JSON_SQL = `
  ALTER TABLE bookings
  ADD COLUMN tuning_details_json TEXT
    CHECK (tuning_details_json IS NULL OR json_valid(tuning_details_json))
`;

const CREATE_BOOKINGS_CHECKOUT_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_checkout_id
  ON bookings (checkout_id)
`;

const CREATE_BOOKINGS_DEPOSIT_PAYMENT_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_deposit_payment_id
  ON bookings (deposit_payment_id)
`;

const CREATE_BOOKING_IDEMPOTENCY_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS booking_idempotency_keys (
    key_hash TEXT PRIMARY KEY NOT NULL CHECK (length(key_hash) = 64),
    request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
    public_reference TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_BOOKING_IDEMPOTENCY_REFERENCE_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_idempotency_public_reference
  ON booking_idempotency_keys (public_reference)
`;

const CREATE_BOOKING_RATE_LIMITS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS booking_rate_limits (
    ip_hash TEXT NOT NULL CHECK (length(ip_hash) = 64),
    window_start INTEGER NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count >= 1),
    CONSTRAINT booking_rate_limits_ip_window_pk
      PRIMARY KEY (ip_hash, window_start)
  )
`;

const CREATE_BOOKING_RATE_LIMITS_WINDOW_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_booking_rate_limits_window_start
  ON booking_rate_limits (window_start)
`;

const CREATE_BOOKING_CHECKOUTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS booking_checkouts (
    id TEXT PRIMARY KEY NOT NULL,
    public_reference TEXT NOT NULL,
    account_id TEXT,
    booking_type TEXT NOT NULL CHECK (booking_type IN ('service', 'dyno')),
    service_option TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    mobile TEXT NOT NULL,
    vehicle_make TEXT NOT NULL,
    vehicle_model TEXT NOT NULL,
    vehicle_year INTEGER NOT NULL,
    registration TEXT NOT NULL,
    vin TEXT NOT NULL DEFAULT '',
    preferred_date TEXT NOT NULL,
    arrival_window TEXT NOT NULL DEFAULT 'any' CHECK (arrival_window IN ('morning', 'afternoon', 'any')),
    request_details TEXT NOT NULL,
    tuning_details_json TEXT CHECK (tuning_details_json IS NULL OR json_valid(tuning_details_json)),
    source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mobile')),
    state TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (state IN ('awaiting_payment', 'processing', 'paid', 'expired', 'cancelled')),
    deposit_amount_cents INTEGER NOT NULL DEFAULT 10000 CHECK (deposit_amount_cents >= 10000),
    currency TEXT NOT NULL DEFAULT 'AUD' CHECK (currency = 'AUD'),
    payment_provider TEXT,
    provider_checkout_url TEXT CHECK (provider_checkout_url IS NULL OR provider_checkout_url LIKE 'https://%'),
    contact_consent INTEGER NOT NULL DEFAULT 1 CHECK (contact_consent = 1),
    consent_policy_version TEXT NOT NULL DEFAULT 'psi-booking-contact-v1',
    deposit_terms_accepted INTEGER NOT NULL DEFAULT 1 CHECK (deposit_terms_accepted = 1),
    deposit_policy_version TEXT NOT NULL DEFAULT 'psi-deposit-v2',
    deposit_terms_accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_BOOKING_CHECKOUTS_REFERENCE_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_checkouts_public_reference
  ON booking_checkouts (public_reference)
`;

const CREATE_BOOKING_CHECKOUTS_ACCOUNT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_booking_checkouts_account_created
  ON booking_checkouts (account_id, created_at)
`;

const CREATE_BOOKING_CHECKOUTS_STATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_booking_checkouts_state_expires
  ON booking_checkouts (state, expires_at)
`;

const ADD_BOOKING_CHECKOUTS_TUNING_DETAILS_JSON_SQL = `
  ALTER TABLE booking_checkouts
  ADD COLUMN tuning_details_json TEXT
    CHECK (tuning_details_json IS NULL OR json_valid(tuning_details_json))
`;

const CREATE_BOOKING_CHECKOUT_IDEMPOTENCY_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS booking_checkout_idempotency_keys (
    key_hash TEXT PRIMARY KEY NOT NULL CHECK (length(key_hash) = 64),
    request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
    checkout_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_BOOKING_CHECKOUT_IDEMPOTENCY_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_checkout_idempotency_checkout_id
  ON booking_checkout_idempotency_keys (checkout_id)
`;

const CREATE_DEPOSIT_PAYMENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS deposit_payments (
    id TEXT PRIMARY KEY NOT NULL,
    checkout_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_payment_id TEXT NOT NULL,
    expected_amount_cents INTEGER NOT NULL CHECK (expected_amount_cents >= 10000),
    received_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (received_amount_cents >= 0),
    refunded_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0 AND refunded_amount_cents <= received_amount_cents),
    currency TEXT NOT NULL DEFAULT 'AUD' CHECK (currency = 'AUD'),
    status TEXT NOT NULL DEFAULT 'requires_payment_method' CHECK (status IN ('requires_payment_method', 'processing', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded')),
    provider_receipt_url TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_DEPOSIT_PAYMENTS_PROVIDER_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_payments_provider_payment
  ON deposit_payments (provider, provider_payment_id)
`;

const CREATE_DEPOSIT_PAYMENTS_CHECKOUT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_deposit_payments_checkout_status
  ON deposit_payments (checkout_id, status)
`;

const CREATE_DEPOSIT_PAYMENTS_SUCCESS_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_payments_one_successful_checkout
  ON deposit_payments (checkout_id)
  WHERE status IN ('succeeded', 'partially_refunded', 'refunded')
`;

const CREATE_DEPOSIT_RECEIPTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS deposit_receipts (
    id TEXT PRIMARY KEY NOT NULL,
    receipt_number TEXT NOT NULL,
    payment_id TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'payment_receipt' CHECK (document_type IN ('payment_receipt', 'tax_invoice')),
    supplier_name TEXT NOT NULL,
    supplier_abn TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 10000),
    gst_amount_cents INTEGER CHECK (gst_amount_cents IS NULL OR (gst_amount_cents >= 0 AND gst_amount_cents <= amount_cents)),
    currency TEXT NOT NULL DEFAULT 'AUD' CHECK (currency = 'AUD'),
    provider_receipt_url TEXT,
    issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT deposit_receipts_tax_invoice_identity_check
      CHECK (document_type = 'payment_receipt' OR (supplier_abn IS NOT NULL AND length(trim(supplier_abn)) > 0 AND gst_amount_cents IS NOT NULL))
  )
`;

const CREATE_DEPOSIT_RECEIPTS_NUMBER_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_receipts_receipt_number
  ON deposit_receipts (receipt_number)
`;

const CREATE_DEPOSIT_RECEIPTS_PAYMENT_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_receipts_payment_id
  ON deposit_receipts (payment_id)
`;

const CREATE_PAYMENT_WEBHOOK_EVENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS payment_webhook_events (
    provider TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
    state TEXT NOT NULL DEFAULT 'received' CHECK (state IN ('received', 'processed', 'failed')),
    last_error_code TEXT,
    received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TEXT,
    CONSTRAINT payment_webhook_events_provider_event_pk
      PRIMARY KEY (provider, event_id)
  )
`;

const CREATE_PAYMENT_WEBHOOK_EVENTS_STATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_state_received
  ON payment_webhook_events (state, received_at)
`;

const CREATE_INTEGRATION_OUTBOX_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS integration_outbox (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    dedupe_key TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    provider_result_id TEXT,
    last_error_code TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT
  )
`;

const CREATE_INTEGRATION_OUTBOX_DEDUPE_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_outbox_dedupe_key
  ON integration_outbox (dedupe_key)
`;

const CREATE_INTEGRATION_OUTBOX_STATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_integration_outbox_state_next_attempt
  ON integration_outbox (state, next_attempt_at)
`;

const CREATE_BOOKING_CALENDAR_EVENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS booking_calendar_events (
    id TEXT PRIMARY KEY NOT NULL,
    checkout_id TEXT NOT NULL,
    booking_reference TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'confirmed', 'cancelled', 'sync_failed')),
    etag TEXT,
    last_error_code TEXT,
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const CREATE_BOOKING_CALENDAR_EVENTS_CHECKOUT_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_calendar_events_checkout_id
  ON booking_calendar_events (checkout_id)
`;

const CREATE_BOOKING_CALENDAR_EVENTS_REFERENCE_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_calendar_events_booking_reference
  ON booking_calendar_events (booking_reference)
`;

const CREATE_BOOKING_CALENDAR_EVENTS_PROVIDER_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_calendar_events_provider_event_id
  ON booking_calendar_events (provider_event_id)
`;

let bookingSchemaReady: Promise<void> | undefined;

export function getD1() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return env.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

async function addBookingColumnIfMissing(
  database: ReturnType<typeof getD1>,
  existingColumns: ReadonlySet<string>,
  columnName: string,
  statement: string,
) {
  if (existingColumns.has(columnName)) return;

  try {
    await database.prepare(statement).run();
  } catch (error) {
    // Another isolate may have performed the same additive upgrade first.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("duplicate column name")) throw error;
  }
}

async function initializeBookingSchema(database: ReturnType<typeof getD1>) {
  await database.prepare(CREATE_BOOKINGS_TABLE_SQL).run();

  const bookingColumns = await database
    .prepare("PRAGMA table_info(bookings)")
    .all<{ name: string }>();
  const existingColumns = new Set<string>(
    bookingColumns.results.map((column: { name: string }) => column.name),
  );
  await addBookingColumnIfMissing(
    database,
    existingColumns,
    "consent_policy_version",
    ADD_BOOKINGS_CONSENT_POLICY_VERSION_SQL,
  );
  await addBookingColumnIfMissing(
    database,
    existingColumns,
    "checkout_id",
    ADD_BOOKINGS_CHECKOUT_ID_SQL,
  );
  await addBookingColumnIfMissing(
    database,
    existingColumns,
    "deposit_payment_id",
    ADD_BOOKINGS_DEPOSIT_PAYMENT_ID_SQL,
  );
  await addBookingColumnIfMissing(
    database,
    existingColumns,
    "tuning_details_json",
    ADD_BOOKINGS_TUNING_DETAILS_JSON_SQL,
  );

  await database.prepare(CREATE_BOOKING_CHECKOUTS_TABLE_SQL).run();
  const checkoutColumns = await database
    .prepare("PRAGMA table_info(booking_checkouts)")
    .all<{ name: string }>();
  const existingCheckoutColumns = new Set<string>(
    checkoutColumns.results.map((column: { name: string }) => column.name),
  );
  await addBookingColumnIfMissing(
    database,
    existingCheckoutColumns,
    "tuning_details_json",
    ADD_BOOKING_CHECKOUTS_TUNING_DETAILS_JSON_SQL,
  );

  await database.batch([
    database.prepare(CREATE_BOOKINGS_REFERENCE_INDEX_SQL),
    database.prepare(CREATE_BOOKINGS_CHECKOUT_INDEX_SQL),
    database.prepare(CREATE_BOOKINGS_DEPOSIT_PAYMENT_INDEX_SQL),
    database.prepare(CREATE_BOOKING_IDEMPOTENCY_TABLE_SQL),
    database.prepare(CREATE_BOOKING_IDEMPOTENCY_REFERENCE_INDEX_SQL),
    database.prepare(CREATE_BOOKING_RATE_LIMITS_TABLE_SQL),
    database.prepare(CREATE_BOOKING_RATE_LIMITS_WINDOW_INDEX_SQL),
    database.prepare(CREATE_BOOKING_CHECKOUTS_REFERENCE_INDEX_SQL),
    database.prepare(CREATE_BOOKING_CHECKOUTS_ACCOUNT_INDEX_SQL),
    database.prepare(CREATE_BOOKING_CHECKOUTS_STATE_INDEX_SQL),
    database.prepare(CREATE_BOOKING_CHECKOUT_IDEMPOTENCY_TABLE_SQL),
    database.prepare(CREATE_BOOKING_CHECKOUT_IDEMPOTENCY_INDEX_SQL),
    database.prepare(CREATE_DEPOSIT_PAYMENTS_TABLE_SQL),
    database.prepare(CREATE_DEPOSIT_PAYMENTS_PROVIDER_INDEX_SQL),
    database.prepare(CREATE_DEPOSIT_PAYMENTS_CHECKOUT_INDEX_SQL),
    database.prepare(CREATE_DEPOSIT_PAYMENTS_SUCCESS_INDEX_SQL),
    database.prepare(CREATE_DEPOSIT_RECEIPTS_TABLE_SQL),
    database.prepare(CREATE_DEPOSIT_RECEIPTS_NUMBER_INDEX_SQL),
    database.prepare(CREATE_DEPOSIT_RECEIPTS_PAYMENT_INDEX_SQL),
    database.prepare(CREATE_PAYMENT_WEBHOOK_EVENTS_TABLE_SQL),
    database.prepare(CREATE_PAYMENT_WEBHOOK_EVENTS_STATE_INDEX_SQL),
    database.prepare(CREATE_INTEGRATION_OUTBOX_TABLE_SQL),
    database.prepare(CREATE_INTEGRATION_OUTBOX_DEDUPE_INDEX_SQL),
    database.prepare(CREATE_INTEGRATION_OUTBOX_STATE_INDEX_SQL),
    database.prepare(CREATE_BOOKING_CALENDAR_EVENTS_TABLE_SQL),
    database.prepare(CREATE_BOOKING_CALENDAR_EVENTS_CHECKOUT_INDEX_SQL),
    database.prepare(CREATE_BOOKING_CALENDAR_EVENTS_REFERENCE_INDEX_SQL),
    database.prepare(CREATE_BOOKING_CALENDAR_EVENTS_PROVIDER_INDEX_SQL),
  ]);

  // Keep SQLite's query-planner statistics current after the index exists.
  await database.prepare("PRAGMA optimize").run();
}

export async function getBookingD1() {
  const database = getD1();
  bookingSchemaReady ??= initializeBookingSchema(database);

  try {
    await bookingSchemaReady;
  } catch (error) {
    // A transient initialization error must not poison this worker isolate.
    bookingSchemaReady = undefined;
    throw error;
  }

  return database;
}
