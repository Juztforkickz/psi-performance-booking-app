export function invoiceIdentity(value: string) {
  let compact = value.toUpperCase().replace(/[^A-Z0-9]+/gu, '');
  for (const prefix of ['XEROINVOICE', 'INVOICE', 'XERO']) {
    if (compact.startsWith(prefix)) {
      compact = compact.slice(prefix.length);
      break;
    }
  }
  return /^INV[A-Z0-9]{2,}$/u.test(compact) ? compact : null;
}

export function selectPublishedInvoiceByIdentity<T extends { title: string }>(records: readonly T[], invoiceNumber: string) {
  const expected = invoiceIdentity(invoiceNumber);
  if (!expected) return null;
  const matches = records.filter(record => invoiceIdentity(record.title) === expected);
  return matches.length === 1 ? matches[0] : null;
}
