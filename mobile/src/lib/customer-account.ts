import type { User } from '@supabase/supabase-js';

import type { CustomerProfileRow, CustomerVehicleRow } from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export type CustomerAccountSnapshot = {
  profile: CustomerProfileRow | null;
  user: User;
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
  const [profileResult, vehiclesResult] = await Promise.all([
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
  ]);

  if (profileResult.error) throw profileResult.error;
  if (vehiclesResult.error) throw vehiclesResult.error;

  return {
    profile: profileResult.data,
    user,
    vehicles: vehiclesResult.data ?? [],
  };
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

export async function saveCustomerVehicle(input: CustomerVehicleInput) {
  const supabase = getSupabaseClient();
  const user = await getVerifiedCustomer();
  const registration = input.registration.trim().toUpperCase();

  const { data: existing, error: existingError } = await supabase
    .from('customer_vehicles')
    .select('*')
      .eq('customer_id', user.id)
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

