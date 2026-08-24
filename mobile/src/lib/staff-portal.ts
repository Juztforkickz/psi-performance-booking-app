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
  | { kind: 'ready'; snapshot: StaffPortalSnapshot; staff: StaffMemberRow };

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
    .rpc('current_staff_access')
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staff || staff.status !== 'active') return { kind: 'access_denied' };

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw assuranceError;
  if (assurance.currentLevel !== 'aal2') {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    return {
      kind: 'mfa_required',
      staff,
      verifiedTotpFactors: factors.totp.map((factor) => ({
        createdAt: factor.created_at,
        friendlyName: factor.friendly_name ?? 'PSI staff authenticator',
        id: factor.id,
      })),
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
    snapshot: {
      bookings: bookingsResult.data ?? [],
      customers: customersResult.data ?? [],
      vehicles: vehiclesResult.data ?? [],
    },
  };
}

export async function beginStaffTotpEnrollment(): Promise<StaffTotpEnrollment> {
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
    friendlyName: 'PSI Performance staff',
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
