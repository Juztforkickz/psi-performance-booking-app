import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const files = new Map(await Promise.all([
  ['thread', '../mobile/src/components/ask-psi-thread.tsx', 'AskPsiThreadContent'],
  ['messages', '../mobile/src/app/messages.tsx', 'SignedInMessages'],
  ['launcher', '../mobile/src/components/ask-psi-launcher.tsx', 'AskPsiLauncher'],
].map(async ([name, path, exportName]) => [name, ts.transpileModule(
  (await readFile(new URL(path, import.meta.url), 'utf8')) + '\nexport { ' + exportName + ' };',
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } },
).outputText])));

const fixture = () => ({
  conversation: { id: 'conversation-a', topic: 'service' },
  messages: [{ id: 'incoming-a', sender_kind: 'staff', body: 'Your car is ready', created_at: '2026-10-07T01:10:00Z', recipient_read_at: null }],
  attachments: [],
});

// Exercise actual component actions and deferred responses without connecting
// to customer data. Device layout and operating system keyboard behavior remain
// separate inspection checks.
function mount(name, exportName, props = {}, overrides = {}) {
  const slots = [];
  const effects = [];
  const timeouts = new Set();
  const foregroundListeners = new Set();
  const keyboardListeners = new Map();
  let cursor = 0;
  let dirty = false;
  let tree;
  let focusCleanup;
  let subscribed;
  let uuid = 0;
  const jsx = (type, attributes, key) => ({ type, props: attributes ?? {}, key });
  const hooks = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      const before = slots[index];
      if (!before || dependencies.some((value, i) => !Object.is(value, before.dependencies[i]))) slots[index] = { callback, dependencies };
      return slots[index].callback;
    },
    useMemo(factory, dependencies) { return hooks.useCallback(factory, dependencies)(); },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const before = slots[index];
      if (!before || dependencies.some((value, i) => !Object.is(value, before.dependencies[i]))) {
        slots[index] = { dependencies, cleanup: undefined };
        effects.push(() => { before?.cleanup?.(); slots[index].cleanup = callback(); });
      }
    },
  };
  const router = { replace() {}, push() {}, back() {}, setParams() {}, canGoBack: () => false };
  const api = {
    loadAskPsiConversation: async () => fixture(),
    markAskPsiConversationRead: async () => '2026-10-07T01:12:00Z',
    sendAskPsiTextMessage: async () => undefined,
    sendAskPsiPhotoMessage: async () => undefined,
    listAskPsiConversations: async () => [],
    openAskPsiConversation: async () => ({ conversation_id: 'conversation-a' }),
    subscribeToAskPsiConversation: (_id, callback) => { subscribed = callback; return () => { subscribed = undefined; }; },
    subscribeToAskPsiInbox: callback => { subscribed = callback; return () => { subscribed = undefined; }; },
    ...overrides.api,
  };
  const modules = {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': {
      ActivityIndicator: 'ActivityIndicator', Image: 'Image', KeyboardAvoidingView: 'KeyboardAvoidingView',
      Modal: 'Modal', Pressable: 'Pressable', RefreshControl: 'RefreshControl', ScrollView: 'ScrollView',
      Text: 'Text', TextInput: 'TextInput', View: 'View', Platform: { OS: 'ios' },
      StyleSheet: { create: styles => styles },
      Keyboard: { dismiss() {}, addListener(event, callback) { keyboardListeners.set(event, callback); return { remove() { keyboardListeners.delete(event); } }; } },
      AppState: { currentState: 'active', addEventListener(_event, callback) { foregroundListeners.add(callback); return { remove() { foregroundListeners.delete(callback); } }; } },
    },
    'expo-router': {
      useRouter: () => router,
      usePathname: () => overrides.path ?? '/',
      useLocalSearchParams: () => overrides.params ?? {},
      useFocusEffect(callback) {
        hooks.useEffect(() => { focusCleanup = callback(); return () => focusCleanup?.(); }, [callback]);
      },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 34, right: 0 }) },
    '@expo/vector-icons/Ionicons': { default: 'Icon' },
    'expo-crypto': { randomUUID: () => 'nonce-' + ++uuid },
    'expo-image-picker': {
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
      launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: 'file://private-photo.jpg', mimeType: 'image/jpeg', width: 400, height: 300 }] }),
      ...overrides.picker,
    },
    '@/constants/brand': { colors: { accent: '#00BBFF', ink: '#000', white: '#FFF' } },
    '@/lib/ask-psi-messaging': api,
    '@/lib/ask-psi-stage': { ASK_PSI_STAGE: { privatePreviewEnabled: overrides.privatePreview ?? true } },
    '@/lib/theme-preference': { useThemePreference: () => ({ theme: {} }) },
    '@/lib/customer-auth-context': { useCustomerAuth: () => overrides.auth ?? { status: 'signed_in', user: { id: 'customer-a' } } },
    '@/lib/customer-account-context': { useCustomerAccount: () => ({ account: { vehicles: [] } }) },
    '@/components/ask-psi-thread': { AskPsiThread: 'AskPsiThread' },
    '@/components/ui': { PrimaryButton: 'PrimaryButton' },
    '../../assets/images/boost-assistant.png': 'boost.png',
  };
  const exports = {};
  vm.runInNewContext(files.get(name), {
    exports,
    require(id) { assert.ok(id in modules, 'Unexpected dependency ' + id); return modules[id]; },
    setTimeout(callback) { timeouts.add(callback); return callback; },
    clearTimeout(callback) { timeouts.delete(callback); },
    setInterval() { return 1; },
    clearInterval() {},
  });
  const render = () => {
    cursor = 0; dirty = false;
    tree = exports[exportName](props);
    for (const effect of effects.splice(0)) effect();
  };
  const nodes = () => {
    const result = [];
    const visit = node => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      result.push(node);
      if (node.type !== 'Modal' || node.props.visible) visit(node.props.children);
    };
    visit(tree);
    return result;
  };
  const text = (root = tree) => {
    if (Array.isArray(root)) return root.map(text).join(' ');
    if (root == null || typeof root === 'boolean') return '';
    if (typeof root !== 'object') return String(root);
    if (root.type === 'Modal' && !root.props.visible) return '';
    return root.props.children === undefined ? '' : text(root.props.children);
  };
  const find = (type, predicate = () => true) => nodes().find(node => node.type === type && predicate(node.props));
  return {
    render, nodes, text, find, tree: () => tree,
    async settle() {
      for (let index = 0; index < 12; index++) {
        for (const timer of Array.from(timeouts)) { timeouts.delete(timer); timer(); }
        await new Promise(resolve => setImmediate(resolve));
        if (dirty) render();
      }
    },
    press(label) {
      const node = nodes().find(node => node.props.accessibilityLabel === label
        || node.props.label === label || (node.type === 'Pressable' && text(node).trim() === label));
      assert.ok(node, 'Missing control: ' + label);
      assert.notEqual(node.props.disabled, true, 'Disabled control: ' + label);
      node.props.onPress();
    },
    foreground(state) { for (const listener of foregroundListeners) listener(state); },
    keyboard(event) { keyboardListeners.get(event)?.(); },
    notify() { subscribed?.(); },
    blur() { focusCleanup?.(); },
  };
}

