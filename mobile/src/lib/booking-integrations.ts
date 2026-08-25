import { getSupabaseClient, SUPABASE_CONNECTION } from '@/lib/supabase';

export async function dispatchBookingIntegrationNotifications(bookingId: string) {
  if (!SUPABASE_CONNECTION.authEnabled) return;

  const { error } = await getSupabaseClient().functions.invoke('process-booking-integrations', {
    body: { bookingId, limit: 10 },
  });
  if (error) throw error;
}
