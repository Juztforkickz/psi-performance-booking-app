import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const [accessSource, gateSource, signUpSource] = await Promise.all([
  compile('../mobile/src/lib/customer-access.ts'),
  compile('../mobile/src/components/customer-profile-gate.tsx'),
  compile('../mobile/src/app/account/sign-up.tsx'),
]);
const access = {};
vm.runInNewContext(accessSource, { exports: access });
const { customerAccessState, customerProfileComplete, customerReturnPath, selectAccountBookingVehicle } = access;

const profile = { account_state: 'active', first_name: 'Sample', last_name: 'Customer', mobile: '0400000000' };
const ready = { authEnabled: true, authStatus: 'signed_in', accountStatus: 'ready', hasAccount: true, profile, vehicleCount: 1 };
const vehicle = (id, registration, isPrimary = false) => ({ id, registration, is_primary: isPrimary, customer_id: 'current-customer' });

test('profile completion requires active identity and every required contact field', () => {
  assert.equal(customerProfileComplete(profile), true);
  for (const candidate of [null, undefined, {}, { ...profile, account_state: 'blocked' }]) {
    assert.equal(customerProfileComplete(candidate), false);
  }
  for (const field of ['first_name', 'last_name', 'mobile']) {
    for (const missing of [null, undefined, '', ' \t\n ']) {
      assert.equal(customerProfileComplete({ ...profile, [field]: missing }), false, `${field}: ${String(missing)}`);
    }
  }
});

test('access never trusts stale profile data while signed out or restoring a session', () => {
  assert.equal(customerAccessState(ready), 'ready');
  assert.equal(customerAccessState({ ...ready, authEnabled: false }), 'unavailable');
  assert.equal(customerAccessState({ ...ready, authStatus: 'loading' }), 'loading');
  for (const authStatus of ['signed_out', 'disabled', 'unknown']) {
    assert.equal(customerAccessState({ ...ready, authStatus }), 'sign_in');
  }
  assert.equal(customerAccessState({ ...ready, accountStatus: 'loading' }), 'loading');
  assert.equal(customerAccessState({ ...ready, accountStatus: 'error' }), 'error');
  assert.equal(customerAccessState({ ...ready, hasAccount: false }), 'error');
});

test('incomplete and restricted profiles cannot open a personal editor', () => {
  assert.equal(customerAccessState({ ...ready, profile: null }), 'profile');
  assert.equal(customerAccessState({ ...ready, profile: { ...profile, mobile: '' } }), 'profile');
  for (const account_state of ['suspended', 'closed', 'pending', 'unknown']) {
    assert.equal(customerAccessState({ ...ready, profile: { ...profile, account_state } }), 'restricted');
  }
  assert.equal(customerAccessState({ ...ready, vehicleCount: 0, requireVehicle: true }), 'vehicle');
  assert.equal(customerAccessState({ ...ready, vehicleCount: 0 }), 'ready', 'Messaging does not require a vehicle');
});

test('profile setup may bypass completion but cannot bypass restricted account status', () => {
  assert.equal(customerAccessState({ ...ready, profile: null, vehicleCount: 0, profileRequired: false }), 'ready');
  assert.equal(customerAccessState({ ...ready, profile: { ...profile, account_state: 'blocked' }, profileRequired: false }), 'restricted');
  assert.equal(customerAccessState({ ...ready, profile: null, vehicleCount: 0, profileRequired: false, requireVehicle: true }), 'vehicle');
});

test('post sign-in destinations accept only known local routes and exact booking types', () => {
  const allowed = ['/', '/garage', '/bookings', '/booking', '/account/sign-up', '/account/sign-up?mode=add', '/parts', '/history-import',
    '/vehicle-reports', '/vehicle-vault', '/performance-plus', '/alerts', '/messages', '/customer-cars-for-sale', '/events',
    '/booking?type=service', '/booking?type=dyno'];
  for (const path of allowed) assert.equal(customerReturnPath(path), path);
  assert.equal(customerReturnPath(['/booking?type=service', 'https://outside.example']), '/booking?type=service');
  for (const path of [undefined, '', [], '/staff', '/staff-messages', '/unknown', '/account', 'https://outside.example',
    '//outside.example', 'javascript:alert(1)', '/garage/../staff', '/garage#fragment', '/garage?next=/staff',
    '/booking?type=service&next=https://outside.example', '/booking?type=service&type=dyno', '/booking?type=other',
    '/booking?type=%73ervice', '/booking?type=service#fragment', '/booking?type=service?', '/booking?TYPE=service',
    '/account/sign-up?mode=add&returnTo=/staff', '/account/sign-up?mode=add&mode=edit', '/account/sign-up?mode=edit',
    ' /garage', '/garage ', '\\garage', ['/staff', '/garage']]) {
    assert.equal(customerReturnPath(path), null, JSON.stringify(path));
  }
});

