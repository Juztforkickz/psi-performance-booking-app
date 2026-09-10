import assert from 'node:assert/strict';
import test from 'node:test';
import { matchXeroInvoice } from '../supabase/functions/_shared/xero-invoice-match.ts';

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const make = () => ({
  tenantId: id(1), expectedTenantId: id(1), expectedInvoiceId: id(2),
  invoice: { InvoiceID: id(2), Type: 'ACCREC', Status: 'AUTHORISED', CurrencyCode: 'AUD', SentToContact: true, Reference: 'PSI-2026-0123', Contact: { ContactID: id(3) } },
  links: [{ tenant_id: id(1), contact_id: id(3), customer_id: id(4), verified_by: id(5), verified_at: '2026-09-09T00:00:00Z' }],
  jobs: [{ id: id(6), reference: 'PSI-2026-0123', customer_id: id(4), vehicle_id: id(7), booking_request_id: id(10) }],
  vehicles: [{ id: id(7), customer_id: id(4), archived_at: null }, { id: id(8), customer_id: id(4), archived_at: null }],
  activeCustomerIds: [id(4)],
});
test('verified exact job selects correct vehicle for a multi-vehicle customer', () => {
  assert.deepEqual(matchXeroInvoice(make()), { status: 'eligible', customerId: id(4), vehicleId: id(7), jobId: id(6), bookingRequestId: id(10), sourceReference: `${id(1)}:${id(2)}` });
});
const cases = [
  ['different organisation', v => { v.tenantId = id(9); }, 'organisation_mismatch'],
  ['different invoice', v => { v.invoice.InvoiceID = id(9); }, 'invoice_identity_mismatch'],
  ['supplier invoice', v => { v.invoice.Type = 'ACCPAY'; }, 'not_customer_sales_invoice'],
  ['draft', v => { v.invoice.Status = 'DRAFT'; }, 'invoice_status_requires_review'],
  ['void', v => { v.invoice.Status = 'VOIDED'; }, 'invoice_status_requires_review'],
  ['deleted', v => { v.invoice.Status = 'DELETED'; }, 'invoice_status_requires_review'],
  ['foreign currency', v => { v.invoice.CurrencyCode = 'NZD'; }, 'invoice_currency_requires_review'],
  ['unsent', v => { v.invoice.SentToContact = false; }, 'invoice_not_marked_sent'],
  ['string sent flag', v => { v.invoice.SentToContact = 'true'; }, 'invoice_not_marked_sent'],
  ['missing contact', v => { delete v.invoice.Contact; }, 'missing_contact_id'],
  ['unlinked contact', v => { v.links = []; }, 'verified_customer_link_required'],
  ['link from another organisation', v => { v.links[0].tenant_id = id(9); }, 'verified_customer_link_required'],
  ['ambiguous contacts', v => { v.links.push({ ...v.links[0], customer_id: id(9) }); }, 'verified_customer_link_required'],
  ['no verification', v => { v.links[0].verified_by = null; }, 'verified_customer_link_required'],
  ['deleted customer', v => { v.activeCustomerIds = []; }, 'customer_account_unavailable'],
  ['registration only', v => { v.invoice.Reference = 'ABC123'; }, 'exact_job_reference_required'],
  ['name only', v => { v.invoice.Reference = 'Matt'; }, 'exact_job_reference_required'],
  ['multiple jobs', v => { v.invoice.Reference = 'PSI-2026-0123 / PSI-2026-0124'; }, 'exact_job_reference_required'],
  ['partial reference', v => { v.invoice.Reference = '0123'; }, 'exact_job_reference_required'],
  ['job belongs to another owner', v => { v.jobs[0].customer_id = id(9); }, 'job_customer_mismatch'],
  ['ambiguous jobs', v => { v.jobs.push({ ...v.jobs[0], id: id(9) }); }, 'exact_job_reference_required'],
  ['vehicle sold to another owner', v => { v.vehicles[0].customer_id = id(9); }, 'vehicle_ownership_requires_review'],
  ['archived vehicle', v => { v.vehicles[0].archived_at = '2026-09-09T00:00:00Z'; }, 'vehicle_ownership_requires_review'],
  ['missing vehicle', v => { v.vehicles = []; }, 'vehicle_ownership_requires_review'],
];
for (const [name, change, reason] of cases) test(`${name} requires review without a destination`, () => {
  const value = make(); change(value);
  assert.deepEqual(matchXeroInvoice(value), { status: 'needs_review', reason });
});
test('formatting alone may vary; identifiers never use fuzzy matches', () => {
  const value = make(); value.invoice.Reference = ' psi-2026-0123 ';
  value.invoice.Status = 'PAID';
  assert.equal(matchXeroInvoice(value).status, 'eligible');
});
