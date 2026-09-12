import type { AccountDeletionRequestRow } from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export async function loadOwnAccountDeletionRequest(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', userId)
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
  if (data) return;

  // Treat an already-absent request as cancelled. This clears stale UI without
  // ever deleting a request that belongs to a different account.
  const remaining = await loadOwnAccountDeletionRequest(userId);
  if (remaining) throw new Error('The pending account-deletion request is still active.');
}
