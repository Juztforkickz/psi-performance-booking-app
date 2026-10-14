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

export function verifyBookingPrepayment(prepayment: Record<string, any>, id:string, contactId:string, amount:number) {
  if (prepayment.PrepaymentID !== id || prepayment.Contact?.ContactID !== contactId
    || prepayment.Type !== 'RECEIVE-PREPAYMENT' || prepayment.CurrencyCode !== 'AUD'
    || !['AUTHORISED','PAID'].includes(prepayment.Status) || cents(prepayment.Total) !== amount
    || (prepayment.Payments?.length ?? 0) > 0) throw new Error('prepayment_identity_requires_review');
}

export function bookingPrepaymentApplied(prepayment:Record<string,any>, invoiceId:string, amount:number) {
  const allocations = (prepayment.Allocations ?? []).filter((item:Record<string,any>)=>item.IsDeleted!==true);
  if (allocations.length===0 && cents(prepayment.RemainingCredit)===amount) return false;
  if (allocations.length===1 && allocations[0].Invoice?.InvoiceID===invoiceId
    && cents(allocations[0].Amount)===amount && cents(prepayment.RemainingCredit)===0) return true;
  throw new Error('prepayment_allocation_requires_review');
}

// A verified Xero import may reuse a published workshop PC invoice. Its durable
// import identity, rather than the PDF's upload source, identifies the Xero invoice.
export function selectBookingInvoice(
  links: Record<string, any>[],
  record: Record<string, any> | null,
  context: {tenantId:string;jobId:string;customerId:string;vehicleId:string},
): string | null {
  if (!links.length) return null;
  const link = links[0];
  const parts = String(link.source_key).split(':');
  if (links.length !== 1 || link.source !== 'xero' || link.status !== 'imported'
    || link.job_id !== context.jobId || parts.length !== 2 || parts[0] !== context.tenantId
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(parts[1])
    || !record || record.id !== link.record_id || record.job_id !== context.jobId
    || record.customer_id !== context.customerId || record.vehicle_id !== context.vehicleId
    || record.kind !== 'invoice' || !record.published_at || !Number.isFinite(Date.parse(record.published_at))) {
    throw new Error('invoice_identity_requires_review');
  }
  return parts[1];
}
