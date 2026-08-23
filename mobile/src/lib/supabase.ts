import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { supabaseAuthStorage } from '@/lib/supabase-auth-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
const requestedAuthActivation = process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED === 'true';

export const SUPABASE_CONNECTION = {
  configured: Boolean(supabaseUrl && supabasePublishableKey),
  authEnabled: Boolean(supabaseUrl && supabasePublishableKey && requestedAuthActivation),
  projectRef: 'lslhfrujyuqcavsnugfx',
  region: 'ap-southeast-2',
} as const;

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!SUPABASE_CONNECTION.authEnabled) {
    throw new Error('CUSTOMER_AUTH_NOT_ENABLED');
  }

  client ??= createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: supabaseAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  return client;
}

export function startSupabaseAuthLifecycle() {
  if (!SUPABASE_CONNECTION.authEnabled || Platform.OS === 'web') return () => undefined;

  const supabase = getSupabaseClient();
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();

  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}
