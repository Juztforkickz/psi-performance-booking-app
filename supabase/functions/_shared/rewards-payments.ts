import { rewardCents, xeroTimestamp, type RewardsInvoice } from './rewards-policy.ts';

type Row = Record<string, unknown>;
export type RewardsPaymentFact = { source_id: string; allocation_id: string; source_kind: 'payment' | 'prepayment' | 'overpayment';
  original_receipt_id: string; accounting_date: string; amount_cents: number; capacity_cents: number; date_precision: 'date'; occurred_at: null };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(row) : [];

// All Xero dates are accounting dates. Allocation dates are never substituted for
// original receipt dates, and UpdatedDateUTC is never interpreted as payment time.
export async function rewardsPaymentFacts(invoice: RewardsInvoice, read: (kind: string, id: string) => Promise<Row>): Promise<RewardsPaymentFact[]> {
  if (invoice.Status !== 'PAID') return [];
  if (!uuid(invoice.InvoiceID) || !uuid(invoice.Contact?.ContactID)) throw new Error('rewards_payment_identity_review');
  const facts: RewardsPaymentFact[] = [], seen = new Set<string>();
  const add = (kind: RewardsPaymentFact['source_kind'], id: string, original: Row, amount: number, capacity: number) => {
    const date = xeroTimestamp(original.Date)?.slice(0,10);
    const key = `${kind}:${id}`;
    if (!date || seen.has(key) || amount <= 0 || capacity < amount) throw new Error('rewards_payment_facts_review');
    seen.add(key);
    facts.push({ source_id: id, source_kind: kind, allocation_id: invoice.InvoiceID!, original_receipt_id: key,
      accounting_date: date, amount_cents: amount, capacity_cents: capacity, date_precision: 'date', occurred_at: null });
  };
  for (const payment of rows(invoice.Payments)) {
    if (!uuid(payment.PaymentID)) throw new Error('rewards_payment_facts_review');
    const original = await read('Payments', payment.PaymentID);
    if (original.PaymentID !== payment.PaymentID || original.Status !== 'AUTHORISED'
      || row(original.Invoice).InvoiceID !== invoice.InvoiceID || rewardCents(original.Amount) !== rewardCents(payment.Amount)) throw new Error('rewards_payment_identity_review');
    add('payment', payment.PaymentID, original, rewardCents(original.Amount), rewardCents(original.Amount));
  }
  for (const [list, collection, idKey, kind] of [
    [invoice.Prepayments,'Prepayments','PrepaymentID','prepayment'],
    [invoice.Overpayments,'Overpayments','OverpaymentID','overpayment'],
  ] as const) {
    for (const allocation of rows(list)) {
      const id = allocation[idKey];
      if (!uuid(id)) throw new Error('rewards_payment_facts_review');
      const original = await read(collection, id);
      if (original[idKey] !== id || original.Type !== (kind === 'prepayment' ? 'RECEIVE-PREPAYMENT' : 'RECEIVE-OVERPAYMENT')
        || original.Status !== 'AUTHORISED' || row(original.Contact).ContactID !== invoice.Contact.ContactID
        || original.CurrencyCode !== 'AUD') throw new Error('rewards_payment_identity_review');
      const all = rows(original.Allocations).filter(item => !item.IsDeleted);
      const amount = all.filter(item => row(item.Invoice).InvoiceID === invoice.InvoiceID).reduce((sum,item) => sum + rewardCents(item.Amount),0);
      const allocated = all.reduce((sum,item) => sum + rewardCents(item.Amount),0);
      const capacity = rewardCents(original.Total);
      if (all.some(item => rewardCents(item.Amount) < 0) || allocated > capacity || amount !== rewardCents(allocation.AppliedAmount)) throw new Error('rewards_payment_allocation_review');
      add(kind, id, original, amount, capacity);
    }
  }
  return facts.sort((a,b) => a.original_receipt_id.localeCompare(b.original_receipt_id));
}

export function rewardsPaymentReader(token: string, tenant: string, request: typeof fetch = fetch) {
  if (!uuid(tenant) || !token || /[\r\n]/u.test(token)) throw new Error('rewards_payment_configuration_required');
  return async (kind: string, id: string): Promise<Row> => {
    if (!['Payments','Prepayments','Overpayments'].includes(kind) || !uuid(id)) throw new Error('rewards_payment_identity_review');
    const response = await request(`https://api.xero.com/api.xro/2.0/${kind}/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'xero-tenant-id': tenant, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('rewards_payment_fetch_retry'); }
    const text = await response.text();
    if (text.length > 2 * 1024 * 1024) throw new Error('rewards_payment_facts_review');
    const values = rows(JSON.parse(text)[kind]);
    if (values.length !== 1) throw new Error('rewards_payment_identity_review');
    return values[0];
  };
}
