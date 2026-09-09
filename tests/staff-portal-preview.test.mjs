import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const fixtureSource = await readFile(new URL('../mobile/src/lib/staff-portal-preview.ts', import.meta.url), 'utf8');
const {
  STAFF_PORTAL_PREVIEW_SNAPSHOT: snapshot,
  STAFF_PORTAL_PREVIEW_NOTIFICATIONS: alerts,
} = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(fixtureSource)).toString('base64')}`);

test('public preview contains fictional contact details and no private storage assets', () => {
  const profiles = [...snapshot.customers, ...snapshot.deletionCustomers];
  assert.ok(profiles.length > 0);
  for (const profile of profiles) {
    assert.match(profile.email, /^[^@]+@example\.invalid$/);
    assert.match(profile.user_id, /^preview-/);
    assert.match(profile.mobile, /•/);
    assert.equal(profile.profile_photo_object_path, null);
    assert.equal(profile.profile_photo_mime_type, null);
  }
  for (const invitation of snapshot.invitations) assert.match(invitation.email, /^[^@]+@example\.invalid$/);
  assert.deepEqual(snapshot.vehicleFiles, []);
  const text = JSON.stringify({ snapshot, alerts });
  assert.doesNotMatch(text, /https?:\/\//);
  assert.doesNotMatch(text, /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
});

test('preview ownership and enquiry context match the booking workflow', () => {
  const customers = new Set(snapshot.customers.map(customer => customer.user_id));
  const vehicles = new Map(snapshot.vehicles.map(vehicle => [vehicle.id, vehicle]));
  for (const booking of snapshot.bookings) {
    assert.ok(customers.has(booking.customer_id));
    assert.equal(vehicles.get(booking.vehicle_id)?.customer_id, booking.customer_id);
    assert.equal(booking.currency, 'AUD');
    const context = booking.request_context;
    assert.equal(context.schemaVersion, 1);
    assert.equal(context.bookingPolicyVersion, 'psi-booking-v1');
    assert.ok(['specific', 'flexible'].includes(context.appointmentPreferenceMode));
    assert.ok(['business_hours', 'before_hours_drop_off', 'after_hours_drop_off', 'flexible'].includes(context.arrivalArrangement));
    for (const key of ['afterHoursCollection', 'notifyEarlierAvailability', 'serviceReminderConsent']) assert.equal(typeof context[key], 'boolean');
    if (booking.booking_type === 'dyno') {
      assert.ok(['known', 'psi_inspection'].includes(context.setupConfidence));
      assert.equal(context.serviceReminderConsent, false);
      if (context.setupConfidence === 'known') {
        assert.ok(['automatic', 'manual'].includes(context.tuningDetails.transmissionType));
        assert.ok(['98_ron', 'e85', 'flex_fuel', 'race_fuel', 'other'].includes(context.tuningDetails.fuelType));
      }
    }
  }
  for (const alert of alerts) {
    assert.match(alert.recipient_user_id, /^preview-/);
    if (alert.booking_request_id) assert.ok(snapshot.bookings.some(booking => booking.id === alert.booking_request_id));
  }
});

const require = createRequire(import.meta.url);
const ts = require('../mobile/node_modules/typescript');
const routeSource = await readFile(new URL('../mobile/src/app/portal-preview.tsx', import.meta.url), 'utf8');
const routeJs = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderRoute(authEnabled) {
  const navigations = [];
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'expo-router': { Stack: { Screen: 'Screen' }, useRouter: () => ({ replace: href => navigations.push(href) }) },
    'react-native': { Text: 'Text', View: 'View', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/app/staff': { StaffWorkspace: 'StaffWorkspace' },
    '@/components/ui': { PrimaryButton: 'Button' },
    '@/constants/brand': { colors: {} },
    '@/hooks/use-responsive-layout': { useResponsiveLayout: () => ({ horizontalPadding: 24 }) },
    '@/lib/customer-auth': { CUSTOMER_AUTH: { enabled: authEnabled } },
    '@/lib/staff-portal-preview': { STAFF_PORTAL_PREVIEW_SNAPSHOT: snapshot },
  };
  const result = { exports: {} };
  vm.runInNewContext(routeJs, {
    exports: result.exports,
    require(name) { assert.ok(name in modules, `Unexpected preview dependency: ${name}`); return modules[name]; },
  });
  const tree = result.exports.default();
  const flatten = node => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
  return { nodes: flatten(tree), navigations };
}

test('authenticated builds never mount the public sample workspace', () => {
  const { nodes, navigations } = renderRoute(true);
  assert.equal(nodes.some(node => node.type === 'StaffWorkspace'), false);
  const open = nodes.find(node => node.type === 'Button' && node.props.label === 'Open workshop portal');
  assert.ok(open);
  open.props.onPress();
  assert.deepEqual(navigations, ['/staff']);
});

test('public route mounts the existing workspace with a fixed sample and preview guard', () => {
  const { nodes, navigations } = renderRoute(false);
  const workspace = nodes.find(node => node.type === 'StaffWorkspace');
  assert.ok(workspace);
  assert.equal(workspace.props.previewMode, true);
  assert.equal(workspace.props.snapshot, snapshot);
  assert.equal(workspace.props.role, 'owner');
  assert.equal(workspace.props.verifiedTotpFactors.length, 0);
  assert.equal(workspace.props.onRefresh(), undefined);
  assert.deepEqual(navigations, []);
});
