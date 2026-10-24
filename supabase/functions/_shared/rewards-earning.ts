import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';
import { env } from './xero-runtime.ts';

export type RewardsEarning = {
  multiplier: 1 | 2; state: 'standard' | 'double' | 'unavailable';
  subscriptionStatus: 'free' | 'trial' | 'active' | 'expired' | 'permanent' | 'unavailable';
  bonusEnabled: boolean; validUntil: string | null; subscriptionExpiresAt: string | null;
  verifiedAt: string | null; serverTime: string;
  complimentaryDouble?: boolean;
};
export const standardRewardsEarning = (): RewardsEarning => ({ multiplier: 1, state: 'unavailable',
  subscriptionStatus: 'unavailable', bonusEnabled: false, validUntil: null, subscriptionExpiresAt: null,
  verifiedAt: null, serverTime: new Date().toISOString() });

// Service-only RPC reads backend verified RevenueCat period evidence and the financial
// policy activation gate. No customer JSON, profile flag or SDK receipt can grant 2x.
export async function rewardsEarningFor(admin: SupabaseClient, customerId: string): Promise<RewardsEarning> {
  try {
    const { data, error } = await admin.rpc('rewards_earning_status', { p_customer_id: customerId });
    if (error || !data || data.customer_id !== customerId) return standardRewardsEarning();
    const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
    const serverTime = date(data.server_time);
    if (!serverTime) return standardRewardsEarning();
    const status = ['free', 'trial', 'active', 'expired', 'permanent'].includes(data.subscription_status)
      ? data.subscription_status as RewardsEarning['subscriptionStatus'] : 'unavailable';
    const productConfig = data.store === 'app_store' ? env('PERFORMANCE_APPLE_PRODUCT_IDS')
      : data.store === 'play_store' ? env('PERFORMANCE_GOOGLE_PRODUCT_IDS') : '';
    const validUntil = date(data.valid_until);
    const verifiedAt = date(data.verified_at);
    const complimentaryDouble = data.complimentary_double_verified === true && status === 'permanent';
    const double = data.multiplier === 2 && data.bonus_enabled === true && data.environment === 'production'
      && !!verifiedAt && Date.parse(verifiedAt) <= Date.parse(serverTime)
      && (complimentaryDouble && (!validUntil || Date.parse(validUntil) > Date.parse(serverTime))
        || data.paid_period_verified === true && status === 'active'
          && productConfig.split(',').map(value => value.trim()).filter(Boolean).includes(data.product_id)
          && !!validUntil && Date.parse(validUntil) > Date.parse(serverTime));
    return { multiplier: double ? 2 : 1, state: status === 'unavailable' ? 'unavailable' : double ? 'double' : 'standard',
      subscriptionStatus: status, bonusEnabled: data.bonus_enabled === true,
      validUntil: double ? validUntil : null, subscriptionExpiresAt: date(data.subscription_expires_at),
      verifiedAt, serverTime, complimentaryDouble: double && complimentaryDouble };
  } catch { return standardRewardsEarning(); }
}

export const rewardsEarningFingerprint = (earning: RewardsEarning) =>
  JSON.stringify([earning.multiplier, earning.state, earning.subscriptionStatus, earning.bonusEnabled,
    earning.validUntil, earning.subscriptionExpiresAt]);
