import type {
  BookingRequestRow,
  CustomerProfileRow,
  CustomerVehicleRow,
  StaffMemberRow,
} from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export type StaffPortalAccess =
  | { kind: 'access_denied' }
  | { kind: 'mfa_required'; staff: StaffMemberRow }
  | { kind: 'ready'; snapshot: StaffPortalSnapshot; staff: StaffMemberRow };

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

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw assuranceError;
  if (assurance.currentLevel !== 'aal2') return { kind: 'mfa_required', staff };

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
