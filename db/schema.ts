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
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_bookings_public_reference").on(table.publicReference),
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
    check("bookings_consent_check", sql`${table.consent} = 1`),
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
