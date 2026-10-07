import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash, webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import { TORI_SIGNATURE_BANNER_BASE64 } from '../supabase/functions/process-performance-trial-notifications/tori-signature-banner.ts';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = require('typescript');
const source = await readFile(new URL('../supabase/functions/process-ask-psi-email-fallbacks/index.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.replace(/^import .*;\r?\n/gmu, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

function harness({ enabled = true, credentials = true, read = false, optedOut = false, stale = false, failSend = false, failAuth = false, banner = TORI_SIGNATURE_BANNER_BASE64, customerName = 'Sample' } = {}) {
  const values = {
    SUPABASE_URL: 'https://sandbox.example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'private-test-key',
    PSI_ASK_PSI_EMAIL_DELIVERY_ENABLED: enabled ? 'true' : 'false',
    ...(credentials ? {
      MICROSOFT_365_TENANT_ID: 'test-tenant', MICROSOFT_365_CLIENT_ID: 'test-client', MICROSOFT_365_CLIENT_SECRET: 'test-secret',
      PSI_MICROSOFT_365_SENDER_EMAIL: 'workshop@example.invalid', PSI_OWNER_NOTIFICATION_EMAIL: 'owner@example.invalid',
      PSI_WORKSHOP_PORTAL_URL: 'https://portal.example.invalid/messages',
    } : {}),
  };
  const old = new Date(Date.now() - 60 * 60_000).toISOString();
  const tables = {
    ask_psi_email_jobs: [{ id: 'job', conversation_id: 'conversation', message_id: 'message', recipient_user_id: 'owner', status: stale ? 'processing' : 'pending', attempt_count: 0, available_at: old, last_attempt_at: stale ? old : null, created_at: old, last_error_code: null }],
    ask_psi_conversations: [{ id: 'conversation', customer_id: 'customer', vehicle_id: null, staff_last_read_at: null }],
    ask_psi_messages: [{ id: 'message', created_at: old, sender_kind: 'customer', recipient_read_at: read ? old : null }],
    staff_members: [{ user_id: 'owner', role: 'owner', status: 'active' }],
    notification_preferences: [{ user_id: 'owner', message_email_fallback_enabled: !optedOut }],
    customer_profiles: [{ user_id: 'customer', first_name: customerName, last_name: 'Customer', email: 'sample@example.invalid' }],
  };
  let writes = 0;
  const requests = [];
  function from(name) {
    const predicates = [];
    let changes;
    let cap = Infinity;
    const query = {
      select() { return query; }, update(value) { changes = value; return query; },
      eq(key, value) { predicates.push((row) => row[key] === value); return query; },
      in(key, values) { predicates.push((row) => values.includes(row[key])); return query; },
      lte(key, value) { predicates.push((row) => row[key] <= value); return query; },
      lt(key, value) { predicates.push((row) => row[key] < value); return query; },
      or() { predicates.push((row) => row.last_error_code !== 'delivery_outcome_unknown'); return query; },
      order() { return query; }, limit(value) { cap = value; return query; },
      single() { return run(true); }, maybeSingle() { return run(true); },
      then(resolve, reject) { return run(false).then(resolve, reject); },
    };
    async function run(single) {
      const rows = (tables[name] ?? []).filter((row) => predicates.every((match) => match(row))).slice(0, cap);
      if (changes) { for (const row of rows) Object.assign(row, changes); writes += rows.length; }
      return { data: single ? (rows[0] ? structuredClone(rows[0]) : null) : structuredClone(rows), error: null };
    }
    return query;
  }
  let handler;
  vm.runInNewContext(code, {
    Deno: { env: { get: (name) => values[name] }, serve: (next) => { handler = next; } },
    createClient: () => ({ from }), Response, URLSearchParams, AbortSignal, Date, atob, crypto: webcrypto, TORI_SIGNATURE_BANNER_BASE64: banner,
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.includes('/oauth2/')) return Response.json(failAuth ? { error: 'invalid_client' } : { access_token: 'test-graph-token' }, { status: failAuth ? 401 : 200 });
      if (failSend) throw new Error('Unknown delivery outcome');
      return new Response(null, { status: 202 });
    },
  });
  const invoke = () => handler(new Request('https://worker.example.invalid', { method: 'POST', headers: { Authorization: 'Bearer private-test-key' } }));
  return { invoke, tables, requests, get writes() { return writes; } };
}