test('Thread keeps an uncertain text send and retries with the same nonce', async () => {
  const calls = [];
  let succeed = false;
  const app = mount('thread', 'AskPsiThreadContent', { conversationId: 'conversation-a', role: 'customer' }, {
    api: { sendAskPsiTextMessage: async (...args) => { calls.push(args); if (!succeed) throw new Error('connection_lost'); } },
  });
  app.render(); await app.settle();
  app.find('TextInput').props.onChangeText('Can I collect tomorrow?');
  app.render();
  app.press('Send message');
  app.press('Send message');
  await app.settle();
  assert.equal(calls.length, 1, 'Rapid second tap must not submit twice');
  assert.equal(app.find('TextInput').props.value, 'Can I collect tomorrow?');
  assert.match(app.text(), /Tap Send to retry safely/);
  succeed = true;
  app.press('Send message'); await app.settle();
  assert.equal(calls.length, 2);
  assert.equal(calls[0][2], calls[1][2], 'Uncertain retry must reuse the original idempotency key');
  assert.equal(app.find('TextInput').props.value, '');
});

test('Thread does not force scroll or mark incoming messages read while reading older history', async () => {
  const reads = [];
  const data = fixture();
  data.messages.push({ id: 'own-newer', sender_kind: 'customer', body: 'Thanks', created_at: '2026-10-07T01:11:00Z', recipient_read_at: null });
  let loads = 0;
  const app = mount('thread', 'AskPsiThreadContent', { conversationId: 'conversation-a', role: 'customer' }, {
    api: { loadAskPsiConversation: async () => { loads++; return structuredClone(data); }, markAskPsiConversationRead: async (...args) => { reads.push(args); data.messages[0].recipient_read_at = '2026-10-07T01:12:00Z'; } },
  });
  app.render(); await app.settle();
  let scrolled = 0;
  const scroll = app.find('ScrollView');
  scroll.props.ref.current = { scrollToEnd() { scrolled++; } };
  scroll.props.onScroll({ nativeEvent: { contentSize: { height: 1500 }, layoutMeasurement: { height: 500 }, contentOffset: { y: 300 } } });
  scroll.props.onContentSizeChange();
  app.render(); await app.settle();
  assert.equal(scrolled, 0);
  assert.equal(reads.length, 0);
  app.foreground('background');
  const previousLoads = loads;
  app.notify(); await app.settle();
  assert.equal(loads, previousLoads, 'Background realtime event must not fetch or mark messages read');
  app.foreground('active'); await app.settle();
  app.press('Latest messages'); await app.settle();
  assert.equal(reads.length, 1);
  assert.equal(reads[0][1], 'incoming-a', 'Read watermark must identify newest loaded incoming message, never own newer message');
  app.blur();
  app.notify(); await app.settle();
  assert.equal(reads.length, 1);
});

