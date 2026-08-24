import type { User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { getSupabaseClient } from '@/lib/supabase';

export type CustomerAuthStatus = 'disabled' | 'loading' | 'signed_out' | 'signed_in';

type CustomerAuthContextValue = {
  error: string;
  sessionRevision: number;
  status: CustomerAuthStatus;
  user: User | null;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<CustomerAuthStatus>(CUSTOMER_AUTH.enabled ? 'loading' : 'disabled');
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [sessionRevision, setSessionRevision] = useState(0);

  useEffect(() => {
    if (!CUSTOMER_AUTH.enabled) return;

    let active = true;
    let authEventRevision = 0;
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      authEventRevision += 1;
      setSessionRevision((current) => current + 1);
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setStatus('signed_out');
        setError('');
        return;
      }
      setUser(session.user);
      setStatus('signed_in');
      setError('');
    });

    const initialReadRevision = authEventRevision;
    void supabase.auth.getUser().then(({ data, error: userError }) => {
      if (!active || authEventRevision !== initialReadRevision) return;
      setSessionRevision((current) => current + 1);
      if (userError || !data.user) {
        setUser(null);
        setStatus('signed_out');
        if (userError && userError.name !== 'AuthSessionMissingError') setError('Unable to restore this session. Please sign in again.');
        return;
      }
      setUser(data.user);
      setStatus('signed_in');
      setError('');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<CustomerAuthContextValue>(() => ({ error, sessionRevision, status, user }), [error, sessionRevision, status, user]);
  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}

export function useCustomerAuth() {
  const value = useContext(CustomerAuthContext);
  if (!value) throw new Error('useCustomerAuth must be used inside CustomerAuthProvider');
  return value;
}
