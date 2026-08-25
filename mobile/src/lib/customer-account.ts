import type { User } from '@supabase/supabase-js';

import type {
  BookingRequestRow,
  CustomerProfileRow,
  CustomerVehicleRow,
  VehicleFileRow,
  VehicleServiceSummaryRow,
} from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export type CustomerAccountSnapshot = {
  bookings: BookingRequestRow[];
  profile: CustomerProfileRow | null;
  serviceSummaries: VehicleServiceSummaryRow[];
  user: User;
  vehicleFiles: VehicleFileRow[];
  vehicles: CustomerVehicleRow[];
};

export type CustomerProfileInput = {
  firstName: string;
  lastName: string;
  mobile: string;
};

export type CustomerVehicleInput = {
  make: string;
  model: string;
  registration: string;
  year: number;
};

async function getVerifiedCustomer() {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error || !data.user?.email) throw error ?? new Error('CUSTOMER_SESSION_REQUIRED');
  return data.user;
}

export async function loadCustomerAccount(): Promise<CustomerAccountSnapshot> {
  const supabase = getSupabaseClient();
  const user = await getVerifiedCustomer();
  const readAccount = () => Promise.all([
    supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('customer_vehicles')
      .select('*')
      .eq('customer_id', user.id)
      .is('archived_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('vehicle_service_summary')
      .select('*')
      .eq('customer_id', user.id),
    supabase
      .from('booking_requests')
      .select('*')
      .eq('customer_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('vehicle_files')
      .select('*')
      .eq('customer_id', user.id)
      .eq('file_kind', 'vehicle_photo')
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
  ]);

  let results = await readAccount();
  if (results.some((result) => result.status === 401)) {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session) results = await readAccount();
  }

  const [profileResult, vehiclesResult, serviceSummariesResult, bookingsResult, vehicleFilesResult] = results;

  if (profileResult.error) throw profileResult.error;
  if (vehiclesResult.error) throw vehiclesResult.error;
  if (serviceSummariesResult.error) throw serviceSummariesResult.error;
  if (bookingsResult.error) throw bookingsResult.error;
  if (vehicleFilesResult.error) throw vehicleFilesResult.error;

  return {
    bookings: bookingsResult.data ?? [],
    profile: profileResult.data,
    serviceSummaries: serviceSummariesResult.data ?? [],
    user,
    vehicleFiles: vehicleFilesResult.data ?? [],
    vehicles: vehiclesResult.data ?? [],
  };
}

export async function saveCustomerOdometer(vehicleId: string, readingKm: number) {
  if (!Number.isInteger(readingKm) || readingKm < 0 || readingKm > 9_999_999) {
    throw new Error('INVALID_ODOMETER_READING');
  }

  const supabase = getSupabaseClient();
  const user = await getVerifiedCustomer();
  const { data, error } = await supabase
    .from('odometer_readings')
    .insert({
      created_by: user.id,
      customer_id: user.id,
      reading_km: readingKm,
      record_source: 'customer_entry',
      service_completion_id: null,
      vehicle_id: vehicleId,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function saveCustomerProfile(input: CustomerProfileInput) {
  const supabase = getSupabaseClient();
  const user = await getVerifiedCustomer();
  const email = user.email?.trim().toLowerCase();
  if (!email) throw new Error('VERIFIED_EMAIL_REQUIRED');

  const { data, error } = await supabase
    .from('customer_profiles')
    .upsert({
      user_id: user.id,
      email,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      mobile: input.mobile.trim(),
    }, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function saveCustomerVehicle(input: CustomerVehicleInput, vehicleId?: string) {
  const supabase = getSupabaseClient();
  const user = await getVerifiedCustomer();
  const registration = input.registration.trim().toUpperCase();

  if (vehicleId) {
    const { data, error } = await supabase
      .from('customer_vehicles')
      .update({
        make: input.make.trim(),
        model: input.model.trim(),
        registration,
        year: input.year,
      })
      .eq('id', vehicleId)
      .eq('customer_id', user.id)
      .is('archived_at', null)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data: existing, error: existingError } = await supabase
    .from('customer_vehicles')
    .select('*')
    .eq('customer_id', user.id)
    .eq('registration', registration)
    .is('archived_at', null)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { data, error } = await supabase
      .from('customer_vehicles')
      .update({
        make: input.make.trim(),
        model: input.model.trim(),
        registration,
        year: input.year,
      })
      .eq('id', existing.id)
      .eq('customer_id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { count, error: countError } = await supabase
    .from('customer_vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', user.id)
    .is('archived_at', null);

  if (countError) throw countError;

  const { data, error } = await supabase
    .from('customer_vehicles')
    .insert({
      customer_id: user.id,
      created_by: user.id,
      registration,
      year: input.year,
      make: input.make.trim(),
      model: input.model.trim(),
      is_primary: (count ?? 0) === 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
