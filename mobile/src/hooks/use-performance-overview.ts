import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { loadVaultOverview, type VaultOverview } from '@/lib/performance-plus';
import { onPerformanceChanged } from '@/lib/performance-status';
import { getSupabaseClient } from '@/lib/supabase';

export function usePerformanceOverview(vehicleId?: string, revision = 0) {
  const auth = useCustomerAuth();
  const key = `${auth.user?.id}:${vehicleId ?? 'account'}`;
  const [state, setState] = useState<{ key: string; overview: VaultOverview; offset: number } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [error, setError] = useState('');
  const overview = state?.key === key && auth.status === 'signed_in' ? state.overview : null;
  const offset = state?.key === key ? state.offset : 0;
  useEffect(() => {
    if (!CUSTOMER_AUTH.enabled || auth.status !== 'signed_in' || !auth.user) return;
    let live = true;
    const started = Date.now();
    void loadVaultOverview(vehicleId).then(value => {
      const serverTime = Date.parse(value.server_time ?? '');
      if (live) {
        setState({ key, overview: value, offset: Number.isFinite(serverTime) ? serverTime - started : 0 });
        setClock(Date.now()); setError('');
      }
    }).catch(() => { if (live) setError('Subscription access could not be refreshed. Try again when online.'); });
    return () => { live = false; };
  }, [auth.status, auth.user, auth.sessionRevision, vehicleId, key, revision, refreshIndex]);
  useEffect(() => {
    const refresh = () => { setClock(Date.now()); setRefreshIndex(value => value + 1); };
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 30_000);
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    const removeListener = onPerformanceChanged(refresh);
    if (Platform.OS === 'web') window.addEventListener('focus', refresh);
    const userId = auth.user?.id;
    const channel = CUSTOMER_AUTH.enabled && userId ? getSupabaseClient().channel(`performance:${key}:${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'performance_subscriptions', filter: `customer_id=eq.${userId}` }, refresh).subscribe() : null;
    return () => {
      clearInterval(timer); subscription.remove(); removeListener();
      if (Platform.OS === 'web') window.removeEventListener('focus', refresh);
      if (channel) void getSupabaseClient().removeChannel(channel);
    };
  }, [auth.user?.id, key]);
  useEffect(() => {
    if (!overview?.expires_at || overview.is_permanent) return;
    const remaining = Date.parse(overview.expires_at) - Date.now() - offset;
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = setTimeout(() => { setClock(Date.now()); setRefreshIndex(value => value + 1); }, Math.min(remaining + 1, 2147483647));
    return () => clearTimeout(timer);
  }, [overview, offset]);
  return { overview, now: clock + offset, error, refresh: () => setRefreshIndex(value => value + 1) };
}
