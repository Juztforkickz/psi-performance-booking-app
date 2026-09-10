import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

export const PERFORMANCE_PRICING = Object.freeze({ monthly: 999, annual: 9900, currency: 'AUD' });
export const VAULT_KINDS = ['invoice', 'media', 'dyno', 'service', 'document', 'modification'] as const;
export type VaultKind = typeof VAULT_KINDS[number];
export const VAULT_LABELS: Record<VaultKind, string> = { invoice: 'Invoice Vault', media: 'Media Vault', dyno: 'Dyno Vault', service: 'Service history', document: 'Documents', modification: 'Build history' };
export type VaultRecord = {
  id: string; customer_id: string; vehicle_id: string; job_id: string; kind: VaultKind;
  title: string; notes: string; occurred_on: string; power_kw: number | null; torque_nm: number | null;
  run_stage: 'before' | 'after' | 'baseline' | null; amount_cents: number | null; currency: string;
  published_at: string | null; created_at: string; created_by: string | null; source: string; source_reference: string | null;
};
export type VaultAsset = {
  id: string; record_id: string; customer_id: string; vehicle_id: string; object_path: string;
  thumbnail_path: string | null; mime_type: string; size_bytes: number; sha256: string; caption: string;
  phase: 'before' | 'progress' | 'after' | null; ready: boolean; created_at: string; created_by: string | null;
};
export type WorkshopJob = { id: string; customer_id: string; vehicle_id: string; reference: string; title: string; job_date: string; created_at: string; created_by: string | null };
export type VaultOverview = { plan: 'free' | 'performance_plus'; counts: Partial<Record<VaultKind, number>>; expires_at: string | null; is_permanent: boolean };
type Table<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
type VaultDatabase = { public: { Tables: {
  vault_records: Table<VaultRecord>; vault_assets: Table<VaultAsset>; workshop_jobs: Table<WorkshopJob>;
  vault_updates: Table<{ job_id: string; customer_id: string; vehicle_id: string; updated_at: string; record_count: number }>;
  vehicle_display_preferences: Table<{ vehicle_id: string; customer_id: string; illustration_id: string }>;
  vault_import_queue: Table<{ id: string; source: string; source_key: string; status: string; identifiers: Record<string, unknown>; job_id: string | null; record_id: string | null; reason: string; attempt_count: number; last_error_code: string | null; created_at: string; updated_at: string }>;
}; Views: Record<never, never>; Functions: {
  performance_vault_overview: { Args: { p_vehicle_id: string }; Returns: VaultOverview };
  grant_performance_beta: { Args: { p_customer_id: string; p_days: number }; Returns: undefined };
  xero_connection_status: { Args: Record<string, never>; Returns: { tenant_id: string; connected_at: string; updated_at: string }[] };
  xero_connection_candidates: { Args: Record<string, never>; Returns: { tenant_id: string; tenant_name: string }[] };
  confirm_xero_organisation: { Args: { p_tenant_id: string }; Returns: undefined };
  confirm_xero_import_match: { Args: { p_queue_id: string; p_customer_id: string; p_job_id: string }; Returns: undefined };
}; Enums: Record<never, never>; CompositeTypes: Record<never, never> } };
// Same authenticated connection and RLS boundary as the existing app.
export function vaultClient() { return getSupabaseClient() as unknown as SupabaseClient<VaultDatabase>; }
export async function loadVaultOverview(vehicleId: string) {
  const { data, error } = await vaultClient().rpc('performance_vault_overview', { p_vehicle_id: vehicleId });
  if (error) throw error;
  return data;
}
export async function loadVaultRecords(vehicleId: string) {
  const { data, error } = await vaultClient().from('vault_records').select('*').eq('vehicle_id', vehicleId).not('published_at', 'is', null).order('occurred_on', { ascending: false }).limit(200);
  if (error) throw error;
  const legacy = await getSupabaseClient().from('invoices').select('*').eq('vehicle_id', vehicleId).is('archived_at', null).order('invoice_date', { ascending: false }).limit(200);
  if (legacy.error) throw legacy.error;
  const invoices: VaultRecord[] = (legacy.data ?? []).map(i => ({ id: `legacy:${i.id}`, customer_id: i.customer_id, vehicle_id: i.vehicle_id, job_id: '', kind: 'invoice', title: i.invoice_number, notes: i.summary, occurred_on: i.invoice_date, power_kw: null, torque_nm: null, run_stage: null, amount_cents: i.amount_cents, currency: i.currency, published_at: i.created_at, created_at: i.created_at, created_by: i.created_by, source: 'legacy', source_reference: i.id }));
  return [...data ?? [], ...invoices].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
}
export async function loadVaultAssets(recordId: string) {
  if (recordId.startsWith('legacy:')) {
    const { data, error } = await getSupabaseClient().from('vehicle_files').select('*').eq('invoice_id', recordId.slice(7)).is('archived_at', null);
    if (error) throw error;
    return (data ?? []).map(f => ({ id: `legacy:${f.id}`, record_id: recordId, customer_id: f.customer_id, vehicle_id: f.vehicle_id, object_path: f.object_path, thumbnail_path: null, mime_type: f.mime_type, size_bytes: f.file_size_bytes, sha256: '', caption: 'PSI invoice', phase: null, ready: true, created_at: f.created_at, created_by: f.created_by })) as VaultAsset[];
  }
  const { data, error } = await vaultClient().from('vault_assets').select('*').eq('record_id', recordId).eq('ready', true).order('created_at');
  if (error) throw error;
  return data ?? [];
}
export function aud(cents: number) { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100) + ' AUD'; }
