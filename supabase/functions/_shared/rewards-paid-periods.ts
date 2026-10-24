import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';
import type { PerformanceStoreProducts } from './performance-entitlement.ts';

type ObjectMap = Record<string, unknown>;
const object = (value: unknown): ObjectMap => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectMap : {};
const time = (value: unknown) => typeof value === 'string' ? Date.parse(value) : NaN;
const iso = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? new Date(value).toISOString() : null;
export const evidenceHash = async (value: unknown) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(JSON.stringify(value)))), b => b.toString(16).padStart(2, '0')).join('');

// Called only after the existing RevenueCat Authorization check. Store minimal
// provider provenance, never customer SDK JSON, attributes, tokens or email.
export function rewardsProviderEvent(input: unknown) {
  const event = object(input);
  if (typeof event.id !== 'string' || !/^[\w.:-]{1,200}$/u.test(event.id)
    || typeof event.type !== 'string' || !iso(event.event_timestamp_ms)) throw new Error('invalid_rewards_provider_event');
  const fields = ['id','type','app_user_id','original_app_user_id','store','product_id','transaction_id',
    'original_transaction_id','environment','period_type','is_family_share','price_in_purchased_currency',
    'currency','purchased_at_ms','expiration_at_ms','event_timestamp_ms','cancel_reason','entitlement_ids'];
  return Object.fromEntries(fields.filter(key => event[key] !== undefined).map(key => [key,event[key]]));
}

// A fresh authenticated RevenueCat response binds the server webhook to this PSI
// identity and store. Purchase events provide the actual settled price and dates.
// Older events are valid provider history when the same original transaction is
// verifiable; unmatched/ambiguous history stays pending, never guessed.
export function verifyRewardsPaidEvent(input: unknown, subscriberValue: unknown, customer: string,
  products: PerformanceStoreProducts, now = Date.now(), verifiedLineages: ObjectMap[] = []) {
  const event = object(input), subscriber = object(subscriberValue);
  if (subscriber.original_app_user_id !== customer || event.app_user_id !== customer) return { state: 'review' as const, reason: 'rewards_paid_identity_review' };
  const store = event.store === 'APP_STORE' ? 'app_store' : event.store === 'PLAY_STORE' ? 'play_store' : '';
  const allowed = store === 'app_store' ? products.appStore : store === 'play_store' ? products.playStore : [];
  if (!allowed.includes(String(event.product_id)) || event.environment !== 'PRODUCTION' || event.is_family_share === true
    || !Array.isArray(event.entitlement_ids) || !event.entitlement_ids.includes('performance_plus')) return { state: 'excluded' as const };
  const restoration = event.type === 'REFUND_REVERSED';
  if (!['INITIAL_PURCHASE','RENEWAL','REFUND_REVERSED'].includes(String(event.type))) return { state: 'excluded' as const };
  if (!restoration && (!['NORMAL','INTRO','PREPAID','PROMOTIONAL'].includes(String(event.period_type))
    || typeof event.price_in_purchased_currency !== 'number' || !Number.isFinite(event.price_in_purchased_currency)
    || event.price_in_purchased_currency <= 0 || typeof event.currency !== 'string' || !/^[A-Z]{3}$/u.test(event.currency))) return { state: 'excluded' as const };
  const subscription = object(object(subscriber.subscriptions)[String(event.product_id)]);
  const startsAt = iso(event.purchased_at_ms), endsAt = iso(event.expiration_at_ms);
  if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt) || !iso(event.event_timestamp_ms)
    || Number(event.event_timestamp_ms) > now + 60_000 || typeof event.transaction_id !== 'string' || !event.transaction_id
    || event.transaction_id.length > 200 || subscription.store !== store || subscription.is_sandbox !== false
    || subscription.ownership_type !== 'PURCHASED') return { state: 'review' as const, reason: 'rewards_paid_evidence_review' };
  const snapshotStart = time(subscription.purchase_date), snapshotEnd = time(subscription.expires_date);
  const exact = snapshotStart === Date.parse(startsAt) && snapshotEnd === Date.parse(endsAt)
    && String(subscription.store_transaction_id) === event.transaction_id;
  const historical = typeof event.original_transaction_id === 'string' && event.original_transaction_id.length > 0
    && verifiedLineages.some(lineage => lineage.store === store && lineage.product_id === event.product_id
      && lineage.original_transaction_id === event.original_transaction_id) && snapshotStart >= Date.parse(endsAt);
  if (!exact && !historical) return { state: 'pending' as const, reason: 'rewards_paid_period_confirmation_pending' };
  // A refunded current period is not new qualifying proof. Existing awards are
  // handled prospectively by the separate revocation evidence below.
  if (subscription.refunded_at && exact) return restoration ? { state: 'pending' as const, reason: 'rewards_paid_restoration_pending' } : { state: 'excluded' as const };
  if (restoration && !exact) return { state: 'pending' as const, reason: 'rewards_paid_restoration_pending' };
  if (restoration) return { state: 'verified' as const, restore: true };
  return { state: 'verified' as const, period: { store, product_id: event.product_id, transaction_id: event.transaction_id,
    original_transaction_id: event.original_transaction_id ?? null, environment: 'production', ownership_type: 'PURCHASED',
    period_type: event.period_type, starts_at: startsAt, ends_at: endsAt,
    paid_amount: event.price_in_purchased_currency, paid_currency: event.currency } };
}

