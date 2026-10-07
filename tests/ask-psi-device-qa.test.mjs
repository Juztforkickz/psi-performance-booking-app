import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = require('typescript');
const { resolveAskPsiDeviceQa, QA_RUNTIME } = require('../mobile/ask-psi-device-qa.cjs');
const { REVIEW_URL, REVIEW_PUBLIC_KEY } = require('../mobile/review-environment.cjs');
const customer = '060ecb89-838d-4034-b408-3ee7782a6a89';
const staff = '88f9d90b-0452-4478-940d-5cb96a298184';
const conversation = 'a04e72a2-6f02-4b10-bf66-428714a97738';
const valid = { flag: 'true', users: `${customer},${staff}`, review: 'true', googleReview: 'false', privatePreview: 'true', url: REVIEW_URL, key: REVIEW_PUBLIC_KEY, channel: 'apple-review', auth: 'true', booking: 'true', registration: 'false', demo: 'false', purchaseTest: 'false' };
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const navigationCode = compile(await readFile(new URL('../mobile/src/lib/notification-navigation.ts', import.meta.url), 'utf8'));
const navigation = {};
vm.runInNewContext(navigationCode, { exports: navigation });

test('private QA requires the pinned sandbox, closed registration and explicit fixture nomination', () => {
  assert.equal(resolveAskPsiDeviceQa({}).enabled, false);
  assert.equal(resolveAskPsiDeviceQa(valid).enabled, true);
  for (const [key, value] of Object.entries({ flag: 'yes', users: '', review: 'false', googleReview: 'bad', privatePreview: 'false', url: 'https://production.invalid', key: 'other', channel: 'app-store-release', auth: 'false', booking: 'false', registration: 'true', demo: 'bad', purchaseTest: 'true' })) {
    assert.throws(() => resolveAskPsiDeviceQa({ ...valid, [key]: value }), /ASK_PSI_DEVICE_QA/);
  }
  for (const users of [customer + ',' + customer, 'bad-id', Array(5).fill(customer).join(',')]) assert.throws(() => resolveAskPsiDeviceQa({ ...valid, users }));
});

test('customer messages open workshop inbox; workshop replies open customer chat', () => {
  const incoming = navigation.pushNotificationHref({ url: '/staff', kind: 'customer_message_received', askPsiConversationId: conversation });
  assert.equal(incoming.pathname, '/staff-messages');
  const reply = navigation.pushNotificationHref({ url: '/messages', kind: 'staff_message_received', askPsiConversationId: conversation });
  assert.equal(reply.pathname, '/messages');
  assert.equal(reply.params.conversationId, conversation);
  assert.equal(navigation.pushNotificationHref({ url: '/staff-messages', kind: 'customer_message_received', askPsiConversationId: conversation }).pathname, '/staff-messages');
  for (const data of [
    { url: '/messages', kind: 'customer_message_received', askPsiConversationId: conversation },
    { url: '/staff-messages', kind: 'staff_message_received', askPsiConversationId: conversation },
    { url: '/messages', kind: 'staff_message_received', askPsiConversationId: '../private' },
    { url: 'https://other.invalid/messages', kind: 'staff_message_received', askPsiConversationId: conversation },
  ]) assert.equal(navigation.pushNotificationHref(data), null);
});

test('workshop unread classification includes messages without counting customer replies', () => {
  const events = [{ deep_link: '/staff', read_at: null }, { deep_link: '/staff-messages', read_at: null }, { deep_link: '/staff-messages?conversationId=fixture', read_at: 'read' }, { deep_link: '/messages', read_at: null }];
  assert.equal(events.filter(event => !event.read_at && navigation.isWorkshopNotification(event)).length, 2);
});

