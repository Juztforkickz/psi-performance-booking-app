const cleanReferencePart = (value: string) => value
  .toUpperCase()
  .replace(/[^A-Z0-9 -]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export function xeroWorkshopJobReference(invoiceNumber: string, registration: string) {
  const invoice = cleanReferencePart(invoiceNumber) || 'INVOICE';
  const vehicle = cleanReferencePart(registration);
  const reference = `XERO ${invoice}${vehicle ? ` - ${vehicle}` : ''}`.slice(0, 80).trim();
  if (!/^[A-Z0-9][A-Z0-9 -]{2,79}$/.test(reference)) {
    throw new Error('The Xero invoice could not produce a safe PSI job reference.');
  }
  return reference;
}
