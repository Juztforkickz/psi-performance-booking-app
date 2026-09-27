import assert from 'node:assert/strict';
import test from 'node:test';
import { isVisibleStaffCustomer } from '../mobile/src/lib/staff-customer-visibility.ts';
import { xeroImportFailureMessage } from '../mobile/src/lib/xero-import-feedback.ts';

test('only the two requested registration tests are hidden', () => {
  for (const email of ['info+public-registration-20260925-1234@psiperformance.com.au', 'INFO+REGISTRATION-CHECK-3E09A0C@PSIPERFORMANCE.COM.AU ']) {
    assert.equal(isVisibleStaffCustomer({ email }), false);
  }
  for (const email of ['matt@psiperformance.com.au', 'info@psiperformance.com.au', 'info+registration-check-other@psiperformance.com.au', 'buddeah@hotmail.com', null]) {
    assert.equal(isVisibleStaffCustomer({ email }), true);
  }
});

test('Xero feedback distinguishes a saved match from a failed confirmation', () => {
  assert.match(xeroImportFailureMessage(new Error('network failure'), true), /match was saved/);
  assert.match(xeroImportFailureMessage({ message: 'owner_aal2_required' }, false), /owner security/);
  assert.match(xeroImportFailureMessage({ message: 'xero_customer_vehicle_job_mismatch' }, false), /does not match/);
  assert.match(xeroImportFailureMessage({ message: 'xero_import_not_reviewable' }, false), /another stage/);
  const backend = xeroImportFailureMessage({ message: 'column reference tenant_id is ambiguous' }, false);
  assert.match(backend, /system error/);
  assert.doesNotMatch(backend, /tenant_id|Nothing was published|registration/);
});
