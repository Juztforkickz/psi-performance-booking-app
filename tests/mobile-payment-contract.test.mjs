import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("mobile payments remain approval-first and server-confirmed", async () => {
  const [migration, creator, webhook, bankVerifier, integrationWorker] = await Promise.all([
    read("../supabase/migrations/20260908103000_booking_payments.sql"),
    read("../supabase/functions/create-booking-payment/index.ts"),
    read("../supabase/functions/stripe-booking-webhook/index.ts"),
    read("../supabase/functions/confirm-bank-transfer/index.ts"),
    read("../supabase/functions/process-booking-integrations/index.ts"),
  ]);

  assert.match(creator, /booking\.state !== "date_approved"/u);
  assert.match(creator, /"payment_method_types\[0\]": "card"/u);
  assert.doesNotMatch(creator, /au_becs_debit/u);
  assert.match(creator, /Idempotency-Key/u);
  assert.match(creator, /\(\?:sk\|rk\)_live_/u);
  assert.match(creator, /\(\?:sk\|rk\)_test_/u);
  assert.doesNotMatch(creator, /sk_(?:test|live)_[A-Za-z0-9]/u);

  assert.match(webhook, /Stripe-Signature/u);
  assert.match(webhook, /verifyStripeSignature\(rawBody/u);
  assert.match(webhook, /checkout\.session\.async_payment_succeeded/u);
  assert.match(webhook, /session\.payment_status === "paid"/u);
  assert.match(webhook, /confirm_booking_payment/u);
  assert.match(webhook, /processConfirmedBooking\(supabaseUrl, serviceKey, bookingId\)/u);
  assert.match(webhook, /booking_integrations_pending/u);
  assert.match(integrationWorker, /isInternalServiceCall = isScheduledCron \|\| accessToken === serviceRoleKey/u);
  assert.match(integrationWorker, /verify_service_reminder_cron_token/u);
  assert.match(integrationWorker, /internal_booking_id_required/u);

  assert.match(bankVerifier, /claims\?\.claims\?\.aal !== "aal2"/u);
  assert.match(bankVerifier, /bank_transfer_pending/u);
  assert.match(bankVerifier, /processConfirmedBooking\(supabaseUrl, serviceKey, bookingId\)/u);
  assert.match(bankVerifier, /booking_integrations_pending/u);
  assert.match(migration, /security definer/u);
  assert.match(migration, /old\.state = 'date_approved'|p_payment_attempt_id/u);
  assert.doesNotMatch(migration, /\b(?:drop table|truncate)\b/iu);
});

test("customer payment copy distinguishes wallets from bank transfer", async () => {
  const [bookings, integrationWorker, depositPromptMigration] = await Promise.all([
    read("../mobile/src/app/(tabs)/bookings.tsx"),
    read("../supabase/functions/process-booking-integrations/index.ts"),
    read("../supabase/migrations/20260912194500_clarify_booking_deposit_prompt.sql"),
  ]);
  assert.match(bookings, /Card \/ Apple Pay \/ Google Pay/u);
  assert.match(bookings, /Bank transfer/u);
  assert.match(bookings, /stays unconfirmed until PSI matches the cleared transfer/u);
  assert.match(integrationWorker, /Date approved · deposit ready/u);
  assert.match(integrationWorker, /Open Bookings in the PSI app now to choose card, Apple Pay, Google Pay or bank transfer/u);
  assert.match(depositPromptMigration, /Open Bookings now to choose card, Apple Pay, Google Pay or bank transfer for your deposit/u);
});