test('Read receipt uses actual first read time and does not call a saved message Delivered', async () => {
  const data = fixture();
  data.messages = [
    { id: 'mine-a', sender_kind: 'customer', body: 'One', created_at: '2026-10-07T01:10:00Z', recipient_read_at: null },
    { id: 'mine-b', sender_kind: 'customer', body: 'Two', created_at: '2026-10-07T01:11:00Z', recipient_read_at: '2026-10-07T01:12:00Z' },
  ];
  const app = mount('thread', 'AskPsiThreadContent', { conversationId: 'conversation-a', role: 'customer' }, { api: { loadAskPsiConversation: async () => data } });
  app.render(); await app.settle();
  assert.match(app.text(), /Sent/);
  assert.match(app.text(), /Read 7 Oct/);
  assert.doesNotMatch(app.text(), /Delivered/);
});

test('Photo retry preserves upload identifiers and picker failure is handled', async () => {
  const calls = [];
  let succeed = false;
  const app = mount('thread', 'AskPsiThreadContent', { conversationId: 'conversation-a', role: 'customer' }, {
    api: { sendAskPsiPhotoMessage: async (_id, photo) => { calls.push(photo); if (!succeed) throw new Error('timeout'); } },
  });
  app.render(); await app.settle();
  app.press('Attach a photo'); await app.settle();
  assert.match(app.text(), /Retry photo/);
  succeed = true;
  app.press('Retry photo'); await app.settle();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].clientNonce, calls[1].clientNonce);
  assert.equal(calls[0].messageId, calls[1].messageId);
  assert.doesNotMatch(app.text(), /Photo awaiting confirmation/);
  const brokenPicker = mount('thread', 'AskPsiThreadContent', { conversationId: 'conversation-a', role: 'customer' }, {
    picker: { requestMediaLibraryPermissionsAsync: async () => { throw new Error('picker unavailable'); } },
  });
  brokenPicker.render(); await brokenPicker.settle();
  brokenPicker.press('Attach a photo'); await brokenPicker.settle();
  assert.match(brokenPicker.text(), /Photos could not be opened/);
});

test('Failed thread load offers Retry and never enables send to an unverified conversation', async () => {
  let fail = true;
  const app = mount('thread', 'AskPsiThreadContent', { conversationId: 'conversation-a', role: 'customer' }, {
    api: { loadAskPsiConversation: async () => { if (fail) throw new Error('offline'); return fixture(); } },
  });
  app.render(); await app.settle();
  assert.equal(app.find('Pressable', props => props.accessibilityLabel === 'Attach a photo').props.disabled, true);
  fail = false;
  app.press('Retry'); await app.settle();
  assert.match(app.text(), /Your car is ready/);
  assert.equal(app.find('Pressable', props => props.accessibilityLabel === 'Attach a photo').props.disabled, false);
});