const qaCode = compile(await readFile(new URL('../mobile/src/lib/ask-psi-device-qa.ts', import.meta.url), 'utf8'));
function qaClient({ buildMarker = true, runtime = QA_RUNTIME, review = true } = {}) {
  const api = {};
  vm.runInNewContext(qaCode, { exports: api, process: { env: {} }, require: name => {
    if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { extra: { psiAskPsiDeviceQa: buildMarker }, runtimeVersion: runtime } } };
    if (name === '../../ask-psi-device-qa.cjs') return { resolveAskPsiDeviceQa: () => resolveAskPsiDeviceQa(valid), QA_RUNTIME };
    if (name === '@/lib/review-environment') return { REVIEW_ENVIRONMENT: { enabled: review } };
    throw Error(name);
  } });
  return api;
}
test('private push exception requires a matching native runtime and nominated signed in user', () => {
  const qa = qaClient();
  assert.equal(qa.ASK_PSI_DEVICE_QA.allowsUser(customer), true);
  assert.equal(qa.ASK_PSI_DEVICE_QA.allowsUser('other'), false);
  assert.equal(qa.ASK_PSI_DEVICE_QA.allowsUser(null), false);
  for (const args of [{ buildMarker: false }, { runtime: '1.0.0' }, { review: false }]) {
    assert.equal(qaClient(args).ASK_PSI_DEVICE_QA.enabled, false);
    assert.equal(qaClient(args).notificationWorkerName(), 'process-push-notifications');
  }
  assert.equal(qa.notificationWorkerName(), 'process-ask-psi-device-qa');
  const data = { psiAskPsiDeviceQa: true, askPsiConversationId: conversation, kind: 'staff_message_received' };
  assert.equal(qa.isAskPsiPush(data), true);
  assert.equal(qa.isAskPsiPush({ ...data, psiAskPsiDeviceQa: false }), false);
  assert.equal(qa.isAskPsiPush({ ...data, kind: 'new_booking_request' }), false);
});

const workerSource = await readFile(new URL('../operations/apple-review/supabase/functions/process-ask-psi-device-qa/index.ts', import.meta.url), 'utf8');
const workerCode = compile(workerSource.replace(/^import .*;\r?\n/gmu, ''));
function worker({ enabled = true, url = REVIEW_URL, user = customer, access = true, read = false, preference = true, provider = 'ok', fixtureUsers = `${customer},${staff}`, start = '2026-10-07T09:00:00Z', deviceTime = '2026-10-07T09:00:00Z', lookupError = null } = {}) {
  let handler;
  const calls = [];
  const receipts = new Map();
  const rows = {
    ask_psi_conversations: access ? [{ id: conversation }] : [],
    notification_events: [{ id: 'event', recipient_user_id: staff, kind: 'customer_message_received', ask_psi_conversation_id: conversation, created_at: '2026-10-07T09:01:00Z', read_at: read ? 'read' : null, source_event_key: 'ask_psi_message:sample:staff' }],
    ask_psi_qa_devices: [{ id: 'device', user_id: staff, expo_push_token: 'ExpoPushToken[fictional]', enabled: true, enabled_at: deviceTime }],
    notification_preferences: [{ user_id: staff, message_alerts_enabled: preference, sound_enabled: false }],
  };
  function from(table) {
    const call = { table, filters: [], values: null, op: 'select' }; calls.push(call);
    let head = false;
    const chain = {
      select(_columns, options = {}) { head = Boolean(options.head); return chain; },
      eq(key, value) { call.filters.push(row => row[key] === value); return chain; },
      in(key, values) { call.filters.push(row => values.includes(row[key])); return chain; },
      is(key, value) { call.filters.push(row => row[key] === value); return chain; },
      gte(key, value) { call.filters.push(row => row[key] >= value); return chain; },
      lte(key, value) { call.filters.push(row => row[key] <= value); return chain; },
      order() { return chain; }, limit() { return chain; },
      insert(values) { call.op = 'insert'; call.values = values; return chain; },
      upsert(values) { call.op = 'upsert'; call.values = values; return chain; },
      update(values) { call.op = 'update'; call.values = values; return chain; },
      maybeSingle() { return Promise.resolve(result(true)); }, single() { return Promise.resolve(result(true)); },
      then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject); },
    };
    function result(single) {
      if (lookupError === table) return { data: null, error: { code: 'lookup_failed' } };
      if (table === 'ask_psi_qa_deliveries') {
        if (call.op === 'insert') {
          const key = `${call.values.event_id}:${call.values.device_id}`;
          if (receipts.has(key)) return { data: null, error: { code: '23505' } };
          const receipt = { id: key, ...call.values }; receipts.set(key, receipt); return { data: receipt, error: null };
        }
        for (const receipt of receipts.values()) if (call.filters.every(filter => filter(receipt))) Object.assign(receipt, call.values);
        return { data: null, error: null };
      }
      const matches = (rows[table] ?? []).filter(row => call.filters.every(filter => filter(row)));
      if (call.op === 'update') for (const row of matches) Object.assign(row, call.values);
      return { data: head ? null : single ? matches[0] ?? null : matches, count: matches.length, error: null };
    }
    return chain;
  }
  let fetches = 0;
  let payload;
  vm.runInNewContext(workerCode, {
    exports: {}, Response, Date, AbortSignal,
    Deno: { env: { get: name => ({ SUPABASE_URL: url, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', PSI_ASK_PSI_DEVICE_QA_ENABLED: enabled ? 'true' : 'false', PSI_ASK_PSI_DEVICE_QA_USERS: fixtureUsers, PSI_ASK_PSI_DEVICE_QA_SESSION_START: start })[name] }, serve: next => { handler = next; } },
    createClient: () => ({ from, auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) } }),
    fetch: async (_url, options) => {
      fetches += 1; payload = JSON.parse(options.body);
      if (provider === 'throw') throw Error('Unknown provider result');
      return Response.json({ data: provider === 'ok' ? { status: 'ok', id: 'ticket' } : { status: 'error', details: { error: 'DeviceNotRegistered' } } });
    },
  });
  return { calls, receipts, rows, get fetches() { return fetches; }, get payload() { return payload; }, invoke: (body = { action: 'dispatch', askPsiConversationId: conversation }, token = 'session') => handler(new Request('https://worker.invalid', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })) };
}

