import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('../mobile/node_modules/typescript');
const routeSource = await readFile(new URL('../mobile/src/app/staff-messages.tsx', import.meta.url), 'utf8');
const routeJs = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Exercise route behavior with controllable auth events and delayed verification.
// This does not replace native layout or authenticator testing.
function mountRoute({ enabled = true, authEnabled = true } = {}) {
  const slots = [];
  const effectSlots = [];
  let cursor = 0;
  let effects = [];
  let nodes = [];
  const auth = { user: { id: 'staff-a' }, sessionRevision: 1, status: 'signed_in' };
  const verifications = [];
  const navigations = [];
  const router = { replace: (path) => navigations.push(path), push: (path) => navigations.push(path) };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
      },
      useEffect(callback, dependencies) {
        const index = cursor++;
        const previous = effectSlots[index];
        if (!previous || dependencies.some((value, dependency) => value !== previous.dependencies[dependency])) {
          effects.push(() => {
            previous?.cleanup?.();
            effectSlots[index] = { dependencies, cleanup: callback() };
          });
        }
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({ conversationId: 'conversation-a' }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View', StyleSheet: { create: (styles) => styles } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/staff-ask-psi-inbox': { StaffAskPsiInbox: 'StaffAskPsiInbox' },
    '@/components/ui': { PrimaryButton: 'Button' },
    '@/lib/ask-psi-stage': { ASK_PSI_STAGE: { privatePreviewEnabled: enabled } },
    '@/lib/customer-auth': { CUSTOMER_AUTH: { enabled: authEnabled } },
    '@/lib/customer-auth-context': { useCustomerAuth: () => auth },
    '@/lib/staff-portal': { loadStaffPortalAccess: () => new Promise((resolve, reject) => verifications.push({ resolve, reject })) },
    '@/lib/theme-preference': { useThemePreference: () => ({ theme: {} }) },
  };
  const result = { exports: {} };
  vm.runInNewContext(routeJs, {
    exports: result.exports,
    require(name) { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; },
  });
  const flatten = (node) => {
    if (node == null || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(flatten);
    if (typeof node.type === 'function') return flatten(node.type(node.props));
    return [node, ...flatten(node.props.children)];
  };
  return {
    auth,
    verifications,
    navigations,
    render() {
      cursor = 0;
      effects = [];
      nodes = flatten(result.exports.default());
      effects.forEach((effect) => effect());
    },
    find(type, predicate = () => true) { return nodes.find((node) => node.type === type && predicate(node)); },
  };
}

const staffAccess = { kind: 'ready', staff: { user_id: 'staff-a' }, snapshot: { customers: [], vehicles: [], archivedVehicles: [] } };
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('public builds and disabled secure access never query or mount customer messages', () => {
  for (const options of [{ enabled: false }, { authEnabled: false }]) {
    const route = mountRoute(options);
    route.render();
    assert.equal(route.verifications.length, 0);
    assert.equal(route.find('StaffAskPsiInbox'), undefined);
  }
});

test('staff inbox only mounts after protected access succeeds, with a workshop exit', async () => {
  const route = mountRoute();
  route.render();
  assert.ok(route.find('ActivityIndicator'));
  assert.equal(route.find('StaffAskPsiInbox'), undefined);
  route.verifications[0].resolve(staffAccess);
  await settle();
  route.render();
  const inbox = route.find('StaffAskPsiInbox');
  assert.equal(inbox.props.staffUserId, 'staff-a');
  assert.equal(inbox.props.initialConversationId, 'conversation-a');
  inbox.props.onBack();
  assert.deepEqual(route.navigations, ['/staff']);
});

test('account changes hide the old staff snapshot immediately, before new verification completes', async () => {
  const route = mountRoute();
  route.render();
  route.verifications[0].resolve(staffAccess);
  await settle();
  route.render();
  assert.ok(route.find('StaffAskPsiInbox'));

  route.auth.user = { id: 'customer-b' };
  route.auth.sessionRevision += 1;
  route.render();
  assert.equal(route.find('StaffAskPsiInbox'), undefined);
  assert.ok(route.find('ActivityIndicator'));
  route.verifications[1].resolve({ kind: 'access_denied' });
  await settle();
  route.render();
  assert.equal(route.find('StaffAskPsiInbox'), undefined);
  assert.ok(route.find('Text', (node) => node.props.children === 'Access denied'));
});

test('late access results from the previous session cannot reveal staff messages', async () => {
  const route = mountRoute();
  route.render();
  route.auth.sessionRevision += 1;
  route.render();
  route.verifications[0].resolve(staffAccess);
  await settle();
  route.render();
  assert.equal(route.find('StaffAskPsiInbox'), undefined);
  assert.ok(route.find('ActivityIndicator'));
  route.verifications[1].resolve({ kind: 'mfa_required' });
  await settle();
  route.render();
  assert.equal(route.find('StaffAskPsiInbox'), undefined);
  assert.ok(route.find('Text', (node) => node.props.children === 'Authenticator required'));
});

test('connection failures can be retried without treating the staff identity as denied', async () => {
  const route = mountRoute();
  route.render();
  route.verifications[0].reject(new Error('offline'));
  await settle();
  route.render();
  assert.ok(route.find('Text', (node) => node.props.children === 'Connection needed'));
  route.find('Button', (node) => node.props.label === 'Try again').props.onPress();
  route.render();
  assert.ok(route.find('ActivityIndicator'));
  assert.equal(route.verifications.length, 2);
  route.verifications[1].resolve(staffAccess);
  await settle();
  route.render();
  assert.ok(route.find('StaffAskPsiInbox'));
});

test('signed out sessions never retain the previous customer inbox', async () => {
  const route = mountRoute();
  route.render();
  route.verifications[0].resolve(staffAccess);
  await settle();
  route.render();
  route.auth.status = 'signed_out';
  route.auth.user = null;
  route.render();
  assert.equal(route.find('StaffAskPsiInbox'), undefined);
  assert.ok(route.find('Text', (node) => node.props.children === 'Staff sign in required'));
});

const inboxSource = await readFile(new URL('../mobile/src/components/staff-ask-psi-inbox.tsx', import.meta.url), 'utf8');
const inboxJs = ts.transpileModule(inboxSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderInbox(conversations, selectedId = '') {
  const slots = [conversations, selectedId, 'open', false, false, false, '', ''];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const modules = {
    react: {
      useState: () => [slots[cursor++], () => {}],
      useRef: (value) => ({ current: value }),
      useMemo: (callback) => callback(),
      useCallback: (callback) => callback,
      useEffect: () => {},
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    'expo-router': { useFocusEffect: () => {} },
    'react-native': { ActivityIndicator: 'ActivityIndicator', AppState: {}, Pressable: 'Pressable', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: (styles) => styles } },
    '@/components/ask-psi-thread': { AskPsiThread: 'AskPsiThread' },
    '@/constants/brand': { colors: {} },
    '@/lib/ask-psi-messaging': {},
    '@/lib/theme-preference': { useThemePreference: () => ({ theme: {} }) },
  };
  const result = { exports: {} };
  vm.runInNewContext(inboxJs, {
    exports: result.exports,
    require(name) { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; },
  });
  const flatten = (node) => {
    if (node == null || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(flatten);
    if (typeof node.type === 'function') return flatten(node.type(node.props));
    return [node, ...flatten(node.props.children)];
  };
  return flatten(result.exports.StaffAskPsiInbox({ snapshot: staffAccess.snapshot, staffUserId: 'staff-a' }));
}

const conversation = { id: 'conversation-a', customer_id: 'customer-a', topic: 'other', status: 'awaiting_psi', assigned_staff_id: null, last_message_at: '2026-10-07T12:00:00Z', staff_last_read_at: null, unread_count: 0 };

test('staff unread badges reflect incoming messages rather than the last activity timestamp', () => {
  const readNodes = renderInbox([conversation]);
  const readCard = readNodes.find((node) => node.type === 'Pressable' && node.props.accessibilityLabel?.startsWith('PSI customer'));
  assert.ok(readCard);
  assert.doesNotMatch(readCard.props.accessibilityLabel, /unread/);

  const unreadNodes = renderInbox([{ ...conversation, staff_last_read_at: '2026-10-07T12:00:00Z', unread_count: 3 }]);
  const unreadCard = unreadNodes.find((node) => node.type === 'Pressable' && node.props.accessibilityLabel?.startsWith('PSI customer'));
  assert.match(unreadCard.props.accessibilityLabel, /3 unread messages/);
});

test('notification links to unavailable conversations explain the result instead of silently showing an empty inbox', () => {
  const nodes = renderInbox([], 'conversation-unavailable');
  assert.ok(nodes.some((node) => node.type === 'Text' && node.props.accessibilityRole === 'alert' && node.props.children.includes('no longer available')));
  assert.equal(nodes.some((node) => node.type === 'AskPsiThread'), false);
});

test('a conversation assigned to the current staff member does not offer a duplicate assignment action', () => {
  const nodes = renderInbox([{ ...conversation, assigned_staff_id: 'staff-a' }], conversation.id);
  const assignment = nodes.find((node) => node.type === 'Pressable' && node.props.children?.props?.children === 'Assigned to you');
  assert.ok(assignment);
  assert.equal(assignment.props.disabled, true);
  const thread = nodes.find((node) => node.type === 'AskPsiThread');
  assert.equal(thread.props.conversationId, conversation.id);
  assert.equal(thread.props.keyboardAvoidanceEnabled, true);
});
