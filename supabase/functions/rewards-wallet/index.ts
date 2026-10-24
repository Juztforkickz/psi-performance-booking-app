import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';
import QRCode from 'npm:qrcode@1.5.4';
import { cors, env, uuid } from '../_shared/xero-runtime.ts';
import { applePass, issueGoogleCard, updateGoogleCard, pushApplePass, scanUrl, walletConfiguration, type RewardsCard } from '../_shared/rewards-wallet-providers.ts';
import { rewardsEarningFor, rewardsEarningFingerprint } from '../_shared/rewards-earning.ts';

const headers = { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Expose-Headers': 'Content-Disposition, Last-Modified' };
const output = (data: unknown, status = 200) => Response.json(data, { status, headers });
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
const code = (error: unknown) => error instanceof Error && /^[a-z0-9_]{1,100}$/u.test(error.message) ? error.message : 'rewards_temporarily_unavailable';
async function requestBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new Error('rewards_request_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const result = JSON.parse(new TextDecoder().decode(bytes));
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid_rewards_request');
  return result;
}

async function cardFor(admin: SupabaseClient, customerId: string): Promise<RewardsCard> {
  const { data: profile, error: profileError } = await admin.from('customer_profiles').select('user_id,first_name,last_name,account_state').eq('user_id', customerId).maybeSingle();
  if (profileError || profile?.account_state !== 'active') throw new Error('rewards_account_unavailable');
  const insert = await admin.from('rewards_accounts').upsert({ customer_id: customerId }, { onConflict: 'customer_id', ignoreDuplicates: true });
  if (insert.error) throw new Error('rewards_account_unavailable');
  const { data: account, error } = await admin.from('rewards_accounts').select('*').eq('customer_id', customerId).single();
  if (error || !Number.isSafeInteger(Number(account?.points_balance))) throw new Error('rewards_balance_unavailable');
  const earning = await rewardsEarningFor(admin, customerId);
  let latest = account;
  try {
    const refreshed = await admin.rpc('refresh_rewards_wallet_membership', {
      p_customer_id: customerId, p_fingerprint: await hash(rewardsEarningFingerprint(earning)),
      p_expires_at: earning.validUntil ?? earning.subscriptionExpiresAt,
    });
    if (!refreshed.error && refreshed.data?.customer_id === customerId && refreshed.data.card_id === account.card_id
      && Number.isSafeInteger(Number(refreshed.data.points_balance)) && Number.isSafeInteger(Number(refreshed.data.revision))
      && Number(refreshed.data.revision) >= Number(account.revision)) latest = refreshed.data;
  } catch { /* A status refresh outage must not hide an already verified balance. */ }
  const name = [profile.first_name, profile.last_name].filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()).join(' ').slice(0, 100) || 'PSI member';
  return { ...account, ...latest, points_balance: Number(latest.points_balance), revision: Number(latest.revision), name, earning };
}
async function walletMember(admin: SupabaseClient, customerId: string) {
  const added = await admin.from('rewards_wallet_members').upsert({ customer_id: customerId }, { onConflict: 'customer_id', ignoreDuplicates: true });
  if (added.error) throw new Error('wallet_account_unavailable');
  const { data, error } = await admin.from('rewards_wallet_members').select('*').eq('customer_id', customerId).single();
  if (error) throw new Error('wallet_account_unavailable');
  return data;
}
async function passResponse(admin: SupabaseClient, customerId: string) {
  const card = await cardFor(admin, customerId);
  const member = await walletMember(admin, customerId);
  const bytes = await applePass(card, member.apple_auth_token);
  return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Type': 'application/vnd.apple.pkpass',
    'Content-Disposition': 'attachment; filename="PSI-Rewards.pkpass"', 'Last-Modified': new Date(card.updated_at).toUTCString() } });
}
async function appleApi(request: Request, admin: SupabaseClient, path: string[]) {
  // Apple PassKit's own protocol authentication, not Supabase JWT authentication.
  if (path[0] !== 'v1') return output({ error: 'not_found' }, 404);
  const passType = env('REWARDS_APPLE_PASS_TYPE_ID');
  if (!passType || !walletConfiguration().apple) return output({ error: 'apple_wallet_setup_required' }, 503);
  if (path[1] === 'log' && request.method === 'POST') return new Response(null, { status: 200, headers });
  if (path[1] === 'devices' && path[3] === 'registrations' && path[4] === passType && path.length === 5 && request.method === 'GET') {
    const device = path[2];
    if (!/^[A-Za-z0-9_-]{8,200}$/u.test(device ?? '')) return output({ error: 'invalid_device' }, 400);
    const { data, error } = await admin.from('rewards_wallet_devices').select('customer_id').eq('device_id', device);
    if (error) throw new Error('wallet_registration_unavailable');
    if (!data?.length) return new Response(null, { status: 204, headers });
    const since = Number(new URL(request.url).searchParams.get('passesUpdatedSince') ?? 0);
    if (!Number.isSafeInteger(since) || since < 0) return output({ error: 'invalid_update_tag' }, 400);
    const cards = await admin.from('rewards_accounts').select('card_id,updated_at').in('customer_id', data.map(row => row.customer_id));
    if (cards.error) throw new Error('wallet_registration_unavailable');
    const changed = cards.data.filter(card => Date.parse(card.updated_at) > since);
    if (!changed.length) return new Response(null, { status: 204, headers });
    return output({ serialNumbers: changed.map(card => card.card_id), lastUpdated: String(Math.max(...changed.map(card => Date.parse(card.updated_at)))) });
  }
  const registration = path[1] === 'devices' && path[3] === 'registrations' && path[4] === passType && path.length === 6;
  const download = path[1] === 'passes' && path[2] === passType && path.length === 4;
  if (!registration && !download) return output({ error: 'not_found' }, 404);
  const cardId = registration ? path[5] : path[3];
  if (!uuid(cardId)) return output({ error: 'invalid_pass' }, 400);
  const { data: account } = await admin.from('rewards_accounts').select('customer_id').eq('card_id', cardId).maybeSingle();
  const { data: member } = account ? await admin.from('rewards_wallet_members').select('apple_auth_token').eq('customer_id', account.customer_id).maybeSingle() : { data: null };
  const authToken = (request.headers.get('Authorization') ?? '').replace(/^ApplePass\s+/u, '');
  if (!member || await hash(authToken) !== await hash(member.apple_auth_token)) return output({ error: 'pass_authentication_required' }, 401);
  if (download && request.method === 'GET') return await passResponse(admin, account!.customer_id);
  if (registration) {
    const deviceId = path[2];
    if (!/^[A-Za-z0-9_-]{8,200}$/u.test(deviceId)) return output({ error: 'invalid_device' }, 400);
    if (request.method === 'DELETE') {
      const removed = await admin.from('rewards_wallet_devices').delete().eq('device_id', deviceId).eq('customer_id', account!.customer_id);
      if (removed.error) throw new Error('wallet_registration_unavailable');
      return new Response(null, { status: 200, headers });
    }
    if (request.method === 'POST') {
      const body = await requestBody(request);
      if (typeof body.pushToken !== 'string' || !/^[0-9a-f]{32,256}$/iu.test(body.pushToken)) return output({ error: 'invalid_push_token' }, 400);
      const previous = await admin.from('rewards_wallet_devices').select('device_id').eq('device_id', deviceId).eq('customer_id', account!.customer_id).maybeSingle();
      const saved = await admin.from('rewards_wallet_devices').upsert({ device_id: deviceId, customer_id: account!.customer_id, push_token: body.pushToken });
      if (saved.error) throw new Error('wallet_registration_unavailable');
      return new Response(null, { status: previous.data ? 200 : 201, headers });
    }
  }
  return output({ error: 'method_not_allowed' }, 405);
}