test('disabled, wrong project, invalid session and unrelated accounts never touch delivery storage or Expo', async () => {
  for (const [args, status] of [[{ enabled: false }, 503], [{ url: 'https://production.invalid' }, 403], [{ user: null }, 401], [{ user: 'someone-else' }, 403], [{ fixtureUsers: '' }, 503], [{ start: '' }, 503]]) {
    const api = worker(args); assert.equal((await api.invoke()).status, status); assert.equal(api.calls.length, 0); assert.equal(api.fetches, 0);
  }
  const api = worker(); assert.equal((await api.invoke(undefined, 'service')).status, 401);
});
test('unscoped queue and inaccessible conversations are rejected without sends', async () => {
  for (const body of [{ action: 'process_queue' }, { action: 'dispatch' }, { action: 'send_test_alerts' }]) {
    const api = worker(); assert.equal((await api.invoke(body)).status, 400); assert.equal(api.fetches, 0);
  }
  const api = worker({ access: false }); assert.equal((await api.invoke()).status, 403); assert.equal(api.fetches, 0);
});
test('device registration writes only the isolated QA registry and preserves current opt-in time', async () => {
  const api = worker({ user: staff });
  assert.equal((await api.invoke({ action: 'register_device', expoPushToken: 'ExpoPushToken[fictional]', platform: 'android' })).status, 200);
  assert.equal(api.calls.find(call => call.op === 'upsert').values.enabled_at, '2026-10-07T09:00:00Z');
  assert.ok(api.calls.every(call => call.table === 'ask_psi_qa_devices'));
  assert.equal(api.fetches, 0);
  assert.equal((await api.invoke({ action: 'register_device', expoPushToken: 'bad', platform: 'android' })).status, 400);
});
test('new unread nominated messages reserve each device once and use private content free payloads', async () => {
  const api = worker();
  assert.equal((await api.invoke()).status, 200);
  assert.equal(api.fetches, 1);
  assert.equal(api.payload.channelId, 'psi-message-test-silent');
  assert.equal(api.payload.sound, null);
  assert.equal(api.payload.data.url, '/staff-messages');
  assert.equal(api.payload.data.psiAskPsiDeviceQa, true);
  assert.equal(api.payload.badge, 1);
  assert.equal((await api.invoke()).status, 200);
  assert.equal(api.fetches, 1);
  assert.equal([...api.receipts.values()][0].status, 'submitted');
  assert.equal(api.calls.some(call => ['push_devices','push_notification_jobs','ask_psi_email_jobs'].includes(call.table)), false);
});
test('read, opted out, pre-session and pre-device messages do not send', async () => {
  for (const args of [{ read: true }, { preference: false }, { start: '2026-10-07T09:02:00Z' }, { deviceTime: '2026-10-07T09:02:00Z' }, { fixtureUsers: customer }]) {
    const api = worker(args); assert.equal((await api.invoke()).status, 200); assert.equal(api.fetches, 0);
  }
});
test('ambiguous provider outcomes remain held, never resent', async () => {
  const api = worker({ provider: 'throw' }); await api.invoke(); await api.invoke();
  assert.equal(api.fetches, 1); assert.equal([...api.receipts.values()][0].status, 'unknown');
});
test('unregistered provider token disables only that QA device', async () => {
  const api = worker({ provider: 'rejected' }); await api.invoke();
  assert.equal(api.rows.ask_psi_qa_devices[0].enabled, false);
  assert.equal([...api.receipts.values()][0].status, 'rejected');
});
test('unavailable preferences or device lookup cannot silently allow a push', async () => {
  for (const lookupError of ['notification_preferences','ask_psi_qa_devices','notification_events']) {
    const api = worker({ lookupError }); assert.equal((await api.invoke()).status, 500); assert.equal(api.fetches, 0);
  }
});