export async function reconcileRewardsPaidSnapshot(admin: SupabaseClient, subscriber: unknown, customer: string, products: PerformanceStoreProducts) {
  const snapshot = object(subscriber);
  if (snapshot.original_app_user_id !== customer) throw new Error('rewards_paid_identity_review');
  const pending = await admin.rpc('rewards_pending_provider_events', { p_customer_id: customer });
  if (pending.error) throw new Error('rewards_paid_verification_retry');
  const roots = await admin.rpc('rewards_paid_lineages', { p_customer_id: customer });
  if (roots.error) throw new Error('rewards_paid_verification_retry');
  const lineages: ObjectMap[] = Array.isArray(roots.data) ? roots.data : [];
  for (const row of pending.data ?? []) {
    const result = verifyRewardsPaidEvent(row.event, snapshot, customer, products, Date.now(), lineages);
    const saved = 'restore' in result && result.restore
      ? await admin.rpc('restore_rewards_paid_evidence', { p_customer_id: customer, p_event_id: row.id })
      : await admin.rpc('record_rewards_paid_evidence', { p_customer_id: customer, p_event_id: row.id,
        p_state: result.state, p_period: 'period' in result ? result.period : null,
        p_reason: 'reason' in result ? result.reason : null });
    if (saved.error) throw new Error('rewards_paid_verification_retry');
    if (result.state === 'verified' && result.period) lineages.push(result.period);
  }
  // Refreshes also observe membership refunds even without a new purchase event.
  // Auto renewal cancellation and ordinary expiry never invalidate past earning.
  const revoked = Object.entries(object(snapshot.subscriptions)).flatMap(([product, value]) => {
    const sub = object(value), refunded = time(sub.refunded_at), end = time(sub.expires_date);
    const allowed = sub.store === 'app_store' ? products.appStore : sub.store === 'play_store' ? products.playStore : [];
    if (!allowed.includes(product)) return [];
    const reason = Number.isFinite(refunded) ? 'refunded' : sub.ownership_type !== 'PURCHASED' || sub.is_sandbox !== false ? 'identity_review' : 'period_corrected';
    const effective = reason === 'refunded' ? refunded : reason === 'identity_review' ? Date.now() : end;
    return Number.isFinite(effective) ? [{ product_id: product, store: sub.store, transaction_id: sub.store_transaction_id ?? null,
      effective_at: new Date(effective).toISOString(), reason }] : [];
  });
  if (revoked.length) {
    const result = await admin.rpc('record_rewards_paid_revocations', { p_customer_id: customer, p_revocations: revoked });
    if (result.error) throw new Error('rewards_paid_verification_retry');
  }
}
