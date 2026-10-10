import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const ts = createRequire(new URL('../mobile/package.json', import.meta.url))('typescript');
const source = await readFile(new URL('../supabase/functions/process-push-notifications/index.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replace(/^import .*;\r?\n/gmu, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function worker({ disabled = false, read = false, cronValid = true } = {}) {
  let handler;
  const updates = [], pushes = [];
  const job = { id: 'job', event_id: 'event', booking_request_id: '9014499f-9115-4147-997b-cf68e73c2d00', recipient_user_id: 'owner', attempt_count: 0 };
  function from(table) {
    let columns = '', mutation, inserted;
    const chain = {
      select(value) { columns = value; return chain; },
      eq() { return chain; }, in() { return chain; }, is() { return chain; }, lte() { return chain; }, lt() { return chain; }, order() { return chain; }, limit() { return chain; }, like() { return chain; }, gte() { return chain; },
      update(value) { mutation = value; updates.push(value); return chain; },
      insert(value) { inserted = value; return chain; },
      maybeSingle() { return Promise.resolve(result()); }, single() { return Promise.resolve(result()); },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    function result() {
      // Model the production schema, which deliberately has no private chat fields.
      if (/ask_psi_conversation_id|message_alerts_enabled/.test(columns)) return { data: null, error: { code: '42703' } };
      if (table === 'staff_members') return { data: { id: 'staff' }, error: null };
      if (table === 'booking_requests') return { data: { id: job.booking_request_id }, error: null };
      if (table === 'push_notification_jobs') return { data: mutation ? { id: 'job' } : inserted ? inserted.map((_, index) => ({ ...job, id: `test-${index}` })) : [job], error: null };
      if (table === 'notification_events') return { data: inserted ? inserted.map((_, index) => ({ id: `event-${index}`, recipient_user_id: 'owner' })) : columns === 'id' ? [] : { id: 'event', kind: 'new_booking_request', deep_link: '/staff', read_at: read ? '2026-10-10T05:00:00Z' : null }, count: 0, error: null };
      if (table === 'push_devices') return { data: [{ expo_push_token: 'ExponentPushToken[test]', notification_sound: 'psi_cash_receipt.wav' }], error: null };
      if (table === 'notification_preferences') return { data: { workshop_alerts_enabled: !disabled, sound_enabled: true }, error: null };
      return { data: null, error: null };
    }
    return chain;
  }
  vm.runInNewContext(code, {
    Deno: { env: { get: (name) => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service' })[name] }, serve: (value) => { handler = value; } },
    createClient: () => ({ from, rpc: async () => ({ data: cronValid, error: null }), auth: { getUser: async () => ({ data: { user: { id: 'owner', email: 'matt@psiperformance.com.au' } } }), getClaims: async () => ({ data: { claims: { aal: 'aal2' } } }) } }),
    Response, Date, crypto: { randomUUID: () => 'test-batch' },
    fetch: async (_, options) => { pushes.push(...JSON.parse(options.body)); return Response.json({ data: [{ status: 'ok', id: 'ticket' }] }); },
  });
  return { updates, pushes, invoke: (body, headers = {}) => handler(new Request('https://test.invalid', { method: 'POST', headers: { Authorization: 'Bearer service', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })) };
}

test('booking dispatch succeeds against production schema without private chat columns', async () => {
  const instance = worker();
  const response = await instance.invoke({ action: 'process_queue' });
  assert.deepEqual(await response.json(), { processed: 1, sent: 1 });
  assert.equal(instance.pushes[0].sound, 'psi_cash_receipt.wav');
  assert.equal(instance.pushes[0].data.url, '/staff');
  assert.ok(instance.updates.some(value => value.status === 'succeeded'));
});

test('owner test alerts create and dispatch both jobs without private chat columns', async () => {
  const instance = worker();
  const response = await instance.invoke({ action: 'send_test_alerts' }, { Authorization: 'Bearer owner-session' });
  assert.deepEqual(await response.json(), { processed: 2, sent: 2 });
});

test('disabled workshop preference prevents delivery', async () => {
  const instance = worker({ disabled: true });
  await instance.invoke({ action: 'process_queue' });
  assert.equal(instance.pushes.length, 0);
  assert.ok(instance.updates.some(value => value.last_error_code === 'preference_disabled'));
});

test('background retry does not deliver an already read booking alert', async () => {
  const instance = worker({ read: true });
  await instance.invoke({ action: 'process_queue' });
  assert.equal(instance.pushes.length, 0);
  assert.ok(instance.updates.some(value => value.last_error_code === 'notification_already_read'));
});

test('dedicated cron token permits queue retries and rejects other actions', async () => {
  const headers = { Authorization: 'Bearer anon', 'x-psi-cron-token': 'dedicated-test-token' };
  const instance = worker();
  assert.equal((await instance.invoke({ action: 'process_queue' }, headers)).status, 200);
  assert.equal((await instance.invoke({ action: 'register_device' }, headers)).status, 400);
  assert.equal((await worker({ cronValid: false }).invoke({ action: 'process_queue' }, headers)).status, 401);
});
