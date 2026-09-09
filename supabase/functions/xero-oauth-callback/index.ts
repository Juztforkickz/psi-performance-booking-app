import { adminClient, env, uuid } from '../_shared/performance-subscription.ts';
import { sealXeroTokens, xeroStateHash } from '../_shared/xero-token-crypto.ts';
const result = (message: string, status = 200) => new Response(message, { status, headers: {
  'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
} });

Deno.serve(async request => {
  if (request.method !== 'GET') return result('Method not allowed.', 405);
  const clientId = env('XERO_CLIENT_ID'), secret = env('XERO_CLIENT_SECRET');
  const encryptionKey = env('XERO_TOKEN_ENCRYPTION_KEY'), tenantId = env('XERO_TENANT_ID');
  if (!clientId || !secret || !encryptionKey || (tenantId && !uuid(tenantId))) return result('Xero connection setup is not ready yet. No invoices have been imported.', 503);
  const url = new URL(request.url), state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  if (!/^[a-f0-9]{64}$/.test(state)) return result('This connection link is invalid. Start again from the PSI owner portal.', 400);
  try {
    const admin = adminClient();
    const { data: ownerId, error } = await admin.rpc('consume_xero_oauth', { p_state_hash: await xeroStateHash(state) });
    if (error || !uuid(ownerId)) return result('This link has expired or was already used. Start again from the PSI owner portal.', 400);
    if (url.searchParams.has('error') || !code || code.length > 4096) return result('Xero connection was not authorised. No invoices have been imported.', 400);
    const response = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: `${env('SUPABASE_URL')}/functions/v1/xero-oauth-callback` }),
    });
    if (!response.ok) return result('Xero could not verify the connection. Start again from PSI.', 502);
    const tokens = await response.json();
    if (typeof tokens.access_token !== 'string' || typeof tokens.refresh_token !== 'string' || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) throw new Error('invalid_tokens');
    const connections = await fetch('https://api.xero.com/connections', { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!connections.ok) throw new Error('connections_unavailable');
    const allowed = await connections.json();
    if (!Array.isArray(allowed)) throw new Error('invalid_connections');
    // First connection requires a second owner/MFA confirmation of provider-returned
    // organisation IDs. Never infer a tenant ID from names or a website shortcode.
    if (!tenantId) {
      const candidates = allowed.filter(c => uuid(c.tenantId) && c.tenantType === 'ORGANISATION' && typeof c.tenantName === 'string');
      if (!candidates.length || candidates.length > 5) throw new Error('organisation_review_required');
      for (const candidate of candidates) {
        const sealed = await sealXeroTokens({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: Date.now() + tokens.expires_in * 1000, scope: tokens.scope }, candidate.tenantId, encryptionKey);
        const { error: stageError } = await admin.rpc('stage_xero_connection', { p_tenant_id: candidate.tenantId, p_tenant_name: candidate.tenantName, p_owner_id: ownerId, p_sealed_tokens: sealed });
        if (stageError) throw new Error('connection_stage_failed');
      }
      return result('Xero authorisation received. Return to the PSI owner portal, choose Check connection, and confirm the PSI organisation within 15 minutes. No invoices have been imported.');
    }
    if (allowed.filter(c => c.tenantId === tenantId && c.tenantType === 'ORGANISATION').length !== 1) return result('The selected Xero organisation does not match the verified PSI organisation. No connection was saved.', 403);
    const sealed = await sealXeroTokens({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: Date.now() + tokens.expires_in * 1000, scope: tokens.scope }, tenantId, encryptionKey);
    const { error: saveError } = await admin.rpc('save_xero_connection', { p_tenant_id: tenantId, p_owner_id: ownerId, p_sealed_tokens: sealed });
    if (saveError) throw new Error('connection_save_failed');
    return result('Xero connected securely to PSI. Invoice importing remains off until the first customer, vehicle and job match has been checked. You can close this tab.');
  } catch { return result('The Xero connection could not be completed. Start again from PSI. No payment was taken.', 503); }
});
