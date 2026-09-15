import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

export type CustomerVehicleNote = {
  id: string; customer_id: string; vehicle_id: string; body: string; created_at: string;
};
type NotesDatabase = { public: { Tables: { customer_vehicle_notes: {
  Row: CustomerVehicleNote;
  Insert: { customer_id: string; vehicle_id: string; body: string };
  Update: Record<never, never>; Relationships: [];
} }; Views: Record<never, never>; Functions: Record<never, never>;
Enums: Record<never, never>; CompositeTypes: Record<never, never> } };
function client() { return getSupabaseClient() as unknown as SupabaseClient<NotesDatabase>; }

export async function loadCustomerVehicleNotes(vehicleId: string) {
  const { data, error } = await client().from('customer_vehicle_notes').select('*')
    .eq('vehicle_id', vehicleId).order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addCustomerVehicleNote(vehicleId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 4000) throw new Error('Write a note of up to 4,000 characters.');
  const { data: auth, error: authError } = await getSupabaseClient().auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in again to save your note.');
  const { data, error } = await client().from('customer_vehicle_notes')
    .insert({ customer_id: auth.user.id, vehicle_id: vehicleId, body: trimmed }).select('*').single();
  if (error) throw new Error('Your note could not be saved. Please try again.');
  return data;
}
