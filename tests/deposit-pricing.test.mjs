import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

async function readMigration(name) {
  const sql = await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
  return sql.replaceAll("--> statement-breakpoint", "");
}

test("deposit migration preserves existing payment records and permits the new service minimum", async () => {
  const database = new DatabaseSync(":memory:");
  for (const name of [
    "0000_robust_black_crow.sql",
    "0001_remarkable_young_avengers.sql",
    "0002_polite_centennial.sql",
    "0003_tiresome_maelstrom.sql",
  ]) {
    database.exec(await readMigration(name));
  }

  database.exec(`
    INSERT INTO booking_checkouts (
      id, public_reference, booking_type, service_option, first_name, last_name,
      email, mobile, vehicle_make, vehicle_model, vehicle_year, registration,
      preferred_date, request_details, expires_at
    ) VALUES (
      'checkout-existing', 'PSI-EXISTING', 'service', 'service_report', 'Existing', 'Customer',
      'existing@example.com', '+61400000000', 'Holden', 'Commodore', 2020, 'OLD001',
      '2030-01-02', 'Existing synthetic migration record', '2030-01-01T00:00:00.000Z'
    );
    INSERT INTO deposit_payments (
      id, checkout_id, provider, provider_payment_id, expected_amount_cents
    ) VALUES ('payment-existing', 'checkout-existing', 'test', 'provider-existing', 20000);
    INSERT INTO deposit_receipts (
      id, receipt_number, payment_id, supplier_name, customer_name, customer_email,
      description, amount_cents
    ) VALUES (
      'receipt-existing', 'PSI-RECEIPT-EXISTING', 'payment-existing', 'PSI Performance',
      'Existing Customer', 'existing@example.com', 'Existing synthetic deposit', 20000
    );
  `);

  database.exec(await readMigration("0004_parched_starjammers.sql"));

  assert.equal(database.prepare("SELECT count(*) AS count FROM booking_checkouts").get().count, 1);
  assert.equal(database.prepare("SELECT count(*) AS count FROM deposit_payments").get().count, 1);
  assert.equal(database.prepare("SELECT count(*) AS count FROM deposit_receipts").get().count, 1);

  database.exec(`
    INSERT INTO booking_checkouts (
      id, public_reference, booking_type, service_option, first_name, last_name,
      email, mobile, vehicle_make, vehicle_model, vehicle_year, registration,
      preferred_date, request_details, deposit_amount_cents, expires_at
    ) VALUES (
      'checkout-service-v2', 'PSI-SERVICE-V2', 'service', 'service_report', 'PSI', 'QA',
      'service-v2@example.com', '+61400000001', 'Holden', 'Commodore', 2020, 'NEW100',
      '2030-01-03', 'Synthetic service deposit migration check', 10000,
      '2030-01-02T00:00:00.000Z'
    );
    INSERT INTO deposit_payments (
      id, checkout_id, provider, provider_payment_id, expected_amount_cents
    ) VALUES ('payment-service-v2', 'checkout-service-v2', 'test', 'provider-service-v2', 10000);
    INSERT INTO deposit_receipts (
      id, receipt_number, payment_id, supplier_name, customer_name, customer_email,
      description, amount_cents
    ) VALUES (
      'receipt-service-v2', 'PSI-RECEIPT-SERVICE-V2', 'payment-service-v2', 'PSI Performance',
      'PSI QA', 'service-v2@example.com', 'Synthetic service deposit', 10000
    );
  `);

  const v2Checkout = database
    .prepare("SELECT deposit_amount_cents, deposit_policy_version FROM booking_checkouts WHERE id = ?")
    .get("checkout-service-v2");
  assert.equal(v2Checkout.deposit_amount_cents, 10000);
  assert.equal(v2Checkout.deposit_policy_version, "psi-deposit-v2");
  assert.equal(
    database.prepare("SELECT expected_amount_cents FROM deposit_payments WHERE id = ?").get("payment-service-v2")
      .expected_amount_cents,
    10000,
  );
  assert.equal(
    database.prepare("SELECT amount_cents FROM deposit_receipts WHERE id = ?").get("receipt-service-v2")
      .amount_cents,
    10000,
  );
  database.close();
});
