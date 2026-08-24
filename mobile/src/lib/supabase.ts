import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/lib/database.types';
import { supabaseAuthStorage } from '@/lib/supabase-auth-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
const requestedAuthActivation = process.env.EXPO_PUBLIC_SUPABASE_AUTH_ENABLED === 'true';
const requestedBookingActivation = process.env.EXPO_PUBLIC_SUPABASE_BOOKING_ENABLED === 'true';
const requestedRegistrationActivation = process.env.EXPO_PUBLIC_SUPABASE_REGISTRATION_ENABLED === 'true';

export const SUPABASE_CONNECTION = {
  configured: Boolean(supabaseUrl && supabasePublishableKey),
  authEnabled: Boolean(supabaseUrl && supabasePublishableKey && requestedAuthActivation),
  bookingEnabled: Boolean(
    supabaseUrl
    && supabasePublishableKey
    && requestedAuthActivation
    && requestedBookingActivation
  ),
  registrationEnabled: Boolean(
    supabaseUrl
    && supabasePublishableKey
    && requestedAuthActivation
    && requestedRegistrationActivation
  ),
  projectRef: 'lslhfrujyuqcavsnugfx',
  region: 'ap-southeast-2',
} as const;

let client: SupabaseClient<Database> | null = null;

export function getSupabaseClient() {
  if (!SUPABASE_CONNECTION.authEnabled) {
    throw new Error('CUSTOMER_AUTH_NOT_ENABLED');
  }

  client ??= createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: supabaseAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
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
