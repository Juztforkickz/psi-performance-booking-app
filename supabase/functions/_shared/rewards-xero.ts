import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';
import { openXeroTokens, sealXeroTokens } from './xero-token-crypto.ts';
import { parseXeroTokenSet, requestXeroTokenRefresh } from './xero-token-refresh.ts';
import { env, uuid } from './xero-runtime.ts';

// Reuse the existing encrypted Xero connection and refresh lease. Read-only invoice access.
export async function rewardsXeroAccess(admin: SupabaseClient, tenant: string) {
  if (tenant !== env('XERO_TENANT_ID')) throw new Error('rewards_organisation_requires_review');
  let claim;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await admin.rpc('claim_xero_refresh', { p_tenant_id: tenant });
    if (!result.error) { claim = result.data; break; }
    if (result.error.message !== 'xero_refresh_busy') throw new Error('xero_refresh_claim_failed');
    if (attempt === 4) throw new Error('xero_refresh_busy');
    await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
  }
  if (!claim || !uuid(claim.lock_token) || !Number.isSafeInteger(Number(claim.revision))
    || typeof claim.sealed_tokens !== 'string') throw new Error('xero_refresh_claim_invalid');
  let committed = false;
  try {
    const current = parseXeroTokenSet(await openXeroTokens(claim.sealed_tokens, tenant, env('XERO_TOKEN_ENCRYPTION_KEY')));
    const refreshed = await requestXeroTokenRefresh(current.refresh_token, env('XERO_CLIENT_ID'), env('XERO_CLIENT_SECRET'));
    const sealed = await sealXeroTokens({ ...refreshed, scope: refreshed.scope ?? current.scope, refreshed_at: new Date().toISOString() }, tenant, env('XERO_TOKEN_ENCRYPTION_KEY'));
    const saved = await admin.rpc('commit_xero_refresh', { p_tenant_id: tenant, p_lock_token: claim.lock_token, p_expected_revision: Number(claim.revision), p_sealed_tokens: sealed });
    if (saved.error) throw new Error('xero_refresh_conflict');
    committed = true;
    return refreshed.access_token;
  } finally {
    if (!committed) await admin.rpc('release_xero_refresh', { p_tenant_id: tenant, p_lock_token: claim.lock_token });
  }
}
