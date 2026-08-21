import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  BOOKING_CATALOG,
  BOOKING_POLICY_VERSION,
  DEPOSIT_POLICY_VERSION,
} from "../app/api/v1/booking-catalog/catalog.ts";
import {
  validatePartialTuningDetails,
  validateTuningDetails,
} from "../app/api/v1/booking-checkouts/tuning-details.ts";
import { POST as legacyCheckout } from "../app/api/v1/booking-checkouts/route.ts";

async function migrationFiles() {
  return (await readdir(new URL("../drizzle/", import.meta.url)))
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort();
}

async function applyMigrations(database) {
  for (const name of await migrationFiles()) {
    const sql = await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
    database.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }
}

test("approval-first migrations are additive and apply sequentially", async () => {
  for (const name of (await migrationFiles()).filter((value) => value >= "0005_")) {
    const sql = await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(sql, /\b(?:DROP|DELETE|TRUNCATE)\b/iu, `${name} must be additive`);
  }
  const database = new DatabaseSync(":memory:");
  await applyMigrations(database);
  const tables = new Set(
    database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
      .all()
      .map((row) => row.name),
  );
  for (const table of [
    "booking_requests",
    "booking_request_checkouts",
    "booking_request_action_claims",
    "booking_request_payments",
    "booking_request_transitions",
    "customer_profiles",
    "customer_vehicles",
    "appointment_reminder_jobs",
    "service_reminder_jobs",
    "service_reminder_suppressions",
  ]) {
    assert.ok(tables.has(table), `${table} must exist`);
  }
  const requestColumns = new Set(
    database.prepare("PRAGMA table_info(booking_requests)").all().map((row) => row.name),
  );
  for (const column of [
    "first_name_snapshot",
    "email_snapshot",
    "vehicle_make_snapshot",
    "confirmed_allocation_mode",
    "confirmed_start_time",
    "confirmed_end_time",
    "state_version",
  ]) {
    assert.ok(requestColumns.has(column), `${column} must exist`);
  }
  assert.throws(
    () => database
      .prepare(
        `INSERT INTO booking_requests (
           id, public_reference, first_name_snapshot, last_name_snapshot,
           email_snapshot, mobile_snapshot, vehicle_make_snapshot,
           vehicle_model_snapshot, vehicle_year_snapshot, registration_snapshot,
           booking_type, service_option, appointment_preference_mode,
           preferred_date, arrival_arrangement, request_details, source,
           contact_consent, booking_terms_accepted, booking_policy_version,
           deposit_policy_version, deposit_amount_cents, confirmed_allocation_mode,
           confirmed_start_time, confirmed_end_time
         ) VALUES (
           'bad-allocation', 'PSI-00000000000000000000000000000009',
           'Test', 'Customer', 'test@example.com', '+61400000000', 'Holden',
           'Commodore', 2020, 'BAD001', 'service', 'service_report', 'specific',
           '2030-01-07', 'business_hours', 'Synthetic request', 'web', 1, 1,
           'psi-booking-v1', 'psi-deposit-v3', 10000, 'timed', '17:00', '08:30'
         )`,
      )
      .run(),
    /booking_requests_confirmed_allocation_check/u,
  );
  database
    .prepare(
      "INSERT INTO booking_request_action_claims (booking_request_id, expected_version, action_key_hash) VALUES ('request-race', 0, ?)",
    )
    .run("a".repeat(64));
  assert.throws(
    () => database
      .prepare(
        "INSERT INTO booking_request_action_claims (booking_request_id, expected_version, action_key_hash) VALUES ('request-race', 0, ?)",
      )
      .run("b".repeat(64)),
    /UNIQUE constraint failed/u,
  );
  database.close();
});

test("guest snapshots persist without claiming or mutating an account", async () => {
  const database = new DatabaseSync(":memory:");
  await applyMigrations(database);
  database
    .prepare(
      `INSERT INTO booking_requests (
         id, public_reference, customer_profile_id, vehicle_id,
         first_name_snapshot, last_name_snapshot, email_snapshot, mobile_snapshot,
         vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot,
         registration_snapshot, booking_type, service_option,
         appointment_preference_mode, preferred_date, arrival_arrangement,
         request_details, source, contact_consent, booking_terms_accepted,
         booking_policy_version, deposit_policy_version, deposit_amount_cents
       ) VALUES (
         'request-guest', 'PSI-00000000000000000000000000000001', NULL, NULL,
         'Guest', 'Customer', 'guest@example.com', '+61400000000',
         'Holden', 'Commodore', 2020, 'PSI001', 'service', 'service_report',
         'specific', '2030-01-07', 'business_hours', 'Synthetic request', 'web',
         1, 1, 'psi-booking-v1', 'psi-deposit-v3', 10000
       )`,
    )
    .run();
  assert.equal(database.prepare("SELECT count(*) count FROM customer_profiles").get().count, 0);
  assert.equal(database.prepare("SELECT count(*) count FROM customer_vehicles").get().count, 0);
  assert.deepEqual(
    { ...database
      .prepare("SELECT customer_profile_id profile, vehicle_id vehicle, email_snapshot email FROM booking_requests")
      .get() },
    { profile: null, vehicle: null, email: "guest@example.com" },
  );
  database.close();
});

