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
    source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'mobile')),
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled')),
    consent INTEGER NOT NULL DEFAULT 1 CHECK (consent = 1),
    consented_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consent_policy_version TEXT NOT NULL DEFAULT 'psi-booking-contact-v1',
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

async function initializeBookingSchema(database: ReturnType<typeof getD1>) {
  await database.prepare(CREATE_BOOKINGS_TABLE_SQL).run();

  const bookingColumns = await database
    .prepare("PRAGMA table_info(bookings)")
    .all<{ name: string }>();
  if (
    !bookingColumns.results.some(
      (column) => column.name === "consent_policy_version",
    )
  ) {
    try {
      await database.prepare(ADD_BOOKINGS_CONSENT_POLICY_VERSION_SQL).run();
    } catch (error) {
      // Another isolate may have performed the same additive upgrade first.
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("duplicate column name")) {
        throw error;
      }
    }
  }

  await database.batch([
    database.prepare(CREATE_BOOKINGS_REFERENCE_INDEX_SQL),
    database.prepare(CREATE_BOOKING_IDEMPOTENCY_TABLE_SQL),
    database.prepare(CREATE_BOOKING_IDEMPOTENCY_REFERENCE_INDEX_SQL),
    database.prepare(CREATE_BOOKING_RATE_LIMITS_TABLE_SQL),
    database.prepare(CREATE_BOOKING_RATE_LIMITS_WINDOW_INDEX_SQL),
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
