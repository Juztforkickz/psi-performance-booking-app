import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';

import {
  loadCustomerAccount,
  type CustomerAccountSnapshot,
} from '@/lib/customer-account';
import { useCustomerAuth } from '@/lib/customer-auth-context';

type CustomerAccountStatus = 'error' | 'loading' | 'ready' | 'signed_out';

type LoadedAccountState = {
  account: CustomerAccountSnapshot | null;
  error: string;
  status: 'error' | 'ready';
  userId: string;
};

type CustomerAccountContextValue = {
  account: CustomerAccountSnapshot | null;
  error: string;
  refreshAccount: () => void;
  status: CustomerAccountStatus;
};

const CustomerAccountContext = createContext<CustomerAccountContextValue | null>(null);

export function CustomerAccountProvider({ children }: PropsWithChildren) {
  const auth = useCustomerAuth();
  const authStatus = auth.status;
  const authUserId = auth.user?.id;
  const authSessionRevision = auth.sessionRevision;
  const [loadedState, setLoadedState] = useState<LoadedAccountState | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const refreshAccount = useCallback(() => {
    setRefreshIndex((current) => current + 1);
  }, []);

  useEffect(() => {
    if (authStatus !== 'signed_in' || !authUserId) return;
    let active = true;
    let busy = false;
    const refreshSummaries = async () => {
      if (busy || AppState.currentState !== 'active') return;
      busy = true;
      try {
        const { data, error } = await getSupabaseClient().from('vehicle_service_summary').select('*').eq('customer_id', authUserId);
        if (active && !error && data) setLoadedState(current => current?.userId === authUserId && current.account
          ? { ...current, account: { ...current.account, serviceSummaries: data } } : current);
      } catch { /* Keep the last verified reading during an interrupted connection. */ }
      finally { busy = false; }
    };
    const timer = setInterval(() => { void refreshSummaries(); }, 60_000);
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void refreshSummaries(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [authStatus, authUserId, authSessionRevision]);

  useEffect(() => {
    if (authStatus !== 'signed_in' || !authUserId) return;

    let active = true;
    const userId = authUserId;

    void loadCustomerAccount()
      .then((snapshot) => {
        if (!active || snapshot.user.id !== userId) return;
        setLoadedState({ account: snapshot, error: '', status: 'ready', userId });
      })
      .catch(() => {
        if (!active) return;
        setLoadedState({
          account: null,
          error: 'Your secure account records could not be loaded. Please try again.',
          status: 'error',
          userId,
        });
      });

    return () => {
      active = false;
    };
  }, [authSessionRevision, authStatus, authUserId, refreshIndex]);

  const value = useMemo<CustomerAccountContextValue>(() => {
    if (auth.status !== 'signed_in' || !auth.user) {
      return { account: null, error: '', refreshAccount, status: 'signed_out' };
    }
    if (!loadedState || loadedState.userId !== auth.user.id) {
      return { account: null, error: '', refreshAccount, status: 'loading' };
    }
    return {
      account: loadedState.account,
      error: loadedState.error,
      refreshAccount,
      status: loadedState.status,
    };
  }, [auth.status, auth.user, loadedState, refreshAccount]);

  return <CustomerAccountContext.Provider value={value}>{children}</CustomerAccountContext.Provider>;
}

export function useCustomerAccount() {
  const value = useContext(CustomerAccountContext);
  if (!value) throw new Error('useCustomerAccount must be used inside CustomerAccountProvider');
  return value;
}