async function syncWallets(admin: SupabaseClient) {
  const dirty = await admin.rpc('rewards_dirty_wallets', { p_limit: 10 });
  if (dirty.error) throw new Error('wallet_sync_unavailable');
  const results = [];
  for (const customerId of dirty.data ?? []) {
    try {
      const card = await cardFor(admin, customerId);
      const member = await walletMember(admin, customerId);
      const failures: string[] = [];
      if (member.google_object_id && Number(member.google_synced_revision) < card.revision) {
        try {
          await updateGoogleCard(card, member.google_object_id);
          const saved = await admin.from('rewards_wallet_members').update({ google_synced_revision: card.revision }).eq('customer_id', customerId);
          if (saved.error) throw new Error('wallet_sync_unavailable');
        } catch (error) { failures.push(code(error)); }
      }
      if (Number(member.apple_synced_revision) < card.revision) {
        try {
          const devices = await admin.from('rewards_wallet_devices').select('device_id,push_token').eq('customer_id', customerId);
          if (devices.error) throw new Error('wallet_sync_unavailable');
          for (const device of devices.data ?? []) {
            const result = await pushApplePass(device.push_token);
            if (result === 'removed') await admin.from('rewards_wallet_devices').delete().eq('device_id', device.device_id).eq('customer_id', customerId);
          }
          const saved = await admin.from('rewards_wallet_members').update({ apple_synced_revision: card.revision }).eq('customer_id', customerId);
          if (saved.error) throw new Error('wallet_sync_unavailable');
        } catch (error) { failures.push(code(error)); }
      }
      if (failures.length) throw new Error(failures[0]);
      await admin.from('rewards_wallet_members').update({ last_error: null, updated_at: new Date().toISOString() }).eq('customer_id', customerId);
      results.push({ status: 'synced' });
    } catch (error) {
      await admin.from('rewards_wallet_members').update({ last_error: code(error), updated_at: new Date().toISOString() }).eq('customer_id', customerId);
      results.push({ status: 'retry', error: code(error) });
    }
  }
  return { processed: results.length, results };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  const url = new URL(request.url);
  const marker = '/rewards-wallet/';
  const path = url.pathname.includes(marker) ? url.pathname.split(marker)[1].split('/').filter(Boolean) : [];
  if (request.method === 'GET' && path.join('/') === 'health') return output({ configured: walletConfiguration() });
  if (Number(request.headers.get('content-length')) > 16384) return output({ error: 'payload_too_large' }, 413);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    if (path[0] === 'apple') return await appleApi(request, admin, path.slice(1));
    if (request.method === 'GET' && path[0] === 'download' && path.length === 2) {
      if (!/^[a-f0-9]{64}$/u.test(path[1])) return output({ error: 'download_expired' }, 404);
      const { data } = await admin.from('rewards_wallet_downloads').select('customer_id').eq('token_hash', await hash(path[1])).gt('expires_at', new Date().toISOString()).maybeSingle();
      if (!data) return output({ error: 'download_expired' }, 404);
      return await passResponse(admin, data.customer_id);
    }
    if (request.method !== 'POST') return output({ error: 'method_not_allowed' }, 405);
    const body = await requestBody(request);
    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/iu, '');
    if (body.action === 'sync_wallets') {
      const verified = typeof body.cronToken === 'string' ? await admin.rpc('verify_service_reminder_cron_token', { p_token: body.cronToken }) : null;
      if (token !== env('SUPABASE_SERVICE_ROLE_KEY') && verified?.data !== true) return output({ error: 'scheduler_authentication_required' }, 403);
      return output(await syncWallets(admin));
    }
    if (!token) return output({ error: 'authentication_required' }, 401);
    const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const identity = await userClient.auth.getUser(token);
    if (!identity.data.user) return output({ error: 'authentication_required' }, 401);
    if (body.action === 'staff_lookup' || body.action === 'staff_status') {
      const [{ data: claims }, { data: staff }] = await Promise.all([
        userClient.auth.getClaims(token), userClient.from('staff_members').select('role,status').eq('user_id', identity.data.user.id).maybeSingle(),
      ]);
      if (claims?.claims?.aal !== 'aal2' || claims.claims.sub !== identity.data.user.id || staff?.status !== 'active' || !['owner','staff'].includes(staff.role)) return output({ error: 'staff_aal2_required' }, 403);
      if (body.action === 'staff_status') {
        const [config, pending, held] = await Promise.all([
          admin.from('rewards_config').select('enabled,starts_on').eq('singleton', true).single(),
          admin.from('rewards_invoice_queue').select('invoice_id', { count: 'exact', head: true }).is('last_error', null).not('lease_token', 'is', null),
          admin.from('rewards_invoice_queue').select('invoice_id', { count: 'exact', head: true }).not('last_error', 'is', null),
        ]);
        if (config.error || pending.error || held.error) throw new Error('rewards_status_unavailable');
        const financial = await admin.rpc('rewards_bonus_financial_report');
        return output({ enabled: config.data.enabled, startsOn: config.data.starts_on, processing: pending.count ?? 0, held: held.count ?? 0,
          wallet: walletConfiguration(), financial: financial.error ? null : financial.data });
      }
      const shortCode = typeof body.cardId === 'string' && /^[0-9a-f]{8}$/iu.test(body.cardId) ? body.cardId.toLowerCase() : null;
      if (!uuid(body.cardId) && !shortCode) return output({ error: 'invalid_rewards_card' }, 400);
      let lookup = admin.from('rewards_accounts').select('customer_id');
      lookup = shortCode ? lookup.gte('card_id', `${shortCode}-0000-0000-0000-000000000000`).lte('card_id', `${shortCode}-ffff-ffff-ffff-ffffffffffff`)
        : lookup.eq('card_id', body.cardId);
      const { data, error } = await lookup.limit(2);
      if (error) throw new Error('rewards_card_lookup_unavailable');
      if (!data?.length) return output({ error: 'rewards_card_not_found' }, 404);
      if (data.length !== 1) return output({ error: 'scan_full_rewards_card_required' }, 409);
      const card = await cardFor(admin, data[0].customer_id);
      return output({ name: card.name, points: card.points_balance, creditCents: Math.max(0, card.points_balance), cardId: card.card_id });
    }
    if (body.action === 'history') {
      const cursor = body.cursor && typeof body.cursor === 'object' ? body.cursor as Record<string, unknown> : null;
      if (cursor && (!uuid(cursor.id) || typeof cursor.at !== 'string' || !Number.isFinite(Date.parse(cursor.at)))) return output({ error: 'invalid_history_cursor' }, 400);
      const page = await admin.rpc('rewards_history_page', { p_customer_id: identity.data.user.id,
        p_before_at: cursor?.at ?? null, p_before_id: cursor?.id ?? null, p_limit: 30 });
      if (page.error) throw new Error('rewards_history_unavailable');
      return output(page.data);
    }
    const card = await cardFor(admin, identity.data.user.id);
    if (body.action === 'apple') {
      if (!walletConfiguration().apple) return output({ error: 'apple_wallet_setup_required' }, 503);
      const downloadToken = randomToken();
      const saved = await admin.from('rewards_wallet_downloads').insert({ customer_id: card.customer_id, token_hash: await hash(downloadToken) });
      if (saved.error) throw new Error('wallet_download_unavailable');
      await admin.from('rewards_wallet_downloads').delete().lt('expires_at', new Date().toISOString());
      return output({ url: `${env('SUPABASE_URL')}/functions/v1/rewards-wallet/download/${downloadToken}` });
    }
    if (body.action === 'google') {
      const link = await issueGoogleCard(card);
      await walletMember(admin, card.customer_id);
      const saved = await admin.from('rewards_wallet_members').update({ google_object_id: link.objectId, google_synced_revision: card.revision }).eq('customer_id', card.customer_id);
      if (saved.error) throw new Error('wallet_account_unavailable');
      return output({ url: link.url });
    }
    if (body.action !== undefined && body.action !== 'summary') return output({ error: 'invalid_action' }, 400);
    const ledger = await admin.from('rewards_ledger').select('id,invoice_number,points_change,kind,created_at').eq('customer_id', card.customer_id).order('created_at', { ascending: false }).limit(30);
    if (ledger.error) throw new Error('rewards_history_unavailable');
    const history = await admin.rpc('rewards_history_page', { p_customer_id: card.customer_id, p_limit: 30 });
    const earnings = await admin.rpc('rewards_invoice_earnings', { p_customer_id: card.customer_id });
    const registration = await admin.from('rewards_wallet_devices').select('customer_id').eq('customer_id', card.customer_id).limit(1);
    const qr = await QRCode.toDataURL(scanUrl(card), { width: 512, margin: 4, errorCorrectionLevel: 'M' });
    return output({ name: card.name, points: card.points_balance, creditCents: Math.max(0, card.points_balance), cardId: card.card_id,
      updatedAt: card.updated_at, qr, earning: card.earning, wallet: walletConfiguration(),
      walletStatus: { appleConnected: registration.error ? null : Boolean(registration.data?.length) },
      ledger: Array.isArray(history.data?.entries) ? history.data.entries : ledger.data,
      historyCursor: history.data?.hasMore ? history.data.cursor : null,
      invoiceEarnings: Array.isArray(earnings.data) ? earnings.data : [] });
  } catch (error) { return output({ error: code(error) }, 503); }
});
