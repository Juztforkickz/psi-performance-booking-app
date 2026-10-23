import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { loadRewardsAccount, type RewardsAccount } from '@/lib/rewards';
import { onPerformanceChanged } from '@/lib/performance-status';
import { rewardsEarningAt } from '@/lib/rewards-earning';
import { getSupabaseClient } from '@/lib/supabase';

export function useRewardsAccount() {
  const auth = useCustomerAuth();
  const { account } = useCustomerAccount();
  const profile = account?.profile;
  const customerId = auth.status === 'signed_in' && profile?.account_state === 'active'
    && profile.user_id === auth.user?.id && !REVIEW_ENVIRONMENT.enabled ? auth.user.id : null;
  const [state, setState] = useState<{ userId: string; value: RewardsAccount; offset: number } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const refresh = useCallback(() => setRefreshIndex(index => index + 1), []);
  useEffect(() => {
    let active = true;
    let busy = false;
    const update = async () => {
      if (!customerId || busy) return;
      busy = true;
      const startedAt = Date.now();
      try {
        const value = await loadRewardsAccount();
        const serverTime = Date.parse(value.earning.serverTime ?? '');
        if (active) {
          setState({ userId: customerId, value, offset: Number.isFinite(serverTime) ? serverTime - startedAt : 0 });
          setClock(Date.now()); setError('');
        }
      } catch {
        if (active) setError('Your rewards could not be refreshed. Please try again shortly.');
      } finally { busy = false; }
    };
    void update();
    const resume = () => { setClock(Date.now()); void update(); };
    const timer = customerId ? setInterval(() => { if (AppState.currentState === 'active') resume(); }, 60_000) : null;
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') resume(); });
    const removePerformanceListener = onPerformanceChanged(resume);
    if (Platform.OS === 'web') window.addEventListener('focus', resume);
    const client = customerId ? getSupabaseClient() : null;
    const channel = client?.channel(`rewards:${customerId}:${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_subscriptions', filter: `customer_id=eq.${customerId}` }, resume)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards_accounts', filter: `customer_id=eq.${customerId}` }, resume).subscribe();
    return () => {
      active = false; if (timer) clearInterval(timer); subscription.remove(); removePerformanceListener();
      if (Platform.OS === 'web') window.removeEventListener('focus', resume);
      if (channel) void client?.removeChannel(channel);
    };
  }, [customerId, refreshIndex, auth.sessionRevision]);
  const value = customerId && state?.userId === customerId ? state.value : null;
  const offset = value ? state?.offset ?? 0 : 0;
  useEffect(() => {
    if (!value) return;
    const deadlines = [value.earning.validUntil, value.earning.subscriptionExpiresAt,
      value.earning.multiplier === 2 && value.earning.serverTime ? new Date(Date.parse(value.earning.serverTime) + 5 * 60_000).toISOString() : null]
      .filter((item): item is string => !!item).map(item => Date.parse(item) - offset - Date.now()).filter(item => item > 0);
    if (!deadlines.length) return;
    const timer = setTimeout(() => { setClock(Date.now()); refresh(); }, Math.min(Math.min(...deadlines) + 1, 2147483647));
    return () => clearTimeout(timer);
  }, [value, offset, refresh]);
  return { account: value ? { ...value, earning: rewardsEarningAt(value.earning, clock + offset) } : null,
    error: customerId ? error : '', signedIn: Boolean(customerId), refresh };
}
