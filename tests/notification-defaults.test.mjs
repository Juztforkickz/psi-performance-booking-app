import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../mobile/src/lib/notification-defaults.ts', import.meta.url), 'utf8');
const defaults = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const lifecycleSource = await readFile(new URL('../mobile/src/lib/notification-lifecycle.ts', import.meta.url), 'utf8');
const lifecycle = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(lifecycleSource)).toString('base64')}`);
const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const providerSource = await readFile(new URL('../mobile/src/lib/notifications.tsx', import.meta.url), 'utf8');
const providerCode = ts.transpileModule(providerSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function providerHarness({ userId = 'account-one', review = false, optedOut = false, permission = 'granted', background = false, registrationError = false } = {}) {
  const effects = [];
  const calls = [];
  const storage = new Map();
  const listeners = [];
  if (optedOut) storage.set(`psi-notifications.device-alerts-enabled.${userId}`, 'false');
  const permissionResult = () => ({ status: permission, canAskAgain: permission !== 'denied' });
  const noopListener = () => ({ remove() {} });
  let contextValue;
  const appState = { currentState: background ? 'background' : 'active', addEventListener: (_name, fn) => { listeners.push(fn); return noopListener(); } };
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useCallback: fn => fn, useContext: () => contextValue,
    useEffect: fn => effects.push(fn), useMemo: fn => fn(),
    useRef: value => ({ current: value }), useState: value => [typeof value === 'function' ? value() : value, () => {}],
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (_type, props) => { contextValue = props.value; return null; } },
    'expo-constants': { __esModule: true, default: { nativeAppVersion: '1.0.2', expoConfig: { extra: { eas: { projectId: 'test-project' } } } } },
    'expo-device': { isDevice: true },
    'expo-notifications': {
      setNotificationHandler() {}, getPermissionsAsync: async () => permissionResult(),
      requestPermissionsAsync: async () => { calls.push('permission'); permission = 'granted'; return permissionResult(); },
      getExpoPushTokenAsync: async () => ({ data: 'mock-token' }), setBadgeCountAsync: async () => {},
      addNotificationReceivedListener: noopListener, addNotificationResponseReceivedListener: noopListener,
      getLastNotificationResponseAsync: async () => null, clearLastNotificationResponseAsync: async () => {},
    },
    'expo-secure-store': {
      getItemAsync: async key => storage.get(key) ?? null,
      setItemAsync: async (key, value) => { storage.set(key, value); },
      deleteItemAsync: async key => { storage.delete(key); },
    },
    'expo-router': { useRouter: () => ({ push() {} }) },
    'react-native': { Platform: { OS: 'android' }, AppState: appState },
    '@/lib/customer-auth-context': { useCustomerAuth: () => ({ status: 'signed_in', user: { id: userId }, sessionRevision: 1 }) },
    '@/lib/notification-lifecycle': lifecycle,
    '@/lib/notification-defaults': defaults,
    '@/lib/notification-navigation': { isWorkshopNotification: () => false, pushNotificationHref: () => null },
    '@/lib/ask-psi-device-qa': { ASK_PSI_DEVICE_QA: { enabled: false, allowsUser: () => false }, isAskPsiPush: () => false, notificationWorkerName: () => 'process-push-notifications' },
    '@/lib/supabase': { SUPABASE_CONNECTION: { authEnabled: true }, getSupabaseClient: () => ({ functions: { invoke: async (_name, { body }) => { calls.push(body.action); return { error: registrationError ? new Error('offline') : null }; } } }) },
    '@/lib/review-environment': { appModeRuntime: { ready: true }, REVIEW_ENVIRONMENT: { enabled: review }, environmentStorageKey: key => key },
  };
  mocks['expo-notifications'].setNotificationChannelAsync = async () => {};
  mocks['expo-notifications'].AndroidImportance = { HIGH: 4 };
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, require: name => { assert.ok(mocks[name], `Unexpected dependency ${name}`); return mocks[name]; }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} };
  vm.runInNewContext(providerCode, sandbox);
  module.exports.NotificationProvider({ children: null });
  const cleanup = effects.map(fn => fn()).filter(fn => typeof fn === 'function');
  return { calls, storage, value: contextValue, cleanup: () => cleanup.forEach(fn => fn()), activate: async () => { appState.currentState = 'active'; listeners.forEach(fn => fn('active')); await settle(); } };
}
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };

test('new and existing live accounts register automatically when phone permission is already granted', async () => {
  const h = providerHarness(); await settle();
  assert.deepEqual(h.calls, ['register_device']);
  assert.equal(h.storage.get('psi-notifications.device-alerts-enabled'), 'true');
  h.cleanup();
});
test('first setup requests phone permission and then registers the phone', async () => {
  const h = providerHarness({ permission: 'undetermined' }); await settle();
  assert.deepEqual(h.calls, ['permission', 'register_device']); h.cleanup();
});
test('a declined phone permission is not requested again automatically', async () => {
  const h = providerHarness({ permission: 'denied' }); await settle(); await h.activate();
  assert.deepEqual(h.calls, []); h.cleanup();
});
test('disabling alerts persists across foreground retries and can be explicitly reversed', async () => {
  const h = providerHarness(); await settle(); await h.value.disablePush(); await h.activate();
  assert.deepEqual(h.calls, ['register_device', 'unregister_device']);
  assert.equal(h.storage.get('psi-notifications.device-alerts-enabled.account-one'), 'false');
  await h.value.enablePush(); await h.activate();
  assert.equal(h.storage.get('psi-notifications.device-alerts-enabled.account-one'), 'true');
  assert.equal(h.calls.filter(x => x === 'register_device').length, 3); h.cleanup();
});
test('an existing explicit opt-out prevents automatic registration', async () => {
  const h = providerHarness({ optedOut: true }); await settle();
  assert.deepEqual(h.calls, []); h.cleanup();
});
test('review apps do not automatically register live devices', async () => {
  const h = providerHarness({ review: true }); await settle();
  assert.deepEqual(h.calls, []); h.cleanup();
});
test('a background startup waits for foreground before asking for permission', async () => {
  const h = providerHarness({ background: true, permission: 'undetermined' }); await settle();
  assert.deepEqual(h.calls, []); await h.activate();
  assert.deepEqual(h.calls, ['permission', 'register_device']); h.cleanup();
});
test('registration failure does not mark the phone enabled and can retry', async () => {
  const h = providerHarness({ registrationError: true }); await settle();
  assert.equal(h.storage.has('psi-notifications.device-alerts-enabled'), false);
  await h.activate(); assert.equal(h.calls.length, 2); h.cleanup();
});
test('another account starts enabled without inheriting the previous account opt-out', () => {
  assert.equal(defaults.shouldAutomaticallyRegisterPush(null, true, 'false', null), true);
  assert.equal(defaults.shouldAutomaticallyRegisterPush('false', true, 'true', 'old-token'), false);
  assert.equal(defaults.shouldAutomaticallyRegisterPush(null, false, null, null), false);
});

