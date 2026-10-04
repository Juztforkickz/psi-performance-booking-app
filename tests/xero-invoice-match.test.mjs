import assert from 'node:assert/strict';
import test from 'node:test';
import { matchXeroInvoice } from '../supabase/functions/_shared/xero-invoice-match.ts';
import { invoiceIdentity, selectPublishedInvoiceByIdentity } from '../supabase/functions/_shared/xero-invoice-dedupe.ts';
import { selectReusableXeroWorkshopJob, xeroWorkshopJobReference } from '../mobile/src/lib/xero-workshop-reference.ts';
import { xeroDescriptionRegistration } from '../supabase/functions/_shared/xero-invoice-registration.ts';

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
test('an owner-confirmed queue job remains eligible when Xero uses the registration as its reference', () => {
  const value = make();
  value.invoice.Reference = 'VF BJS98 - REPAIRS';
  value.confirmedJobId = id(6);
  value.vehicles[0].registration = 'BJS98';
  assert.deepEqual(matchXeroInvoice(value), {
    status: 'eligible', customerId: id(4), vehicleId: id(7), jobId: id(6),
    bookingRequestId: id(10), sourceReference: `${id(1)}:${id(2)}`,
  });
});

test('a confirmed job accepts the explicit vehicle registration already in the invoice description', () => {
  const value = make();
  value.invoice.Reference = 'VZ SERVICE / REPAIRS / BRAKES / TUNE / TACHO';
  value.invoice.LineItems = [{ Description: '2005 VZ SS SEDAN AUTOMATIC\nCOLOUR : SILVER\nREGISTRATION : TEST42\nVIN # FIXTUREVIN12345678' }];
  value.vehicles[0].registration = 'TEST42';
  value.confirmedJobId = id(6);
  assert.equal(matchXeroInvoice(value).status, 'eligible');
  value.invoice.Reference = '';
  assert.equal(matchXeroInvoice(value).status, 'eligible');
});

test('changed, partial, ambiguous and unlabelled invoice registrations cannot publish a confirmed selection', () => {
  for (const description of ['REGISTRATION: OTHER1', 'REGISTRATION: TEST4', 'Repair TEST42', 'REGISTRATION: TEST42\nREGISTRATION: OTHER1', 'REGISTRATION: TEST42 / OTHER1', 'REGISTRATION: TEST42\nREGISTRATION: UNKNOWN PLATE', '']) {
    const value = make();
    value.invoice.Reference = 'VZ SERVICE / REPAIRS';
    value.invoice.LineItems = [{ Description: description }];
    value.vehicles[0].registration = 'TEST42';
    value.confirmedJobId = id(6);
    assert.deepEqual(matchXeroInvoice(value), { status: 'needs_review', reason: 'invoice_vehicle_evidence_required' });
  }
});

test('registration labels handle case, Windows lines and repeated identical evidence conservatively', () => {
  assert.equal(xeroDescriptionRegistration({ LineItems: [{ Description: 'Registration : test42\r\nVIN # OTHER1' }, { Description: 'REGO: TEST42' }] }), 'TEST42');
  assert.equal(xeroDescriptionRegistration({ LineItems: [{ Description: 'REGISTRATION: TEST42' }, { Description: 'REG: OTHER1' }] }), null);
  assert.equal(xeroDescriptionRegistration({}), null);
});

test('description evidence does not establish a customer link or select a job automatically', () => {
  const value = make();
  value.invoice.Reference = 'VZ SERVICE';
  value.invoice.LineItems = [{ Description: 'REGISTRATION: TEST42' }];
  value.vehicles[0].registration = 'TEST42';
  assert.deepEqual(matchXeroInvoice(value), { status: 'needs_review', reason: 'exact_job_reference_required' });
  value.confirmedJobId = id(6);
  value.links = [];
  assert.deepEqual(matchXeroInvoice(value), { status: 'needs_review', reason: 'verified_customer_link_required' });
});
test('a confirmed queue job still rejects a different customer', () => {
  const value = make();
  value.invoice.Reference = 'VF BJS98 - REPAIRS';
  value.confirmedJobId = id(6);
  value.jobs[0].customer_id = id(9);
  assert.deepEqual(matchXeroInvoice(value), { status: 'needs_review', reason: 'job_customer_mismatch' });
});

test('Xero punctuation produces a deterministic safe PSI workshop reference', () => {
  const reference = xeroWorkshopJobReference('INV-1615', '1TX4SZ');
  assert.equal(reference, 'XERO INV-1615 - 1TX4SZ');
  assert.match(reference, /^[A-Z0-9][A-Z0-9 -]{2,79}$/u);
  assert.equal(xeroWorkshopJobReference('INV/1615', '1TX4SZ'), 'XERO INV 1615 - 1TX4SZ');
});

test('a single existing customer vehicle date job is reused for a Xero import', () => {
  const job = { id: id(6), reference: 'PSI-PHONE-20260924-309254C2' };
  assert.equal(selectReusableXeroWorkshopJob([job]), job);
  assert.equal(selectReusableXeroWorkshopJob([]), null);
});

test('multiple customer vehicle date jobs require review instead of guessing', () => {
  assert.throws(
    () => selectReusableXeroWorkshopJob([{ id: id(6) }, { id: id(7) }]),
    /More than one workshop job matches/u,
  );
});

test('the same verified job invoice is selected despite label formatting or date differences', () => {
  const invoice = { id: id(8), title: 'invoice_inv-1642' };
  assert.equal(invoiceIdentity('Xero invoice INV-1642'), 'INV1642');
  assert.equal(selectPublishedInvoiceByIdentity([invoice], 'INV-1642'), invoice);
  assert.equal(selectPublishedInvoiceByIdentity([invoice], 'INV-1643'), null);
  assert.equal(selectPublishedInvoiceByIdentity([invoice, { id: id(9), title: 'INV 1642' }], 'INV-1642'), null);
});