test("catalog and date rules expose GST-inclusive approval-first pricing", async () => {
  assert.equal(BOOKING_POLICY_VERSION, "psi-booking-v1");
  assert.equal(DEPOSIT_POLICY_VERSION, "psi-deposit-v3");
  assert.equal(BOOKING_CATALOG.choices[0].priceGuide.amountCents, 42_350);
  assert.equal(BOOKING_CATALOG.choices[1].priceGuide.amountCents, 64_900);
  assert.equal(BOOKING_CATALOG.choices[0].priceGuide.gstInclusive, true);
  assert.equal(BOOKING_CATALOG.choices[1].priceGuide.gstInclusive, true);
  assert.equal(BOOKING_CATALOG.deposit.requiredAtRequest, false);
  const contract = await readFile(
    new URL("../app/api/v1/booking-requests/contract.ts", import.meta.url),
    "utf8",
  );
  assert.match(contract, /type === "dyno" \? day === 1 \|\| day === 3 \|\| day === 4/u);
  assert.match(contract, /day >= 1 && day <= 5/u);
});

test("known dyno setups remain strict while PSI inspection accepts partial details", () => {
  assert.ok(validateTuningDetails(undefined).errors?.tuningDetails);
  assert.deepEqual(validatePartialTuningDetails(undefined), { details: null, errors: null });
  assert.deepEqual(validatePartialTuningDetails({ engineState: "stock" }), {
    details: { engineState: "stock" },
    errors: null,
  });
  assert.ok(
    validatePartialTuningDetails({ engineState: "invented" }).errors?.[
      "tuningDetails.engineState"
    ],
  );
});

test("legacy public endpoints cannot bypass staff approval", async () => {
  const response = await legacyCheckout();
  assert.equal(response.status, 410);
  assert.equal((await response.json()).error.code, "APPROVAL_REQUIRED");
  assert.match(response.headers.get("link") ?? "", /\/api\/v1\/booking-requests/u);
  const legacyBooking = await readFile(
    new URL("../app/api/v1/bookings/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(legacyBooking, /"APPROVAL_REQUIRED"/u);
  assert.match(legacyBooking, /<\/api\/v1\/booking-requests>/u);
});

test("provider and reminder routes remain fail-closed and privacy-safe", async () => {
  const [requestRoute, adminRoute, checkoutReady, checkoutCancelled, webhook, reminders, unsubscribe, legacyAdmin] =
    await Promise.all([
      readFile(new URL("../app/api/v1/booking-requests/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/v1/admin/booking-requests/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/v1/integrations/payments/checkout-ready/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/v1/integrations/payments/checkout-cancelled/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/v1/integrations/payments/webhook/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/v1/admin/reminders/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/v1/service-reminders/unsubscribe/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/v1/admin/bookings/route.ts", import.meta.url), "utf8"),
    ]);
  assert.doesNotMatch(requestRoute, /INSERT INTO customer_profiles|INSERT INTO customer_vehicles/u);
  assert.match(requestRoute, /first_name_snapshot/u);
  assert.match(requestRoute, /paymentRequiredNow:\s*false/u);
  assert.match(adminRoute, /PAYMENT_PROVIDER_NOT_CONFIGURED/u);
  assert.match(adminRoute, /provider_pending/u);
  assert.match(adminRoute, /CHECKOUT_ALREADY_ISSUED/u);
  assert.match(adminRoute, /current\.checkoutId[\s\S]*awaiting_payment[\s\S]*processing[\s\S]*paid/u);
  assert.match(adminRoute, /BOOKING_AMOUNT_MISMATCH/u);
  assert.match(adminRoute, /replacingInactiveCheckout/u);
  assert.match(adminRoute, /\["expired", "cancelled"\]\.includes/u);
  assert.match(adminRoute, /action === "expire_deposit"/u);
  assert.match(adminRoute, /CHECKOUT_NOT_EXPIRED/u);
  assert.match(adminRoute, /calendar:reschedule:[\s\S]*allocationFingerprint/u);
  assert.match(adminRoute, /calendar\.update_internal/u);
  assert.match(adminRoute, /calendar\.cancel_internal/u);
  assert.match(adminRoute, /CALENDAR_RECONCILIATION_REQUIRED/u);
  assert.match(adminRoute, /payment_checkout\.cancel/u);
  assert.match(adminRoute, /doNotCancelIfPaymentCaptured:\s*true/u);
  assert.match(adminRoute, /claimAction\(database, current, keyHash\)/u);
  assert.match(checkoutReady, /isAllowedProviderUrl\(checkoutUrl, "checkout"\)/u);
  assert.match(checkoutReady, /approvedAppointment:\s*\{/u);
  assert.match(checkoutReady, /confirmedAllocationMode/u);
  assert.match(checkoutReady, /deposit-request:customer:\$\{row\.bookingRequestId\}:\$\{checkoutId\}/u);
  assert.match(webhook, /verifySignedProviderRequest/u);
  assert.match(webhook, /depositAmountForBookingType\(checkout\.bookingType\)/u);
  assert.match(webhook, /EVENT_CONFLICT/u);
  assert.match(webhook, /PAYMENT_COMPLETED/u);
  assert.match(checkoutCancelled, /paymentCaptured !== false/u);
  assert.match(checkoutCancelled, /cancellation_pending/u);
  assert.match(webhook, /attendees:\s*\[\]/u);
  assert.match(webhook, /sendUpdates:\s*"none"/u);
  assert.match(webhook, /getMelbourneDateParts\(\)\.isoDate/u);
  assert.match(reminders, /containsReviewRequest:\s*false/u);
  assert.match(reminders, /service_reminder_suppressions/u);
  assert.match(reminders, /function publicAppOrigin\(\)/u);
  assert.match(unsubscribe, /recipient_email_hash/u);
  assert.match(unsubscribe, /CUSTOMER_UNSUBSCRIBED/u);
  assert.doesNotMatch(unsubscribe, /email_snapshot/u);
  assert.match(legacyAdmin, /LEGACY_ADMIN_DISABLED/u);
});
