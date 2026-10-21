// Server-fetched Xero invoices only. This policy never accepts payment claims from clients.
export type RewardsInvoice = {
  InvoiceID?: string; Type?: string; Status?: string; CurrencyCode?: string;
  InvoiceNumber?: string; Contact?: { ContactID?: string };
  Total?: number; AmountDue?: number; AmountPaid?: number; AmountCredited?: number;
  FullyPaidOnDate?: unknown; UpdatedDateUTC?: unknown; UpdatedDateUTCString?: unknown;
  CreditNotes?: { AppliedAmount?: number }[];
  Prepayments?: { AppliedAmount?: number }[];
  Overpayments?: { AppliedAmount?: number }[];
  LineAmountTypes?: string;
  LineItems?: { Description?: string; LineAmount?: number; TaxAmount?: number }[];
};

export function rewardCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('rewards_amount_requires_review');
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result) || Math.abs(result) > 2147483647) throw new Error('rewards_amount_requires_review');
  return result;
}

export function xeroTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const legacy = value.match(/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/u);
  const time = legacy ? Number(legacy[1]) : /^\d{4}-\d{2}-\d{2}(?:T.*)?$/u.test(value) ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function rewardsInvoiceSnapshot(invoice: RewardsInvoice, startDate: string) {
  if (invoice.Type !== 'ACCREC') return { excluded: true as const };
  if (invoice.CurrencyCode !== 'AUD') throw new Error('rewards_currency_requires_review');
  const providerUpdatedAt = xeroTimestamp(invoice.UpdatedDateUTCString ?? invoice.UpdatedDateUTC);
  if (!providerUpdatedAt) throw new Error('rewards_invoice_version_required');
  const active = ['AUTHORISED', 'PAID'].includes(invoice.Status ?? '');
  const paidOn = xeroTimestamp(invoice.FullyPaidOnDate)?.slice(0, 10) ?? null;
  let redeemedPoints = 0;
  if (active) {
    for (const item of invoice.LineItems ?? []) {
      if (!/^PSI Rewards credit(?:\s|$)/iu.test(item.Description?.trim() ?? '')) continue;
      if (!['Inclusive', 'Exclusive', 'NoTax'].includes(invoice.LineAmountTypes ?? '')) throw new Error('rewards_tax_basis_requires_review');
      const amount = rewardCents(item.LineAmount);
      const tax = invoice.LineAmountTypes === 'Exclusive' ? rewardCents(item.TaxAmount) : 0;
      if (amount >= 0 || tax > 0 || amount + tax >= 0) throw new Error('rewards_credit_line_requires_review');
      redeemedPoints += -(amount + tax); // One point is one cent of workshop credit.
    }
  }
  let eligibleCents = 0;
  if (invoice.Status === 'PAID') {
    if (!paidOn) throw new Error('rewards_paid_date_required');
    const todayParts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (name: string) => todayParts.find(item => item.type === name)?.value;
    if (paidOn > `${part('year')}-${part('month')}-${part('day')}`) throw new Error('rewards_future_payment_requires_review');
    const total = rewardCents(invoice.Total);
    const due = rewardCents(invoice.AmountDue);
    const paid = rewardCents(invoice.AmountPaid);
    const credited = rewardCents(invoice.AmountCredited ?? 0);
    const sum = (rows: { AppliedAmount?: number }[] | undefined) => (rows ?? []).reduce((value, row) => {
      const amount = rewardCents(row.AppliedAmount);
      if (amount < 0) throw new Error('rewards_allocation_requires_review');
      return value + amount;
    }, 0);
    const creditNotes = sum(invoice.CreditNotes);
    const advancePayments = sum(invoice.Prepayments) + sum(invoice.Overpayments);
    if (due !== 0 || total < 0 || paid < 0 || credited < 0 || total !== paid + credited
      || credited !== creditNotes + advancePayments || creditNotes > total) throw new Error('rewards_payment_totals_require_review');
    if (paidOn >= startDate) eligibleCents = total - creditNotes;
  }
  return {
    excluded: false as const, providerUpdatedAt, paidOn,
    invoiceNumber: (invoice.InvoiceNumber?.trim() || invoice.InvoiceID?.slice(0, 8).toUpperCase() || 'Invoice').slice(0, 120),
    eligibleCents, earnedPoints: Math.floor(eligibleCents / 100), redeemedPoints,
  };
}
