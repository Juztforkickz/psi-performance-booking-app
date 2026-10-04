type InvoiceEvidence = { Reference?: string; LineItems?: { Description?: string }[] };

/** Only a complete, explicitly labelled registration line is vehicle evidence. */
export function xeroDescriptionRegistration(invoice: InvoiceEvidence): string | null {
  const registrations = new Set<string>();
  for (const item of invoice.LineItems ?? []) {
    if (typeof item.Description !== 'string') continue;
    for (const line of item.Description.split(/\r?\n/u)) {
      const labelled = /^\s*(?:REGISTRATION|REGO|REG)\s*[:#=]\s*(.*?)\s*$/iu.exec(line);
      if (!labelled) continue;
      const registration = labelled[1].toUpperCase();
      if (!/^[A-Z0-9]{2,10}$/u.test(registration)) return null;
      registrations.add(registration);
    }
  }
  return registrations.size === 1 ? [...registrations][0] : null;
}

export function xeroInvoiceMatchesVehicle(invoice: InvoiceEvidence, jobReference: string, registration: string): boolean {
  const reference = (invoice.Reference ?? '').trim().toUpperCase();
  if (reference && reference === jobReference.trim().toUpperCase()) return true;
  const plate = registration.trim().toUpperCase().replace(/[^A-Z0-9]+/gu, '');
  if (!plate) return false;
  const tokens = ` ${reference.replace(/[^A-Z0-9]+/gu, ' ').trim()} `;
  return tokens.includes(` ${plate} `) || xeroDescriptionRegistration(invoice) === plate;
}
