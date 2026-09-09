import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { cors, env, json } from '../_shared/performance-subscription.ts';
import { xeroStateHash } from '../_shared/xero-token-crypto.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'authentication_required' }, 401);
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return json({ error: 'authentication_required' }, 401);
  if (!env('XERO_CLIENT_ID') || !env('XERO_CLIENT_SECRET') || !env('XERO_TOKEN_ENCRYPTION_KEY')) return json({ error: 'xero_configuration_required' }, 503);
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const { error: stateError } = await client.rpc('begin_xero_oauth', { p_state_hash: await xeroStateHash(state) });
  if (stateError) return json({ error: 'owner_mfa_required' }, 403);
  const url = new URL('https://login.xero.com/identity/connect/authorize');
  url.search = new URLSearchParams({
    response_type: 'code', client_id: env('XERO_CLIENT_ID'),
    redirect_uri: `${env('SUPABASE_URL')}/functions/v1/xero-oauth-callback`,
    scope: 'offline_access accounting.invoices.read accounting.contacts.read', state,
  }).toString();
  return json({ authorizationUrl: url.toString() });
});