test('booking selection uses the owned account row and never the supplied preview object', () => {
  const first = vehicle('vehicle-a', 'AAA111');
  const primary = vehicle('vehicle-b', 'BBB222', true);
  const cars = [first, primary];
  const pending = { id: first.id, registration: 'untrusted edited value', customer_id: 'someone-else' };
  assert.equal(selectAccountBookingVehicle(cars, pending), first);
  assert.notEqual(selectAccountBookingVehicle(cars, pending), pending);
  assert.equal(selectAccountBookingVehicle(cars, { id: 'old-preview-id', registration: ' aAa 111 ' }), first);
  assert.equal(selectAccountBookingVehicle(cars, { id: 'fictional-demo-car', registration: 'DEMO001' }), primary);
  assert.equal(selectAccountBookingVehicle(cars, null), primary);
  assert.equal(selectAccountBookingVehicle([first], null), first);
  assert.equal(selectAccountBookingVehicle([], pending), undefined);
});

// Render the actual gate with deterministic context values. No network, account
// writes, navigation side effects or customer records are used by this harness.
function gateHarness(initial = {}) {
  const state = { ...ready, review: false, ...initial };
  const calls = [];
  const editor = { type: 'PrivateEditor', props: { children: 'PRIVATE FORM' } };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'expo-router': { useRouter: () => ({ push: path => calls.push(['push', path]), replace: path => calls.push(['replace', path]) }) },
    'react-native': { ActivityIndicator: 'ActivityIndicator', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/ui': { PrimaryButton: 'PrimaryButton' },
    '@/constants/brand': { colors: {}, mobileFrame: {}, spacing: { lg: 20, xl: 28 } },
    '@/hooks/use-responsive-layout': { useResponsiveLayout: () => ({ horizontalPadding: 18 }) },
    '@/lib/customer-account-context': { useCustomerAccount: () => ({
      account: state.hasAccount ? { profile: state.profile, vehicles: Array.from({ length: state.vehicleCount }, () => ({})) } : null,
      status: state.accountStatus, refreshAccount: () => calls.push(['refresh']),
    }) },
    '@/lib/customer-access': access,
    '@/lib/customer-auth': { CUSTOMER_AUTH: { get enabled() { return state.authEnabled; } } },
    '@/lib/customer-auth-context': { useCustomerAuth: () => ({ status: state.authStatus }) },
    '@/lib/review-environment': { REVIEW_ENVIRONMENT: { get enabled() { return state.review; } } },
  };
  const exports = {};
  vm.runInNewContext(gateSource, { exports, require(id) { assert.ok(id in modules, `Unexpected gate dependency ${id}`); return modules[id]; } });
  let tree;
  const render = (props = {}) => {
    tree = exports.CustomerProfileGate({ children: editor, feature: 'booking a service', returnTo: '/booking?type=service', ...props });
    return tree;
  };
  const nodes = (node = tree) => {
    if (Array.isArray(node)) return node.flatMap(item => nodes(item));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children ?? null)];
  };
  const text = (node = tree) => {
    if (Array.isArray(node)) return node.map(item => text(item)).join(' ');
    if (node == null || typeof node === 'boolean') return '';
    return typeof node === 'object' ? text(node.props?.children ?? null) : String(node);
  };
  const press = label => {
    const button = nodes().find(node => node.type === 'PrimaryButton' && node.props.label === label);
    assert.ok(button, `Missing ${label}`);
    button.props.onPress();
  };
  return { state, calls, editor, render, nodes, text, press };
}

test('live guest gate preserves the draft and offers account verification rather than a disabled demo form', () => {
  const gate = gateHarness({ authStatus: 'signed_out' });
  gate.render();
  assert.doesNotMatch(gate.text(), /PRIVATE FORM|Public demo|Submission disabled/);
  assert.match(gate.text(), /booking draft stays on this device/);
  gate.press('Create account or sign in');
  assert.equal(JSON.stringify(gate.calls[0]), JSON.stringify(['push', { pathname: '/account', params: { returnTo: '/booking?type=service' } }]));
  gate.press('Try demonstration');
  assert.equal(gate.calls[1][1], '/demonstration');
});

