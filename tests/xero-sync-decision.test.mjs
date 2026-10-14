import test from 'node:test';
import assert from 'node:assert/strict';
import { waitingInvoiceRefreshReason, reviewNotificationRequired } from '../supabase/functions/_shared/xero-sync-decision.ts';

const before = { tenantId:'tenant', invoiceId:'invoice', contactId:'contact', reference:'SERVICE ABC123', invoiceNumber:'INV-123', invoiceDate:'2026-10-14', currency:'AUD', invoiceStatus:'AUTHORISED', amountDueCents:10000, amountPaidCents:0 };
test('a payment-only update keeps the waiting decision', () => {
  assert.equal(waitingInvoiceRefreshReason(before, { ...before, invoiceStatus:'PAID', amountDueCents:0, amountPaidCents:10000 }), null);
});
for (const field of ['tenantId','invoiceId','contactId','reference','invoiceNumber','invoiceDate','currency']) {
  test(`changed ${field} requires waiting review`, () => assert.equal(waitingInvoiceRefreshReason(before, { ...before, [field]:'changed' }), 'waiting_invoice_identity_changed'));
}
test('voiding an invoice requires review without changing payment records', () => assert.equal(waitingInvoiceRefreshReason(before, { ...before, invoiceStatus:'VOIDED' }), 'invoice_status_requires_review'));
test('identical repeated review does not alert again', () => assert.equal(reviewNotificationRequired('needs_review','verified_customer_link_required','verified_customer_link_required'), false));
test('a new ownership problem can alert once', () => assert.equal(reviewNotificationRequired('imported',null,'vehicle_ownership_requires_review'), true));
