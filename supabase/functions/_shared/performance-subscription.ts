import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { interpretPerformanceEntitlement } from './performance-entitlement.ts';

export const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
export const env = (name: string) => Deno.env.get(name)?.trim() ?? '';
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function adminClient() { return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } }); }

// Fetch provider truth; never grant access from SDK JSON or a webhook's claimed status.
export async function syncSubscription(customerId: string) {
  if (!uuid(customerId)) throw new Error('invalid_customer');
  const secret = env('REVENUECAT_SECRET_KEY');
  const products = env('PERFORMANCE_APPLE_PRODUCT_IDS').split(',').map(v => v.trim()).filter(Boolean);
  if (!secret || products.length !== 2) throw new Error('subscription_configuration_required');
  const startedAt = new Date().toISOString();
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(customerId)}`, { headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('provider_verification_unavailable');
  const body = await response.json();
  const verified = interpretPerformanceEntitlement(body.subscriber, customerId, products, env('PERFORMANCE_ALLOW_SANDBOX') === 'true');
  const admin = adminClient();
  const { data: customer, error: customerError } = await admin.from('customer_profiles').select('user_id,account_state').eq('user_id', customerId).maybeSingle();
  if (customerError || customer?.account_state !== 'active') throw new Error('customer_account_unavailable');
  const { error } = await admin.rpc('record_verified_performance_subscription', { p_customer_id: customerId, p_environment: verified.environment, p_status: verified.status, p_expires_at: verified.expires_at, p_auto_renews: verified.auto_renews, p_verified_at: startedAt });
  if (error) throw new Error('subscription_sync_failed');
  return { verified: true, status: verified.status };
}
