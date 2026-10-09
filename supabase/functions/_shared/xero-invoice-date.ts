/** Accept both date representations documented by the Xero Accounting API. */
export function xeroInvoiceDate(value: { Date?: unknown; DateString?: unknown; date?: unknown; dateString?: unknown }) {
  const rawValues = [value.DateString, value.Date, value.dateString, value.date];
  for (const raw of rawValues) {
    const candidate = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
    if (!candidate) continue;
    const iso = candidate.match(/(\d{4})-(\d{2})-(\d{2})(?:T|\b)/u);
    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const day = Number(iso[3]);
      const checked = new Date(Date.UTC(year, month - 1, day));
      if (checked.getUTCFullYear() === year && checked.getUTCMonth() === month - 1 && checked.getUTCDate() === day) {
        return `${iso[1]}-${iso[2]}-${iso[3]}`;
      }
    }
    const legacy = candidate.match(/Date\((-?\d+)(?:[+-]\d{4})?\)/u);
    if (legacy) {
      const parsed = new Date(Number(legacy[1]));
      if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    }
    if (/^-?\d{10,13}$/u.test(candidate)) {
      const milliseconds = candidate.length <= 10 ? Number(candidate) * 1000 : Number(candidate);
      const parsed = new Date(milliseconds);
      if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    }
  }
  throw new Error('xero_invoice_date_requires_review');
}
