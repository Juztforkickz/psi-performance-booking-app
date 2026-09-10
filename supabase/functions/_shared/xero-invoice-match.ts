/** Pure checks over server-fetched data. Never use browser-supplied links/jobs. */
export type XeroInvoice = {
  InvoiceID?: string; Type?: string; Status?: string; CurrencyCode?: string;
  SentToContact?: boolean; Reference?: string; InvoiceNumber?: string;
  Date?: string; DateString?: string; Total?: number; AmountDue?: number; AmountPaid?: number;
  LineItems?: { Description?: string }[];
  Contact?: { ContactID?: string; Name?: string };
};
export type VerifiedContactLink = {
  tenant_id: string; contact_id: string; customer_id: string;
  verified_by: string | null; verified_at: string;
};
export type CheckedJob = { id: string; reference: string; customer_id: string; vehicle_id: string; booking_request_id?: string | null };
export type CheckedVehicle = { id: string; customer_id: string; archived_at: string | null };
type Input = {
  tenantId: string; expectedTenantId: string; expectedInvoiceId: string;
  invoice: XeroInvoice; links: VerifiedContactLink[]; jobs: CheckedJob[];
  vehicles: CheckedVehicle[]; activeCustomerIds: string[];
};
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const review = (reason: string) => ({ status: 'needs_review' as const, reason });

/** An eligible match is NOT permission to publish: fetch/validate PDF, recheck
 * ownership at persistence, version corrections and commit atomically first.
 * Reference must contain ONLY the complete PSI job reference; no fuzzy parsing.
 */
export function matchXeroInvoice(input: Input) {
  const { invoice, tenantId, expectedTenantId, expectedInvoiceId } = input;
  if (!uuid(tenantId) || tenantId !== expectedTenantId) return review('organisation_mismatch');
  if (!uuid(expectedInvoiceId) || invoice.InvoiceID !== expectedInvoiceId) return review('invoice_identity_mismatch');
  if (invoice.Type !== 'ACCREC') return review('not_customer_sales_invoice');
  // Voided/deleted invoices must be reconciled with any earlier publication.
  if (!['AUTHORISED', 'PAID'].includes(invoice.Status ?? '')) return review('invoice_status_requires_review');
  if (invoice.CurrencyCode !== 'AUD') return review('invoice_currency_requires_review');
  if (invoice.SentToContact !== true) return review('invoice_not_marked_sent');
  const contactId = invoice.Contact?.ContactID;
  if (!uuid(contactId)) return review('missing_contact_id');
  const links = input.links.filter(l => l.tenant_id === tenantId && l.contact_id === contactId);
  if (links.length !== 1) return review('verified_customer_link_required');
  const link = links[0];
  if (!uuid(link.customer_id) || !uuid(link.verified_by) || !Number.isFinite(Date.parse(link.verified_at))) return review('verified_customer_link_required');
  if (!input.activeCustomerIds.includes(link.customer_id)) return review('customer_account_unavailable');
  const reference = typeof invoice.Reference === 'string' ? invoice.Reference.trim().toUpperCase() : '';
  if (!/^[A-Z0-9][A-Z0-9 -]{2,79}$/.test(reference)) return review('exact_job_reference_required');
  const jobs = input.jobs.filter(j => j.reference === reference);
  if (jobs.length !== 1) return review('exact_job_reference_required');
  const job = jobs[0];
  if (!uuid(job.id) || !uuid(job.vehicle_id) || job.customer_id !== link.customer_id) return review('job_customer_mismatch');
  const vehicles = input.vehicles.filter(v => v.id === job.vehicle_id);
  if (vehicles.length !== 1 || vehicles[0].customer_id !== link.customer_id || vehicles[0].archived_at !== null) return review('vehicle_ownership_requires_review');
  return {
    status: 'eligible' as const, customerId: link.customer_id, vehicleId: job.vehicle_id,
    jobId: job.id, bookingRequestId: uuid(job.booking_request_id) ? job.booking_request_id : null,
    sourceReference: `${tenantId}:${expectedInvoiceId}`,
  };
}
