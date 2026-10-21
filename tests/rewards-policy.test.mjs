import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = require('typescript');
const source = await readFile(new URL('../supabase/functions/_shared/rewards-policy.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Intl });
const { rewardsInvoiceSnapshot: snapshot } = exports;
const paid = overrides => ({ Type: 'ACCREC', Status: 'PAID', CurrencyCode: 'AUD', Total: 1000, AmountPaid: 1000, AmountDue: 0, AmountCredited: 0,
  FullyPaidOnDate: '/Date(1792540800000+0000)/', UpdatedDateUTC: '/Date(1792627200000+0000)/', ...overrides });
const start = '2026-10-01';

test('AUD 1,000 paid earns 1,000 points, worth exactly AUD 10', () => {
  const value = snapshot(paid(), start);
  assert.equal(value.earnedPoints, 1000);
  assert.equal(value.earnedPoints / 100, 10);
});
test('part payments and deposits do not earn an additional invoice reward', () => {
  assert.equal(snapshot(paid({ Status: 'AUTHORISED', AmountPaid: 100, AmountDue: 900 }), start).earnedPoints, 0);
  assert.equal(snapshot(paid({ AmountPaid: 1000 }), start).earnedPoints, 1000);
});
test('a verified deposit prepayment allocation counts once toward the final paid invoice', () => {
  assert.equal(snapshot(paid({ AmountPaid: 900, AmountCredited: 100, Prepayments: [{ AppliedAmount: 100 }] }), start).earnedPoints, 1000);
});
test('credit notes reduce eligible spend while cash overpayments remain paid spend', () => {
  assert.equal(snapshot(paid({ AmountPaid: 800, AmountCredited: 200, CreditNotes: [{ AppliedAmount: 100 }], Overpayments: [{ AppliedAmount: 100 }] }), start).earnedPoints, 900);
});
test('unexplained credited amounts cannot be mistaken for a cash deposit', () => {
  assert.throws(() => snapshot(paid({ AmountPaid: 900, AmountCredited: 100 }), start), /payment_totals_require_review/);
});
test('invoices paid before launch do not generate historical points', () => {
  assert.equal(snapshot(paid({ FullyPaidOnDate: '2026-09-30' }), start).earnedPoints, 0);
});
test('only whole paid AUD earn points and provider fees are not deducted', () => {
  assert.equal(snapshot(paid({ Total: 999.99, AmountPaid: 999.99 }), start).earnedPoints, 999);
});
test('voided or reopened invoices produce zero target points for an atomic reversal', () => {
  assert.equal(snapshot(paid({ Status: 'VOIDED' }), start).earnedPoints, 0);
  assert.equal(snapshot(paid({ Status: 'AUTHORISED', FullyPaidOnDate: undefined }), start).earnedPoints, 0);
});
test('wrong currency, missing money, inconsistent payment totals and future paid dates fail closed', () => {
  for (const override of [{ CurrencyCode: 'USD' }, { AmountPaid: null }, { AmountPaid: 999 }, { AmountDue: 1 }, { FullyPaidOnDate: '2099-01-01' }]) {
    assert.throws(() => snapshot(paid(override), start));
  }
});
test('supplier bills are excluded and source version is required for customer invoices', () => {
  assert.equal(snapshot(paid({ Type: 'ACCPAY' }), start).excluded, true);
  assert.throws(() => snapshot(paid({ UpdatedDateUTC: undefined }), start), /version_required/);
});
test('explicit rewards credit lines consume existing points while the net invoice earns points', () => {
  const value = snapshot(paid({ Total: 990, AmountPaid: 990, LineAmountTypes: 'Inclusive', LineItems: [{ Description: 'PSI Rewards credit', LineAmount: -10 }] }), start);
  assert.equal(value.redeemedPoints, 1000);
  assert.equal(value.earnedPoints, 990);
});
test('exclusive tax is included in redeemed credit exactly once', () => {
  assert.equal(snapshot(paid({ LineAmountTypes: 'Exclusive', LineItems: [{ Description: 'PSI Rewards credit', LineAmount: -10, TaxAmount: -1 }] }), start).redeemedPoints, 1100);
});
test('unrelated discounts cannot silently spend loyalty points', () => {
  assert.equal(snapshot(paid({ LineAmountTypes: 'Inclusive', LineItems: [{ Description: 'Courtesy discount', LineAmount: -10 }] }), start).redeemedPoints, 0);
});
test('invalid or positive rewards credit lines require review', () => {
  assert.throws(() => snapshot(paid({ LineAmountTypes: 'Inclusive', LineItems: [{ Description: 'PSI Rewards credit', LineAmount: 10 }] }), start), /credit_line_requires_review/);
});
