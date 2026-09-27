export function xeroImportFailureMessage(error: unknown, matchSaved: boolean): string {
  if (matchSaved) return 'The match was saved. Refresh the invoice list to check progress. The secure importer can retry without creating another invoice.';
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/owner_aal2_required|JWT|session.*expired/i.test(message)) {
    return 'Open owner security and verify your session, then retry this invoice.';
  }
  if (/xero_customer_vehicle_job_mismatch|Choose the verified customer vehicle/i.test(message)) {
    return 'The customer or vehicle does not match this invoice. Check the customer and registration before trying again.';
  }
  if (/xero_import_not_reviewable/.test(message)) {
    return 'This invoice has already moved to another stage. Refresh the invoice list to check its current status.';
  }
  return 'The invoice match could not be saved because of a connection or system error. Your selection has been kept. Please retry or contact PSI support if it continues.';
}
