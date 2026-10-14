/** Financial changes do not change a saved waiting decision. Identity changes do. */
export function waitingInvoiceRefreshReason(previous: Record<string, unknown>, current: Record<string, unknown>) {
  for (const field of ['tenantId', 'invoiceId', 'contactId', 'reference', 'invoiceNumber', 'invoiceDate', 'currency']) {
    if (previous[field] !== current[field]) return 'waiting_invoice_identity_changed';
  }
  if (!['AUTHORISED', 'PAID'].includes(String(current.invoiceStatus))) return 'invoice_status_requires_review';
  return null;
}

export function reviewNotificationRequired(previousStatus: string | null, previousReason: string | null, reason: string) {
  return previousStatus !== 'needs_review' || previousReason !== reason;
}
