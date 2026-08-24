import type {
  BookingRequestRow,
  CustomerProfileRow,
  CustomerVehicleRow,
  StaffMemberRow,
} from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export type StaffPortalAccess =
  | { kind: 'access_denied' }
  | { kind: 'mfa_required'; staff: StaffMemberRow; verifiedTotpFactors: StaffMfaFactor[] }
  | { kind: 'ready'; snapshot: StaffPortalSnapshot; staff: StaffMemberRow; verifiedTotpFactors: StaffMfaFactor[] };

export type StaffMfaSecurityAccess =
  | { kind: 'access_denied' }
  | { kind: 'mfa_required' }
  | { kind: 'ready'; staff: StaffMemberRow; verifiedTotpFactors: StaffMfaFactor[] };

export type StaffMfaFactor = {
  createdAt: string;
  friendlyName: string;
  id: string;
};

export type StaffTotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

export type StaffPortalSnapshot = {
  bookings: BookingRequestRow[];
  customers: CustomerProfileRow[];
  vehicles: CustomerVehicleRow[];
};

export async function loadStaffPortalAccess(): Promise<StaffPortalAccess> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('STAFF_SESSION_REQUIRED');

  const { data: staff, error: staffError } = await supabase
    .from('staff_members')
    .select('*')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staff || staff.status !== 'active') return { kind: 'access_denied' };

  const [assuranceResult, factorsResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (assuranceResult.error) throw assuranceResult.error;
  if (factorsResult.error) throw factorsResult.error;
  const verifiedTotpFactors = mapVerifiedTotpFactors(factorsResult.data.totp);
  if (assuranceResult.data.currentLevel !== 'aal2') {
    return {
      kind: 'mfa_required',
      staff,
      verifiedTotpFactors,
    };
  }

  const [customersResult, vehiclesResult, bookingsResult] = await Promise.all([
    supabase.from('customer_profiles').select('*').eq('account_state', 'active').order('last_name').order('first_name'),
    supabase.from('customer_vehicles').select('*').is('archived_at', null).order('updated_at', { ascending: false }),
    supabase.from('booking_requests').select('*').is('archived_at', null).order('created_at', { ascending: false }).limit(50),
  ]);
  const firstError = customersResult.error ?? vehiclesResult.error ?? bookingsResult.error;
  if (firstError) throw firstError;

  return {
    kind: 'ready',
    staff,
    verifiedTotpFactors,
    snapshot: {
      bookings: bookingsResult.data ?? [],
      customers: customersResult.data ?? [],
      vehicles: vehiclesResult.data ?? [],
    },
  };
}

export async function loadStaffMfaSecurityAccess(): Promise<StaffMfaSecurityAccess> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('STAFF_SESSION_REQUIRED');

  const { data: staff, error: staffError } = await supabase
    .from('staff_members')
    .select('*')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staff || staff.status !== 'active') return { kind: 'access_denied' };

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw assuranceError;
  if (assurance.currentLevel !== 'aal2') return { kind: 'mfa_required' };

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;
  return {
    kind: 'ready',
    staff,
    verifiedTotpFactors: mapVerifiedTotpFactors(factors.totp),
  };
}

export async function beginStaffTotpEnrollment(friendlyName = 'PSI Performance staff'): Promise<StaffTotpEnrollment> {
  const supabase = getSupabaseClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;

  const staleTotpFactors = factors.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
  for (const factor of staleTotpFactors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw error;
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
    issuer: 'PSI Performance',
  });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyStaffTotp(factorId: string, code: string) {
  const normalizedCode = code.replace(/\s/gu, '');
  if (!/^\d{6}$/.test(normalizedCode)) throw new Error('INVALID_MFA_CODE');
  const { error } = await getSupabaseClient().auth.mfa.challengeAndVerify({
    code: normalizedCode,
    factorId,
  });
  if (error) throw error;
}

export async function cancelStaffTotpEnrollment(factorId: string) {
  const supabase = getSupabaseClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;
  const factor = factors.all.find((item) => item.id === factorId && item.factor_type === 'totp');
  if (!factor || factor.status !== 'unverified') return;
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

export async function removeStaffTotpFactor(factorId: string) {
  const supabase = getSupabaseClient();
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');
  if (!access.verifiedTotpFactors.some((factor) => factor.id === factorId)) throw new Error('STAFF_MFA_FACTOR_NOT_FOUND');
  if (access.verifiedTotpFactors.length < 2) throw new Error('STAFF_LAST_MFA_FACTOR');

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    await supabase.auth.signOut({ scope: 'local' });
    return { requiresSignIn: true } as const;
  }
  return { requiresSignIn: false } as const;
}

function mapVerifiedTotpFactors(factors: { created_at: string; friendly_name?: string; id: string }[]) {
  return factors.map((factor) => ({
    createdAt: factor.created_at,
    friendlyName: factor.friendly_name ?? 'PSI staff authenticator',
    id: factor.id,
  }));
}
