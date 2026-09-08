import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("mobile payments remain approval-first and server-confirmed", async () => {
  const [migration, creator, webhook, bankVerifier] = await Promise.all([
    read("../supabase/migrations/20260908103000_booking_payments.sql"),
    read("../supabase/functions/create-booking-payment/index.ts"),
    read("../supabase/functions/stripe-booking-webhook/index.ts"),
    read("../supabase/functions/confirm-bank-transfer/index.ts"),
  ]);

  assert.match(creator, /booking\.state !== "date_approved"/u);
  assert.match(creator, /"payment_method_types\[0\]": "card"/u);
  assert.match(creator, /"payment_method_types\[1\]": "au_becs_debit"/u);
  assert.match(creator, /Idempotency-Key/u);
  assert.doesNotMatch(creator, /sk_(?:test|live)_[A-Za-z0-9]/u);

  assert.match(webhook, /Stripe-Signature/u);
  assert.match(webhook, /verifyStripeSignature\(rawBody/u);
  assert.match(webhook, /checkout\.session\.async_payment_succeeded/u);
  assert.match(webhook, /session\.payment_status === "paid"/u);
  assert.match(webhook, /confirm_booking_payment/u);

  assert.match(bankVerifier, /claims\?\.claims\?\.aal !== "aal2"/u);
  assert.match(bankVerifier, /bank_transfer_pending/u);
  assert.match(migration, /security definer/u);
  assert.match(migration, /old\.state = 'date_approved'|p_payment_attempt_id/u);
  assert.doesNotMatch(migration, /\b(?:drop table|truncate)\b/iu);
});

test("customer payment copy distinguishes wallets from bank transfer", async () => {
  const bookings = await read("../mobile/src/app/(tabs)/bookings.tsx");
  assert.match(bookings, /Card \/ Apple Pay \/ Google Pay/u);
  assert.match(bookings, /Bank transfer/u);
  assert.match(bookings, /stays unconfirmed until PSI matches the cleared transfer/u);
});
