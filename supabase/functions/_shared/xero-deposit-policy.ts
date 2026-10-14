export const depositScopes = [
  "accounting.payments",
  "accounting.banktransactions",
  "accounting.settings.read",
];
export function requireDepositScopes(scope: string | undefined) {
  const allowed = new Set((scope ?? "").split(/\s+/u));
  if (depositScopes.some((value) => !allowed.has(value))) {
    throw new Error("xero_deposit_consent_required");
  }
}
export function cents(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("invalid_money");
  }
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result)) throw new Error("invalid_money");
  return result;
}
export function verifyDepositInvoice(
  invoice: Record<string, any>,
  contactId: string,
  amount: number,
) {
  if (
    invoice.Type !== "ACCREC" || invoice.CurrencyCode !== "AUD" ||
    invoice.Contact?.ContactID !== contactId ||
    !["AUTHORISED", "PAID"].includes(invoice.Status)
  ) throw new Error("invoice_identity_requires_review");
  if (cents(invoice.AmountDue) < amount) {
    throw new Error("invoice_balance_requires_review");
  }
}
export function verifyStripeDeposit(
  intent: Record<string, any>,
  attempt: Record<string, any>,
) {
  const charge = intent.latest_charge;
  const balance = charge?.balance_transaction;
  if (
    intent.status !== "succeeded" || intent.livemode !== true ||
    intent.currency !== "aud" ||
    intent.amount_received !== attempt.amount_cents ||
    intent.id !== attempt.provider_payment_id ||
    intent.metadata?.payment_attempt_id !== attempt.id ||
    intent.metadata?.booking_request_id !== attempt.booking_request_id ||
    charge?.paid !== true || charge?.disputed ||
    charge?.amount_refunded !== 0 ||
    charge?.currency !== "aud" || charge?.amount !== attempt.amount_cents ||
    balance?.currency !== "aud" || balance?.amount !== attempt.amount_cents ||
    !Number.isSafeInteger(balance?.fee) || balance.fee < 0 ||
    balance.fee > attempt.amount_cents ||
    !Number.isSafeInteger(balance?.net) ||
    balance.net !== attempt.amount_cents - balance.fee
  ) {
    throw new Error("stripe_deposit_requires_review");
  }
  return {
    fee: balance.fee as number,
    net: balance.net as number,
    paidDate: new Date(charge.created * 1000).toLocaleDateString("en-CA", {
      timeZone: "Australia/Sydney",
    }),
  };
}
// An expired provider idempotency key is never a reason to repeat an uncertain write.
export function allowFinancialWrite(intent: unknown) {
  if (intent) throw new Error("uncertain_previous_write_requires_review");
}
