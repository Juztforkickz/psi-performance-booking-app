import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = require('typescript');
const source = await readFile(new URL('../supabase/functions/process-push-notifications/index.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replace(/^import .*;\r?\n/gmu, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function createWorker({ messageRead = false, lookupError = null } = {}) {
  let handler;
  const updates = [];
  let fetches = 0;
  const job = { id: 'test-job', event_id: 'test-event', recipient_user_id: 'customer', attempt_count: 0, ask_psi_conversation_id: 'test-conversation', booking_request_id: null };
  const from = (table) => {
    let changes;
    const chain = {
      select() { return chain; }, eq() { return chain; }, in() { return chain; }, is() { return chain; }, lte() { return chain; }, lt() { return chain; }, order() { return chain; }, limit() { return chain; },
      update(value) { changes = value; updates.push({ table, value }); return chain; },
      maybeSingle() { return Promise.resolve(result()); }, single() { return Promise.resolve(result()); },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    function result() {
      if (table === lookupError) return { data: null, error: { code: 'test_lookup_error' } };
      if (table === 'staff_members') return { data: null, error: null };
      if (table === 'push_notification_jobs') return { data: changes ? { id: job.id } : messageRead || lookupError ? [job] : [], error: null };
      if (table === 'notification_events') return { data: { id: 'test-event', kind: 'staff_message_received', deep_link: '/messages', read_at: '2026-10-07T01:00:00Z' }, count: 0, error: null };
      if (table === 'push_devices') return { data: [{ expo_push_token: 'ExponentPushToken[private-test]', notification_sound: null }], error: null };
      if (table === 'notification_preferences') return { data: { message_alerts_enabled: true }, error: null };
      return { data: null, error: null };
    }
    return chain;
  };
  vm.runInNewContext(code, {
    Deno: { env: { get: (name) => ({ SUPABASE_URL: 'https://sandbox.example.invalid', SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service' })[name] }, serve: (next) => { handler = next; } },
    createClient: () => ({ from, auth: { getUser: async () => ({ data: { user: { id: 'ordinary-customer', email: 'customer@example.invalid' } } }), getClaims: async () => ({ data: { claims: { aal: 'aal1' } } }) } }),
    Response, Date, fetch: async () => { fetches += 1; throw new Error('This test must not deliver any push'); },
  });
  return {
    invoke: (token, body) => handler(new Request('https://worker.example.invalid', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })),
    updates, get fetches() { return fetches; },
  };
}

test('authenticated service queue worker may process the empty push queue', async () => {
  const worker = createWorker();
  const response = await worker.invoke('test-service', { action: 'process_queue' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processed: 0, sent: 0 });
});

test('ordinary customer cannot request the unrestricted push queue', async () => {
  const worker = createWorker();
  assert.equal((await worker.invoke('customer-token', { action: 'process_queue' })).status, 403);
  assert.equal(worker.fetches, 0);
});

test('already read Ask PSI notification is cancelled instead of delivered', async () => {
  const worker = createWorker({ messageRead: true });
  assert.equal((await worker.invoke('test-service', { action: 'process_queue' })).status, 200);
  assert.equal(worker.fetches, 0);
  assert.ok(worker.updates.some(({ value }) => value.status === 'cancelled' && value.last_error_code === 'message_already_read'));
});

for (const table of ['notification_events', 'push_devices', 'notification_preferences']) {
  test(`${table} lookup failure is held for retry without sending or cancelling`, async () => {
    const worker = createWorker({ lookupError: table });
    assert.equal((await worker.invoke('test-service', { action: 'process_queue' })).status, 200);
    assert.equal(worker.fetches, 0);
    assert.ok(worker.updates.some(({ value }) => value.status === 'failed' && value.last_error_code === 'notification_lookup_failed'));
    assert.equal(worker.updates.some(({ value }) => value.status === 'cancelled'), false);
  });
}