test('Unavailable photo keeps its caption and other messages readable and can be refreshed', async () => {
  const data = fixture();
  data.messages.push({ id: 'photo-a', sender_kind: 'customer', message_kind: 'photo', body: 'The warning on my dashboard', created_at: '2026-10-07T01:11:00Z', recipient_read_at: null });
  data.attachments.push({ message_id: 'photo-a', signedUrl: null });
  let loads = 0;
  const app = mount('thread', 'AskPsiThreadContent', { conversationId: 'conversation-a', role: 'customer' }, { api: { loadAskPsiConversation: async () => { loads++; return data; } } });
  app.render(); await app.settle();
  assert.match(app.text(), /Your car is ready/);
  assert.match(app.text(), /The warning on my dashboard/);
  assert.match(app.text(), /Photo unavailable/);
  app.press('Refresh unavailable photo'); await app.settle();
  assert.equal(loads, 2);
});

test('Customer screen gates private routes and resets account scoped screen identity', async () => {
  const hidden = mount('messages', 'default', {}, { privatePreview: false });
  hidden.render(); await hidden.settle();
  assert.equal(hidden.nodes().some(node => node.type === 'AskPsiThread'), false);
  assert.equal(hidden.nodes().some(node => typeof node.type === 'function'), false);
  const signedOut = mount('messages', 'default', {}, { auth: { status: 'signed_out', user: null }, params: { conversationId: 'private-id' } });
  signedOut.render(); await signedOut.settle();
  assert.match(signedOut.text(), /Sign in with your PSI account/);
  assert.equal(signedOut.nodes().some(node => node.type === 'AskPsiThread'), false);
  const first = mount('messages', 'default', {}, { auth: { status: 'signed_in', user: { id: 'customer-a' } } });
  const second = mount('messages', 'default', {}, { auth: { status: 'signed_in', user: { id: 'customer-b' } } });
  first.render(); second.render();
  assert.equal(first.tree().key, 'customer-a');
  assert.equal(second.tree().key, 'customer-b');
});

test('New question supports keyboard dismissal, realtime unread counts and a safe retry', async () => {
  const calls = [];
  let succeed = false;
  const app = mount('messages', 'SignedInMessages', {}, {
    api: {
      listAskPsiConversations: async () => [{ id: 'conversation-a', topic: 'service', status: 'awaiting_psi', last_message_at: '2026-10-07T01:10:00Z', customer_last_read_at: null, unread_count: 0 }],
      openAskPsiConversation: async input => { calls.push(input); if (!succeed) throw new Error('timeout'); return { conversation_id: 'conversation-new' }; },
    },
  });
  app.render(); await app.settle();
  assert.equal(app.nodes().some(node => node.props.accessibilityLabel === 'Unread reply'), false, 'Own latest message must not become an unread reply');
  app.press('New question'); app.render();
  assert.ok(app.find('KeyboardAvoidingView'));
  assert.equal(app.find('ScrollView').props.keyboardDismissMode, 'interactive');
  assert.ok(app.find('Pressable', props => props.accessibilityLabel === 'Hide keyboard'));
  app.find('TextInput').props.onChangeText('Please check the front brakes');
  app.render();
  app.press('Send to PSI'); await app.settle();
  assert.equal(app.find('TextInput').props.value, 'Please check the front brakes');
  succeed = true;
  app.press('Send to PSI'); await app.settle();
  assert.equal(calls[0].clientNonce, calls[1].clientNonce);
  assert.ok(app.find('AskPsiThread', props => props.conversationId === 'conversation-new'));
});

test('Boost stays out of staff inbox and keyboard controls', async () => {
  const staff = mount('launcher', 'AskPsiLauncher', {}, { path: '/staff-messages' });
  staff.render();
  assert.equal(staff.tree(), null);
  const app = mount('launcher', 'AskPsiLauncher');
  app.render();
  assert.equal(app.tree().props.style[1].bottom, 112);
  app.keyboard('keyboardDidShow'); app.render();
  assert.equal(app.tree(), null);
});