test('Ask PSI fallback stays disabled even when shared Microsoft credentials exist', async () => {
  const worker = harness({ enabled: false });
  assert.deepEqual(await (await worker.invoke()).json(), { configured: false, processed: 0, sent: 0 });
  assert.equal(worker.requests.length, 0);
  assert.equal(worker.writes, 0);
});

test('missing Microsoft configuration consumes no queue attempts', async () => {
  const worker = harness({ credentials: false });
  await worker.invoke();
  assert.equal(worker.tables.ask_psi_email_jobs[0].attempt_count, 0);
  assert.equal(worker.requests.length, 0);
});

test('Microsoft authentication failure leaves queued messages retryable', async () => {
  const worker = harness({ failAuth: true });
  assert.equal((await worker.invoke()).status, 503);
  assert.equal(worker.tables.ask_psi_email_jobs[0].status, 'pending');
  assert.equal(worker.tables.ask_psi_email_jobs[0].attempt_count, 0);
});

for (const [name, settings] of [['read', { read: true }], ['opted out', { optedOut: true }]]) {
  test(`fallback cancels when a message is ${name}`, async () => {
    const worker = harness(settings);
    await worker.invoke();
    assert.equal(worker.tables.ask_psi_email_jobs[0].status, 'cancelled');
    assert.equal(worker.requests.filter(({ url }) => url.includes('/sendMail')).length, 0);
  });
}

test('unknown email delivery is held for inspection rather than sent twice', async () => {
  const worker = harness({ failSend: true });
  await worker.invoke();
  await worker.invoke();
  assert.equal(worker.tables.ask_psi_email_jobs[0].last_error_code, 'delivery_outcome_unknown');
  assert.equal(worker.requests.filter(({ url }) => url.includes('/sendMail')).length, 1);
});

test('abandoned processing email is held without a duplicate attempt', async () => {
  const worker = harness({ stale: true });
  await worker.invoke();
  assert.equal(worker.tables.ask_psi_email_jobs[0].last_error_code, 'delivery_outcome_unknown');
  assert.equal(worker.requests.filter(({ url }) => url.includes('/sendMail')).length, 0);
});

test('parallel invocations claim a single email and omit private message content', async () => {
  const worker = harness();
  await Promise.all([worker.invoke(), worker.invoke()]);
  const sent = worker.requests.filter(({ url }) => url.includes('/sendMail'));
  assert.equal(sent.length, 1);
  const message = JSON.parse(sent[0].options.body).message;
  assert.equal(message.toRecipients[0].emailAddress.address, 'owner@example.invalid');
  assert.match(message.body.content, /only after signing in/);
  assert.equal(worker.tables.ask_psi_email_jobs[0].status, 'succeeded');
});

test('Microsoft payload embeds the approved Tori banner with the exact size and authorship', async () => {
  const worker = harness({ customerName: '<img src=x onerror="bad()">&' });
  await worker.invoke();
  const sent = worker.requests.find(({ url }) => url.includes('/sendMail'));
  const message = JSON.parse(sent.options.body).message;
  assert.equal(message.body.contentType, 'HTML');
  assert.match(message.body.content, /&lt;img src=x onerror=&quot;bad\(\)&quot;&gt;&amp;/u);
  assert.doesNotMatch(message.body.content, /<img src=x/u);
  assert.match(message.body.content, /width="452" height="226"/u);
  assert.match(message.body.content, /Authorised assistant for Matthew Ebert/u);
  assert.equal(message.attachments.length, 1);
  const attachment = message.attachments[0];
  assert.equal(attachment['@odata.type'], '#microsoft.graph.fileAttachment');
  assert.equal(attachment.isInline, true);
  assert.equal(attachment.contentType, 'image/jpeg');
  assert.equal(attachment.contentId, 'psi-tori-laurent-signature');
  assert.ok(message.body.content.includes(`src="cid:${attachment.contentId}"`));
  assert.equal(createHash('sha256').update(Buffer.from(attachment.contentBytes, 'base64')).digest('hex'), 'c7a33dbd43daa2bdfc0eef4e629bcb8385938465d672d88921b15c046c3ac1b2');
  assert.ok(message.body.content.endsWith('margin-top:18px">'), 'No additional live text signature may follow the banner');
});

test('modified or missing Tori artwork blocks email before any Graph request', async () => {
  const worker = harness({ banner: 'not the approved banner' });
  assert.equal((await worker.invoke()).status, 503);
  assert.equal(worker.requests.length, 0);
  assert.equal(worker.writes, 0);
});