const notificationCode = compile(await readFile(new URL('../mobile/src/lib/notifications.tsx', import.meta.url), 'utf8'));
const lifecycle = {};
vm.runInNewContext(compile(await readFile(new URL('../mobile/src/lib/notification-lifecycle.ts', import.meta.url), 'utf8')), { exports: lifecycle });
function notificationClient({ review = true, qa = false, user = customer } = {}) {
  const api = {};
  const calls = [];
  let foregroundHandler;
  const client = {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    functions: { invoke: async (name, args) => { calls.push({ name, args }); return { error: null }; } },
    from(table) {
      const call = { table }; calls.push(call);
      const chain = { update(value) { call.value = value; return chain; }, eq(key, value) { call[key] = value; return chain; }, select() { return chain; }, single: async () => ({ data: {}, error: null }) };
      return chain;
    },
  };
  const allowed = id => qa && [customer, staff].includes(id);
  vm.runInNewContext(notificationCode, { exports: api, Date, require: name => {
    if (name === 'expo-constants') return { __esModule: true, default: { nativeAppVersion: '1.0.2', expoConfig: { extra: { eas: { projectId: 'existing-project' } } } } };
    if (name === 'expo-device') return { isDevice: true };
    if (name === 'expo-secure-store') return {
      getItemAsync: async key => { calls.push({ storageRead: key }); return 'ExpoPushToken[fictional]'; },
      setItemAsync: async () => {}, deleteItemAsync: async () => {},
    };
    if (name === 'expo-notifications') return {
      setNotificationHandler: value => { foregroundHandler = value.handleNotification; },
      getPermissionsAsync: async () => { calls.push({ permissions: true }); return { status: 'granted', ios: { status: 2, alertStyle: 1 } }; },
      IosAuthorizationStatus: { AUTHORIZED: 2, NOT_DETERMINED: 0 }, IosAlertStyle: { NONE: 0 },
      getExpoPushTokenAsync: async () => ({ data: 'ExpoPushToken[fictional]' }), setBadgeCountAsync: async () => {},
    };
    if (name === 'expo-router') return { useRouter: () => ({ push() {} }) };
    if (name === 'react-native') return { Platform: { OS: 'ios' }, AppState: { currentState: 'active' } };
    if (name === 'react') return {
      createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
      useCallback: callback => callback, useMemo: factory => factory(), useRef: value => ({ current: value }),
      useState: value => [typeof value === 'function' ? value() : value, () => {}],
      useEffect: callback => { if (/scope\.data\.open|foregroundQaUserId = userId/.test(callback.toString())) callback(); },
    };
    if (name === 'react/jsx-runtime') return { jsx: (_component, props) => props.value };
    if (name === '@/lib/customer-auth-context') return { useCustomerAuth: () => ({ status: user ? 'signed_in' : 'signed_out', user: { id: user } }) };
    if (name === '@/lib/notification-lifecycle') return lifecycle;
    if (name === '@/lib/notification-navigation') return navigation;
    if (name === '@/lib/ask-psi-device-qa') return { ASK_PSI_DEVICE_QA: { enabled: qa, allowsUser: allowed }, isAskPsiPush: qaClient().isAskPsiPush, notificationWorkerName: () => qa ? 'process-ask-psi-device-qa' : 'process-push-notifications' };
    if (name === '@/lib/supabase') return { getSupabaseClient: () => client, SUPABASE_CONNECTION: { authEnabled: true } };
    if (name === '@/lib/review-environment') return { REVIEW_ENVIRONMENT: { enabled: review }, appModeRuntime: { ready: true }, environmentStorageKey: key => `${review ? 'review' : 'live'}:${key}` };
    throw Error(name);
  } });
  const controls = api.NotificationProvider({ children: null });
  return { api, controls, calls, foreground: data => foregroundHandler({ request: { content: { data, sound: 'default' } } }) };
}

