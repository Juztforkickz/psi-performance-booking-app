type ProviderSubscription = {
  store?: string; is_sandbox?: boolean; ownership_type?: string; refunded_at?: string | null;
  grace_period_expires_date?: string | null; unsubscribe_detected_at?: string | null;
};
type ProviderSubscriber = {
  original_app_user_id?: string;
  entitlements?: Record<string, { product_identifier: string; expires_date?: string | null }>;
  subscriptions?: Record<string, ProviderSubscription>;
};

// Pure interpretation of an already authenticated provider response. Never call
// this with client-supplied receipt/SDK JSON to grant an entitlement.
export function interpretPerformanceEntitlement(subscriber: ProviderSubscriber, customerId: string, products: string[], allowSandbox: boolean, now = Date.now()) {
  if (!subscriber || subscriber.original_app_user_id !== customerId) throw new Error('subscription_account_review_required');
  const entitlement = subscriber.entitlements?.performance_plus;
  const subscription = entitlement ? subscriber.subscriptions?.[entitlement.product_identifier] : undefined;
  const allowed = !!entitlement && products.includes(entitlement.product_identifier) && subscription?.store === 'app_store'
    && subscription.ownership_type === 'PURCHASED' && typeof subscription.is_sandbox === 'boolean';
  const sandbox = subscription?.is_sandbox === true;
  if (allowed && sandbox && !allowSandbox) throw new Error('sandbox_subscription_not_allowed');
  const refunded = allowed && !!subscription.refunded_at;
  const ordinaryExpiry = allowed && !refunded ? Date.parse(entitlement.expires_date ?? '') : NaN;
  const graceExpiry = allowed && !refunded ? Date.parse(subscription.grace_period_expires_date ?? '') : NaN;
  const expiry = Number.isFinite(ordinaryExpiry) ? Math.max(ordinaryExpiry, Number.isFinite(graceExpiry) ? graceExpiry : 0) : 0;
  const status = refunded ? 'revoked' : expiry > now ? ordinaryExpiry > now ? 'active' : 'grace_period' : 'expired';
  return { environment: sandbox ? 'sandbox' : 'production', status, expires_at: new Date(expiry).toISOString(), auto_renews: allowed && !subscription.unsubscribe_detected_at && (status === 'active' || status === 'grace_period') };
}
