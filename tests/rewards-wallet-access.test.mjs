import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = require('typescript');
const source = await readFile(new URL('../supabase/functions/rewards-wallet/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

function harness({ signedIn = false, staff = false, apple = false, ambiguous = false } = {}) {
  let handler;
  let passes = 0;
  const calls = [];
  const rows = {
    customer_profiles: [{ user_id: id(1), first_name: 'Sample', last_name: 'Customer', account_state: 'active' }],
    rewards_accounts: [{ customer_id: id(1), card_id: id(10), points_balance: 1000, revision: 1, updated_at: '2026-10-22T00:00:00Z' }],
    rewards_wallet_members: [{ customer_id: id(1), apple_auth_token: 'fixture-secret-pass-token' }],
    rewards_wallet_downloads: [], rewards_ledger: [], rewards_wallet_devices: [],
    staff_members: staff ? [{ user_id: id(1), role: 'owner', status: 'active' }] : [],
  };
  if (ambiguous) rows.rewards_accounts.push({ customer_id:id(2),card_id:id(11),points_balance:0,revision:1,updated_at:'2026-10-22T00:00:00Z' });
  const client = {
    auth: {
      getUser: async () => ({ data: { user: signedIn ? { id: id(1) } : null } }),
      getClaims: async () => ({ data: { claims: { sub: id(1), aal: staff ? 'aal2' : 'aal1' } } }),
    },
    async rpc() { return { data: false }; },
    from(table) {
      const call = { table, operation: 'select', filters: [] }; calls.push(call);
      let single = false;
      const ranges = [];
      const chain = {
        select() { return chain; }, single() { single = true; return chain; }, maybeSingle() { single = true; return chain; },
        eq(key, value) { call.filters.push([key, value]); return chain; },
        gte(key,value) { ranges.push(row=>row[key]>=value); return chain; }, lte(key,value) { ranges.push(row=>row[key]<=value); return chain; },
        gt() { return chain; }, lt() { return chain; }, order() { return chain; }, limit() { return chain; },
        upsert(value) { call.operation = 'upsert'; call.value = value; return chain; },
        insert(value) { call.operation = 'insert'; call.value = value; return chain; },
        delete() { call.operation = 'delete'; return chain; },
        then(resolve, reject) {
          const values = (rows[table] ?? []).filter(row => call.filters.every(([key, value]) => row[key] === value) && ranges.every(check=>check(row)));
          return Promise.resolve({ data: single ? values[0] ?? null : values, error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  const config = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-role', SUPABASE_ANON_KEY: 'fixture-public-key', REWARDS_APPLE_PASS_TYPE_ID: apple ? 'pass.example.fixture' : '' };
  const cors = { 'Cache-Control': 'no-store' };
  vm.runInNewContext(compiled, {
    exports: {}, Deno: { serve: value => { handler = value; } }, Request, Response, URL, crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, Date,
    require(name) {
      if (name === 'npm:@supabase/supabase-js@2.112.3') return { createClient: () => client };
      if (name === 'npm:qrcode@1.5.4') return { __esModule: true, default: { toDataURL: async value => { calls.push({ qr: value }); return 'data:image/png;base64,fixture'; } } };
      if (name.endsWith('xero-runtime.ts')) return { cors, env: key => config[key] ?? '', uuid: value => typeof value === 'string' && /^[a-f0-9-]{36}$/u.test(value) };
      if (name.endsWith('rewards-wallet-providers.ts')) return {
        walletConfiguration: () => ({ apple, google: false }), scanUrl: card => `https://example.invalid/rewards-scan/#${card.card_id}`,
        applePass: async () => { passes++; return Uint8Array.of(1,2,3); },
      };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const call = (body, token = signedIn ? 'fixture-user-token' : '') => handler(new Request('https://fixture.supabase.co/functions/v1/rewards-wallet', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
  }));
  return { handler, call, calls, passes: () => passes };
}
test('anonymous summary and guessed user tokens cannot read any customer data', async () => {
  const h = harness();
  assert.equal((await h.call({ action: 'summary' })).status, 401);
  assert.equal((await h.call({ action: 'summary' }, 'forged-token')).status, 401);
  assert.equal(h.calls.length, 0);
});
test('customer ID supplied by the caller is ignored in favour of the verified identity', async () => {
  const h = harness({ signedIn: true });
  const response = await h.call({ action: 'summary', customerId: id(2) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.points, 1000); assert.equal(result.creditCents, 1000);
  assert.equal(result.cardId, id(10));
  assert.equal(h.calls.some(call => call.filters?.some(([, value]) => value === id(2))), false);
  assert.ok(h.calls.find(call => call.table === 'rewards_ledger').filters.some(([key,value]) => key === 'customer_id' && value === id(1)));
  assert.equal(JSON.stringify(result).includes('fixture-secret-pass-token'), false);
  assert.equal(h.calls.find(call => call.qr)?.qr.includes('Sample'), false);
});
test('a signed-in customer cannot scan another customer card or view staff status', async () => {
  const h = harness({ signedIn: true });
  assert.equal((await h.call({ action: 'staff_lookup', cardId: id(10) })).status, 403);
  assert.equal((await h.call({ action: 'staff_status' })).status, 403);
  assert.equal(h.calls.some(call => call.table === 'rewards_accounts'), false);
});
test('staff scanning requires verified MFA and returns only the selected card', async () => {
  const h = harness({ signedIn: true, staff: true });
  const response = await h.call({ action: 'staff_lookup', cardId: id(10) });
  assert.equal(response.status, 200); assert.equal((await response.json()).name, 'Sample Customer');
});
test('the displayed short membership code works only when it uniquely identifies a card', async () => {
  const h=harness({signedIn:true,staff:true});
  assert.equal((await h.call({action:'staff_lookup',cardId:'10000000'})).status,200);
  const collision=harness({signedIn:true,staff:true,ambiguous:true});
  assert.equal((await collision.call({action:'staff_lookup',cardId:'10000000'})).status,409);
});
test('an unconfigured Wallet cannot issue an unsigned placeholder card', async () => {
  const h = harness({ signedIn: true });
  const response = await h.call({ action: 'apple' });
  assert.equal(response.status, 503); assert.equal((await response.json()).error, 'apple_wallet_setup_required');
  assert.equal(h.passes(),0);
});
test('health reveals only readiness flags, never provider credentials or customer information', async () => {
  const h = harness();
  const response = await h.handler(new Request('https://fixture.supabase.co/functions/v1/rewards-wallet/health'));
  assert.deepEqual(await response.json(),{configured:{apple:false,google:false}});
  assert.equal(h.calls.length,0);
});
test('a visible membership QR identifier does not authenticate an Apple pass download', async () => {
  const h = harness({ apple: true });
  const response = await h.handler(new Request(`https://fixture.supabase.co/functions/v1/rewards-wallet/apple/v1/passes/pass.example.fixture/${id(10)}`,{headers:{Authorization:`ApplePass ${id(10)}`}}));
  assert.equal(response.status,401); assert.equal(h.passes(),0);
});
test('guessed or expired temporary download links reveal no pass', async () => {
  const h = harness({ apple:true });
  assert.equal((await h.handler(new Request('https://fixture.supabase.co/functions/v1/rewards-wallet/download/guess'))).status,404);
  assert.equal((await h.handler(new Request(`https://fixture.supabase.co/functions/v1/rewards-wallet/download/${'0'.repeat(64)}`))).status,404);
  assert.equal(h.passes(),0);
});
test('public requests cannot invoke the Wallet background updater', async () => {
  const h = harness({ signedIn:true });
  assert.equal((await h.call({ action:'sync_wallets',cronToken:'forged' })).status,403);
  assert.equal(h.calls.length,0);
});
