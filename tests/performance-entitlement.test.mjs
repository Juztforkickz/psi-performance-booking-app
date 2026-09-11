import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretPerformanceEntitlement as interpret } from '../supabase/functions/_shared/performance-entitlement.ts';

const now = Date.parse('2026-09-09T00:00:00Z');
const products = { appStore: ['plus.monthly', 'plus.annual'], playStore: ['plus.monthly:monthly-autorenewing', 'plus.annual:annual-autorenewing'] };
const make = (store = 'app_store', product = products.appStore[0]) => ({ original_app_user_id: 'customer-a', entitlements: { performance_plus: { product_identifier: product, expires_date: '2026-10-09T00:00:00Z' } }, subscriptions: { [product]: { store, is_sandbox: false, ownership_type: 'PURCHASED', refunded_at: null, unsubscribe_detected_at: null, grace_period_expires_date: null } } });
const check = (value, sandbox = false) => interpret(value, 'customer-a', products, sandbox, now);

test('verified monthly purchase and renewal retain timed access', () => {
  const value = check(make());
  assert.equal(value.status, 'active');
  assert.equal(value.environment, 'production');
  assert.equal(value.auto_renews, true);
  assert.equal(value.expires_at, '2026-10-09T00:00:00.000Z');
});
test('cancellation keeps paid access until expiry', () => {
  const value = make(); value.subscriptions[products.appStore[0]].unsubscribe_detected_at = '2026-09-08T00:00:00Z';
  assert.equal(check(value).status, 'active'); assert.equal(check(value).auto_renews, false);
  value.entitlements.performance_plus.expires_date = '2026-09-08T00:00:00Z';
  assert.equal(check(value).status, 'expired');
});
test('verified billing grace lasts only through provider grace expiry', () => {
  const value = make(); value.entitlements.performance_plus.expires_date = '2026-09-08T00:00:00Z';
  value.subscriptions[products.appStore[0]].grace_period_expires_date = '2026-09-10T00:00:00Z';
  assert.equal(check(value).status, 'grace_period');
  value.subscriptions[products.appStore[0]].grace_period_expires_date = '2026-09-08T12:00:00Z';
  assert.equal(check(value).status, 'expired');
});
test('refund revokes even when a stale future expiry exists', () => {
  const value = make(); value.subscriptions[products.appStore[0]].refunded_at = '2026-09-08T00:00:00Z';
  assert.equal(check(value).status, 'revoked'); assert.equal(check(value).auto_renews, false);
});
test('sandbox cannot grant production entitlement', () => {
  const value = make(); value.subscriptions[products.appStore[0]].is_sandbox = true;
  assert.throws(() => check(value), /sandbox_subscription_not_allowed/);
  assert.equal(check(value, true).environment, 'sandbox');
});
test('different original account requires review', () => {
  const value = make(); value.original_app_user_id = 'customer-b';
  assert.throws(() => check(value), /account_review_required/);
});
test('verified Google Play purchase unlocks only its matching configured product', () => {
  const product = products.playStore[0];
  const value = check(make('play_store', product));
  assert.equal(value.status, 'active');
  assert.equal(value.environment, 'production');
});
test('unknown products, mismatched stores and shared receipts do not unlock', () => {
  const unknown = make(); unknown.entitlements.performance_plus.product_identifier = 'other.product';
  assert.equal(check(unknown).status, 'expired');
  for (const store of ['stripe', 'promotional']) {
    const value = make(); value.subscriptions[products.appStore[0]].store = store;
    assert.equal(check(value).status, 'expired');
  }
  assert.equal(check(make('play_store', products.appStore[0])).status, 'expired');
  const shared = make(); shared.subscriptions[products.appStore[0]].ownership_type = 'FAMILY_SHARED';
  assert.equal(check(shared).status, 'expired');
});
test('missing entitlement, invalid expiry and unknown environment fail closed', () => {
  assert.equal(check({ original_app_user_id: 'customer-a' }).status, 'expired');
  const invalid = make(); invalid.entitlements.performance_plus.expires_date = 'not a date';
  assert.equal(check(invalid).status, 'expired');
  const environment = make(); delete environment.subscriptions[products.appStore[0]].is_sandbox;
  assert.equal(check(environment).status, 'expired');
});
