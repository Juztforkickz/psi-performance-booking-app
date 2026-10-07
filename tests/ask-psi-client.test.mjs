import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const ts = createRequire(new URL('../mobile/package.json', import.meta.url))('typescript');
const source = ts.transpileModule(await readFile(new URL('../mobile/src/lib/ask-psi-messaging.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ enabled = true, userId = 'customer', rows = {}, rpcError = null, uploadError = null } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from(table) {
      const chain = {
        select() { return chain; }, eq() { return chain; }, in() { return chain; }, is() { return chain; }, order() { return chain; },
        single() { return chain; }, maybeSingle() { return chain; },
        then(resolve) { return Promise.resolve({ data: rows[table] ?? null, error: null }).then(resolve); },
      };
      return chain;
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: name === 'open_ask_psi_conversation' ? [{ conversation_id: 'conversation', message_id: 'message' }] : { id: 'message' }, error: rpcError };
    },
    functions: { invoke: async (name, args) => { calls.push({ name, args }); return { error: null }; } },
    storage: { from: () => ({
      upload: async (...args) => { calls.push({ name: 'upload', args }); return { error: uploadError }; },
      remove: async (...args) => { calls.push({ name: 'remove', args }); return { error: null }; },
    }) },
  };
  const api = {};
  vm.runInNewContext(source, {
    exports: api,
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(5) }),
    require: (name) => {
      if (name === 'expo-crypto') return { randomUUID: () => 'random-uuid' };
      if (name === 'expo-image-manipulator') return { SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: async () => { calls.push({ name: 'convert' }); return { uri: 'file:///converted.jpg', width: 1600, height: 1200 }; } };
      if (name === '@/lib/ask-psi-stage') return { ASK_PSI_STAGE: { privatePreviewEnabled: enabled } };
      if (name === '@/lib/ask-psi-device-qa') return { ASK_PSI_DEVICE_QA: { enabled: false }, notificationWorkerName: () => 'process-push-notifications' };
      if (name === '@/lib/supabase') return { getSupabaseClient: () => { calls.push({ name: 'client' }); return client; } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { api, calls };
}

test('public builds cannot create a messaging client, send or subscribe', async () => {
  const { api, calls } = harness({ enabled: false });
  await assert.rejects(api.listAskPsiConversations(), /PRIVATE_PREVIEW_REQUIRED/);
  await assert.rejects(api.sendAskPsiTextMessage('conversation', 'Hello'), /PRIVATE_PREVIEW_REQUIRED/);
  await assert.rejects(api.markAskPsiConversationRead('conversation', 'message'), /PRIVATE_PREVIEW_REQUIRED/);
  assert.throws(() => api.subscribeToAskPsiInbox(() => {}), /PRIVATE_PREVIEW_REQUIRED/);
  assert.equal(calls.length, 0);
});

test('retries preserve client nonces and read receipts carry a displayed message boundary', async () => {
  const { api, calls } = harness();
  await api.openAskPsiConversation({ body: ' Hello ', topic: 'service', clientNonce: 'open-once' });
  await api.sendAskPsiTextMessage('conversation', ' Again ', 'send-once');
  await api.markAskPsiConversationRead('conversation', 'displayed-message');
  assert.equal(calls.find((call) => call.name === 'open_ask_psi_conversation').args.p_client_nonce, 'open-once');
  assert.equal(calls.find((call) => call.name === 'send_ask_psi_message').args.p_client_nonce, 'send-once');
  assert.equal(calls.find((call) => call.name === 'mark_ask_psi_conversation_read').args.p_read_through_message_id, 'displayed-message');
});

test('customer unread count excludes their own sent messages', async () => {
  const { api } = harness({ rows: {
    ask_psi_conversations: [{ id: 'conversation', customer_id: 'customer' }],
    ask_psi_messages: [{ conversation_id: 'conversation', sender_kind: 'customer' }, { conversation_id: 'conversation', sender_kind: 'staff' }],
  } });
  assert.equal((await api.listAskPsiConversations())[0].unread_count, 1);
});

test('staff unread count includes customer messages only', async () => {
  const { api } = harness({ userId: 'staff', rows: {
    ask_psi_conversations: [{ id: 'conversation', customer_id: 'customer' }],
    ask_psi_messages: [{ conversation_id: 'conversation', sender_kind: 'customer' }, { conversation_id: 'conversation', sender_kind: 'staff' }],
  } });
  assert.equal((await api.listAskPsiConversations())[0].unread_count, 1);
});

test('ambiguous photo registration failure does not delete a potentially committed photo', async () => {
  const { api, calls } = harness({ rows: { ask_psi_conversations: { id: 'conversation', customer_id: 'customer' } }, rpcError: { code: '', message: 'Failed to fetch' } });
  await assert.rejects(api.sendAskPsiPhotoMessage('conversation', { uri: 'file:///photo.jpg', messageId: 'photo', clientNonce: 'once' }));
  assert.equal(calls.some((call) => call.name === 'remove'), false);
  assert.equal(calls.find((call) => call.name === 'send_ask_psi_photo').args.p_client_nonce, 'once');
});

test('photo retry recovers the existing upload without overwriting it', async () => {
  const { api, calls } = harness({ rows: { ask_psi_conversations: { id: 'conversation', customer_id: 'customer' } }, uploadError: { statusCode: '409' } });
  await api.sendAskPsiPhotoMessage('conversation', { uri: 'file:///photo.jpg', messageId: 'photo', clientNonce: 'once' });
  assert.equal(calls.find((call) => call.name === 'upload').args[2].upsert, false);
  assert.equal(calls.filter((call) => call.name === 'send_ask_psi_photo').length, 1);
});

test('definitively rejected photo registration cleans up only an unattached upload', async () => {
  const { api, calls } = harness({ rows: { ask_psi_conversations: { id: 'conversation', customer_id: 'customer' } }, rpcError: { code: '42501' } });
  await assert.rejects(api.sendAskPsiPhotoMessage('conversation', { uri: 'file:///photo.jpg', messageId: 'photo', clientNonce: 'once' }));
  assert.equal(calls.filter((call) => call.name === 'remove').length, 1);
});

test('ordinary iPhone HEIC photos are converted to JPEG with their actual dimensions', async () => {
  const { api, calls } = harness({ rows: { ask_psi_conversations: { id: 'conversation', customer_id: 'customer' } } });
  await api.sendAskPsiPhotoMessage('conversation', { uri: 'file:///phone.heic', mimeType: 'image/heic', messageId: 'photo', clientNonce: 'once' });
  assert.equal(calls.filter((call) => call.name === 'convert').length, 1);
  const payload = calls.find((call) => call.name === 'send_ask_psi_photo').args;
  assert.equal(payload.p_mime_type, 'image/jpeg');
  assert.equal(payload.p_width, 1600);
  assert.equal(payload.p_height, 1200);
});
