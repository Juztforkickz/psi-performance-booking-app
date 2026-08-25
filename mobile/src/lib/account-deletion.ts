import type { AccountDeletionRequestRow } from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export async function loadOwnAccountDeletionRequest() {
  const { data, error } = await getSupabaseClient()
    .from('account_deletion_requests')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function requestOwnAccountDeletion(userId: string): Promise<AccountDeletionRequestRow> {
  const { data, error } = await getSupabaseClient()
    .from('account_deletion_requests')
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function cancelOwnAccountDeletionRequest(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('account_deletion_requests')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'requested')
    .select('user_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No pending account-deletion request was found.');
}