test('email verification alone cannot mount editors until the saved profile and requested vehicle are ready', () => {
  const gate = gateHarness({ authStatus: 'signed_out', profile: null, vehicleCount: 0 });
  assert.notEqual(gate.render({ requireVehicle: true }), gate.editor);
  gate.state.authStatus = 'signed_in';
  gate.state.profile = { ...profile, mobile: '' };
  assert.notEqual(gate.render({ requireVehicle: true }), gate.editor);
  gate.press('Complete my profile');
  assert.equal(gate.calls[0][1].pathname, '/account/sign-up');
  assert.equal(gate.calls[0][1].params.returnTo, '/booking?type=service');
  gate.state.profile = profile;
  assert.notEqual(gate.render({ requireVehicle: true }), gate.editor);
  gate.press('Add my vehicle');
  gate.state.vehicleCount = 1;
  assert.equal(gate.render({ requireVehicle: true }), gate.editor);
  gate.state.authStatus = 'signed_out';
  assert.notEqual(gate.render({ requireVehicle: true }), gate.editor, 'Signing out removes the editor despite a stale account snapshot');
});

test('invalid return values cannot redirect sign-in outside the known customer routes', () => {
  const gate = gateHarness({ authStatus: 'signed_out' });
  gate.render({ returnTo: 'https://outside.example' });
  gate.press('Create account or sign in');
  assert.equal(gate.calls[0][1].params.returnTo, '/garage');
});

test('an interrupted add-vehicle flow retains its exact destination through the sign-in gate', () => {
  let params = { mode: 'add', returnTo: '/garage' };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react': {},
    'expo-router': { useLocalSearchParams: () => params },
    'react-native': { StyleSheet: { create: value => value } },
    'react-native-safe-area-context': {},
    '@/components/customer-profile-gate': { CustomerProfileGate: 'CustomerProfileGate' },
    '@/lib/customer-access': access,
    '@/constants/brand': { colors: {}, mobileFrame: {}, spacing: {} },
  };
  const exports = {};
  vm.runInNewContext(signUpSource, {
    exports,
    require(id) {
      if (id in modules) return modules[id];
      assert.ok(id.startsWith('@/'), `Unexpected sign-up dependency ${id}`);
      // The wrapper must not invoke account-form hooks or persistence methods.
      return new Proxy({}, { get: () => () => { assert.fail(`Account form mounted before the gate: ${id}`); } });
    },
  });
  const wrapper = exports.default();
  assert.equal(wrapper.type, 'CustomerProfileGate');
  assert.equal(wrapper.props.profileRequired, false, 'An authenticated new customer can complete their profile');
  assert.equal(wrapper.props.returnTo, '/account/sign-up?mode=add');
  const gate = gateHarness({ authStatus: 'signed_out' });
  gate.render({ returnTo: wrapper.props.returnTo, profileRequired: wrapper.props.profileRequired });
  gate.press('Create account or sign in');
  assert.equal(gate.calls[0][1].params.returnTo, '/account/sign-up?mode=add');
  params = { returnTo: '/booking?type=service' };
  assert.equal(exports.default().props.returnTo, '/booking?type=service', 'Profile completion retains the original booking');
  params = { returnTo: 'https://outside.example' };
  assert.equal(exports.default().props.returnTo, '/account/sign-up');
});

test('loading and failed reads do not expose personal forms and failed reads can retry', () => {
  const gate = gateHarness({ accountStatus: 'loading' });
  gate.render();
  assert.ok(gate.nodes().some(node => node.type === 'ActivityIndicator'));
  assert.equal(gate.nodes().some(node => node.type === 'PrimaryButton'), false);
  gate.state.accountStatus = 'error';
  gate.render();
  assert.doesNotMatch(gate.text(), /PRIVATE FORM/);
  gate.press('Try again');
  assert.deepEqual(gate.calls, [['refresh']]);
});

test('restricted accounts get workshop support instead of a profile-edit bypass', () => {
  const gate = gateHarness({ profile: { ...profile, account_state: 'suspended' } });
  gate.render();
  assert.doesNotMatch(gate.text(), /PRIVATE FORM/);
  assert.equal(gate.nodes().some(node => node.props.label === 'Complete my profile'), false);
  gate.press('Contact PSI');
  assert.deepEqual(gate.calls, [['push', '/support']]);
});

test('inline account preferences use a compact gate while reviewer accounts keep their dedicated flow', () => {
  const guest = gateHarness({ authStatus: 'signed_out' });
  guest.render({ inline: true, returnTo: '/alerts', feature: 'saving notification preferences' });
  assert.equal(guest.nodes().some(node => ['SafeAreaView', 'ScrollView'].includes(node.type)), false);
  assert.equal(guest.nodes().some(node => node.props.label === 'Back to browsing'), false);
  const reviewer = gateHarness({ authStatus: 'signed_out', review: true });
  reviewer.render();
  assert.match(reviewer.text(), /dedicated app reviewer email and password/);
  assert.equal(reviewer.nodes().some(node => node.props.label === 'Try demonstration'), false);
  reviewer.press('Reviewer sign in');
  assert.equal(reviewer.calls[0][1].pathname, '/account');
  reviewer.state.authStatus = 'signed_in';
  assert.equal(reviewer.render(), reviewer.editor);
});
