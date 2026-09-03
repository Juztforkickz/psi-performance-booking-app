import { getSupabaseClient, SUPABASE_CONNECTION } from '@/lib/supabase';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';

export const EMAIL_CODE_RESEND_COOLDOWN_SECONDS = 60;

export const CUSTOMER_AUTH = {
  provider: 'supabase',
  method: 'passwordless_email_code',
  enabled: SUPABASE_CONNECTION.authEnabled,
  registrationEnabled: SUPABASE_CONNECTION.registrationEnabled,
  passwordStorage: 'none',
} as const;

export async function requestPasswordlessEmailCode(email: string) {
  if (REVIEW_ENVIRONMENT.enabled) throw new Error('USE_REVIEW_APP_PASSWORD');
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error('INVALID_EMAIL');
  }

  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: CUSTOMER_AUTH.registrationEnabled },
  });

  if (error) throw error;
}

export async function verifyPasswordlessEmailCode(email: string, token: string) {
  if (REVIEW_ENVIRONMENT.enabled) throw new Error('USE_REVIEW_APP_PASSWORD');
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.replace(/\s/gu, '');
  if (!/^\d{6}$/.test(normalizedToken)) {
    throw new Error('INVALID_EMAIL_CODE');
  }

  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: 'email',
  });

  if (error) throw error;
  if (!data.session) throw new Error('CUSTOMER_SESSION_NOT_CREATED');
  return data.session;
}

export async function signOutCustomer() {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}
