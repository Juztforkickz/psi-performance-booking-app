import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { loadRewardsAccount, type RewardsAccount } from '@/lib/rewards';

export function useRewardsAccount() {
  const auth = useCustomerAuth();
  const { account } = useCustomerAccount();
  const profile = account?.profile;
  const customerId = auth.status === 'signed_in' && profile?.account_state === 'active'
    && profile.user_id === auth.user?.id && !REVIEW_ENVIRONMENT.enabled ? auth.user.id : null;
  const [state, setState] = useState<{ userId: string; value: RewardsAccount } | null>(null);
  const [error, setError] = useState('');
  const [refreshIndex, setRefreshIndex] = useState(0);
  const refresh = useCallback(() => setRefreshIndex(index => index + 1), []);
  useEffect(() => {
    let active = true;
    let busy = false;
    const update = async () => {
      if (!customerId || busy) return;
      busy = true;
      try {
        const value = await loadRewardsAccount();
        if (active) { setState({ userId: customerId, value }); setError(''); }
      } catch {
        if (active) setError('Your rewards could not be refreshed. Please try again shortly.');
      } finally { busy = false; }
    };
    void update();
    const timer = customerId ? setInterval(() => { if (AppState.currentState === 'active') void update(); }, 60_000) : null;
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') void update(); });
    return () => { active = false; if (timer) clearInterval(timer); subscription.remove(); };
  }, [customerId, refreshIndex, auth.sessionRevision]);
  return { account: customerId && state?.userId === customerId ? state.value : null,
    error: customerId ? error : '', signedIn: Boolean(customerId), refresh };
}