test('message alert opt-out changes the message preference and leaves sound independent', async () => {
  const app = notificationClient();
  await app.controls.setPreference('message_alerts_enabled', false);
  const change = app.calls.find(call => call.table === 'notification_preferences');
  assert.equal(change.value.message_alerts_enabled, false);
  assert.equal('sound_enabled' in change.value, false);
  assert.equal(change.user_id, customer);
  await app.controls.setPreference('sound_enabled', false);
  assert.equal(app.calls.filter(call => call.table)[1].value.sound_enabled, false);
});
test('ordinary review and unrelated QA users cannot register or unregister a native device', async () => {
  for (const options of [{}, { qa: true, user: 'other' }, { qa: true, user: null }]) {
    const app = notificationClient(options);
    await assert.rejects(app.controls.enablePush(), /REVIEW_EXTERNAL_PUSH_DISABLED/);
    await app.controls.disablePush();
    await app.api.unregisterCurrentPushDevice();
    assert.equal(app.calls.length, 0);
    assert.equal((await app.foreground({ psiAskPsiDeviceQa: true, kind: 'staff_message_received', askPsiConversationId: conversation })).shouldShowBanner, false);
  }
});
test('nominated QA device uses separate consent keys and only the dedicated registry worker', async () => {
  const app = notificationClient({ qa: true });
  await app.controls.enablePush();
  await app.controls.disablePush();
  const functions = app.calls.filter(call => call.name);
  assert.equal(functions.length, 2);
  assert.ok(functions.every(call => call.name === 'process-ask-psi-device-qa'));
  assert.equal(functions[0].args.body.action, 'register_device');
  assert.equal(functions[1].args.body.action, 'unregister_device');
  const payload = { psiAskPsiDeviceQa: true, kind: 'staff_message_received', askPsiConversationId: conversation };
  assert.equal((await app.foreground(payload)).shouldShowBanner, true);
  assert.equal((await app.foreground({ ...payload, psiAskPsiDeviceQa: false })).shouldShowBanner, false);
  await app.api.unregisterCurrentPushDevice();
  assert.ok(app.calls.some(call => call.storageRead === 'review:psi-notifications.qa-expo-push-token'));
});
test('private QA continues blocking booking, car sale, event and owner test sends', async () => {
  const app = notificationClient({ qa: true });
  await app.api.dispatchBookingPushNotifications(conversation);
  await app.api.dispatchCustomerCarSalePushNotifications(conversation);
  await app.api.dispatchPsiEventPushNotifications();
  await assert.rejects(app.api.sendTestPushNotifications(), /REVIEW_EXTERNAL_PUSH_DISABLED/);
  assert.equal(app.calls.length, 0);
});
test('normal public device registration still uses the existing worker', async () => {
  const app = notificationClient({ review: false });
  await app.controls.enablePush();
  assert.equal(app.calls.find(call => call.name).name, 'process-push-notifications');
});
