import assert from 'node:assert/strict';
import test from 'node:test';
import { xeroInvoiceReader } from '../supabase/functions/_shared/xero-invoice-fetch.ts';
const tenant = '10000000-0000-4000-8000-000000000001';
const invoice = '10000000-0000-4000-8000-000000000002';
const json = value => Response.json(value);
test('fixed official endpoint, tenant header, read-only method and redirects denied', async () => {
  const reader = xeroInvoiceReader('test-token', tenant, async (url, options) => {
    assert.equal(url, `https://api.xero.com/api.xro/2.0/Invoices/${invoice}`);
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['xero-tenant-id'], tenant);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return json({ Invoices: [{ InvoiceID: invoice }] });
  });
  assert.equal((await reader.invoice(invoice)).InvoiceID, invoice);
});
test('webhook URLs and arbitrary paths cannot become request destinations', async () => {
  let calls = 0;
  const reader = xeroInvoiceReader('test-token', tenant, async () => { calls++; return json({}); });
  for (const id of ['https://example.com', '../Invoices', '', `${invoice}?redirect=other`]) await assert.rejects(reader.invoice(id), /invalid_invoice_id/);
  assert.equal(calls, 0);
});
for (const [status, error] of [[401, 'reauthorisation'], [403, 'permission'], [404, 'review_required'], [429, 'retry_later'], [500, 'temporarily_unavailable']]) {
  test(`HTTP ${status} is actionable and provider error content stays private`, async () => {
    const reader = xeroInvoiceReader('test-token', tenant, async () => new Response('private-account-data', { status }));
    await assert.rejects(reader.invoice(invoice), e => e.message.includes(error) && !e.message.includes('private-account-data'));
  });
}
test('ambiguous or wrong invoice response cannot be used', async () => {
  for (const Invoices of [[], [{ InvoiceID: tenant }], [{ InvoiceID: invoice }, { InvoiceID: invoice }]]) {
    await assert.rejects(xeroInvoiceReader('test-token', tenant, async () => json({ Invoices })).invoice(invoice), /identity_mismatch/);
  }
});
test('PDF bytes are preserved', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.7\noriginal report\n%%EOF');
  const result = await xeroInvoiceReader('test-token', tenant, async () => new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } })).pdf(invoice);
  assert.deepEqual(result, bytes);
});
test('HTML login pages and fake PDFs are rejected', async () => {
  await assert.rejects(xeroInvoiceReader('test-token', tenant, async () => new Response('<html>', { headers: { 'Content-Type': 'text/html' } })).pdf(invoice), /unexpected_file_type/);
  await assert.rejects(xeroInvoiceReader('test-token', tenant, async () => new Response('not pdf', { headers: { 'Content-Type': 'application/pdf' } })).pdf(invoice), /invalid_pdf/);
});
test('oversized streaming responses are bounded without Content-Length', async () => {
  const reader = xeroInvoiceReader('test-token', tenant, async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }));
  await assert.rejects(reader.invoice(invoice), /response_too_large/);
});
