import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('../mobile/node_modules/typescript');
const componentRoot = new URL('../mobile/src/components/', import.meta.url);
const snapshot = {
  customers: [
    { user_id: 'customer-a', first_name: 'Alice', email: 'alice@example.test' },
    { user_id: 'customer-b', first_name: 'Bob', email: 'bob@example.test' },
  ],
  vehicles: [
    { id: 'vehicle-a', customer_id: 'customer-a', year: 2020, make: 'Holden', model: 'Test A', registration: 'TEST-A' },
    { id: 'vehicle-b', customer_id: 'customer-b', year: 2022, make: 'Ford', model: 'Test B', registration: 'TEST-B' },
  ],
};

// Exercise the actual TSX exports with a small host adapter. This tests workflow
// state and actions without native modules, network calls or customer records;
// browser/device checks still cover React scheduling and rendered layout.
function mountComponent(filename, exportName, props, moduleOverrides = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let tree = [];
  const jsx = (type, attributes, key) => ({ type, props: attributes ?? {}, key });
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
      },
      useMemo: factory => factory(),
      useCallback: callback => callback,
      useEffect: callback => effects.push(callback),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': {
      View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal',
      ScrollView: 'ScrollView', Image: 'Image', Platform: { OS: 'ios' },
      StyleSheet: { create: styles => styles },
    },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    'expo-document-picker': {},
    '@/components/ui': { PrimaryButton: 'Button', Field: 'Field', FormInput: 'Input' },
    '@/components/staff-scroll-select': { StaffScrollSelect: 'Select' },
    '@/components/staff-record-publisher': { StaffRecordPublisher: 'LegacyPublisher' },
    '@/components/staff-vault-publisher': { StaffVaultPublisher: 'VaultPublisher' },
    '@/constants/brand': { colors: {}, spacing: { sm: 8, md: 16, lg: 24 } },
    '@/lib/australian-date': { todayAustralianDate: () => '09/09/2026', australianDateToIso: () => '2026-09-09', isoDateToAustralian: () => '09/09/2026' },
    '@/lib/review-environment': { REVIEW_ENVIRONMENT: { enabled: false } },
    '@/lib/staff-record-publishing': {},
    '@/lib/staff-vault': {},
    '@/lib/performance-plus': { VAULT_KINDS: ['invoice', 'media', 'dyno', 'service', 'document', 'modification'], VAULT_LABELS: {} },
    '@/lib/supabase': { SUPABASE_CONNECTION: {} },
    '@/lib/staff-portal': {},
    '@/hooks/use-staff-discard-confirmation': { useStaffDiscardConfirmation: () => ({ confirmDiscard: action => action(), discardDialog: null }) },
    ...moduleOverrides,
  };
  const result = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(filename, componentRoot), 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    exports: result.exports,
    module: result,
    require(id) { assert(id in modules, `Unexpected dependency: ${id}`); return modules[id]; },
    setTimeout, clearTimeout,
  }, { filename: fileURLToPath(new URL(filename, componentRoot)) });

  function expand(node) {
    if (node == null || typeof node === 'boolean') return [];
    if (Array.isArray(node)) return node.flatMap(expand);
    if (typeof node !== 'object') return [node];
    if (typeof node.type === 'function') return expand(node.type(node.props));
    if (node.type === 'Modal' && !node.props.visible) return [];
    return [{ ...node, children: expand(node.props.children) }];
  }
  function nodes(children = tree) {
    return children.flatMap(node => typeof node === 'object' ? [node, ...nodes(node.children)] : []);
  }
  function text(node) {
    return typeof node === 'object' ? node.children.map(text).join('') : String(node);
  }
  function render() {
    cursor = 0;
    effects = [];
    tree = expand(result.exports[exportName](props));
    effects.forEach(effect => effect());
  }
  return {
    render,
    find(type, predicate = () => true) { return nodes().find(node => node.type === type && predicate(node)); },
    count(type) { return nodes().filter(node => node.type === type).length; },
    press(label) {
      const node = nodes().find(candidate =>
        (candidate.type === 'Button' && candidate.props.label === label)
        || (candidate.type === 'Pressable' && text(candidate).startsWith(label)));
      assert(node, `Missing action: ${label}`);
      assert(!node.props.disabled, `Action disabled: ${label}`);
      node.props.onPress();
      render();
    },
    select(label, value) {
      const selector = nodes().find(node => node.type === 'Select' && node.props.label === label);
      assert(selector, `Missing selector: ${label}`);
      selector.props.onChange(value);
      render();
    },
  };
}

function workflow(props = {}) {
  const component = mountComponent('staff-record-workflow.tsx', 'StaffRecordWorkflow', { snapshot, ...props });
  component.render();
  return component;
}

test('record creation requires an explicit customer and a vehicle belonging to that customer', () => {
  const flow = workflow();
  assert(flow.find('Button', node => node.props.label === 'Continue').props.disabled);
  assert.equal(flow.count('LegacyPublisher') + flow.count('VaultPublisher'), 0);
  flow.select('Customer', 'customer-a');
  assert.deepEqual(Array.from(flow.find('Select', node => node.props.label === 'Vehicle').props.options, option => option.value), ['vehicle-a']);
  flow.select('Vehicle', 'vehicle-b');
  assert(flow.find('Button', node => node.props.label === 'Continue').props.disabled);
  flow.select('Vehicle', 'vehicle-a');
  flow.press('Continue');
  assert.equal(flow.count('Select'), 0);
  flow.press('Invoice');
  flow.press('Invoice details & PDF');
  const form = flow.find('LegacyPublisher');
  assert.equal(form.props.initialCustomerId, 'customer-a');
  assert.equal(form.props.initialVehicleId, 'vehicle-a');
  assert(form.props.fixedIdentity);
  assert(form.props.compact);
});

test('booking/customer shortcuts advance only when both customer and vehicle match', () => {
  const valid = workflow({ customerId: 'customer-a', vehicleId: 'vehicle-a' });
  assert.equal(valid.count('Select'), 0);
  valid.press('Workshop photos');
  assert.equal(valid.find('VaultPublisher').props.initialVehicleId, 'vehicle-a');
  const mismatch = workflow({ customerId: 'customer-a', vehicleId: 'vehicle-b' });
  assert.equal(mismatch.count('Select'), 2);
  assert(mismatch.find('Button', node => node.props.label === 'Continue').props.disabled);
  const unknown = workflow({ customerId: 'missing', vehicleId: 'vehicle-a' });
  assert(unknown.find('Button', node => node.props.label === 'Continue').props.disabled);
});

test('changing vehicle protects dirty details and discarding starts a fresh form', () => {
  const flow = workflow({ customerId: 'customer-a', vehicleId: 'vehicle-a' });
  flow.press('Invoice');
  flow.press('Invoice details & PDF');
  const original = flow.find('LegacyPublisher');
  original.props.onDirtyChange(true);
  flow.render();
  flow.press('Change vehicle');
  assert.equal(flow.count('Modal'), 1);
  flow.press('Keep editing');
  assert.equal(flow.find('LegacyPublisher').key, original.key);
  flow.press('Change vehicle');
  flow.press('Discard changes');
  assert.equal(flow.count('LegacyPublisher'), 0);
  assert.equal(flow.count('Select'), 2);
  flow.select('Customer', 'customer-b');
  assert.equal(flow.find('Select', node => node.props.label === 'Vehicle').props.value, '');
  flow.select('Vehicle', 'vehicle-b');
  flow.press('Continue');
  flow.press('Invoice');
  flow.press('Invoice details & PDF');
  assert.notEqual(flow.find('LegacyPublisher').key, original.key);
  assert.equal(flow.find('LegacyPublisher').props.initialCustomerId, 'customer-b');
  assert.equal(flow.find('LegacyPublisher').props.initialVehicleId, 'vehicle-b');
});

test('registered header/hardware back respects busy publishing and unsaved changes', () => {
  let back = null;
  const flow = workflow({ customerId: 'customer-a', vehicleId: 'vehicle-a', onBackHandlerChange: handler => { back = handler; } });
  assert.equal(typeof back, 'function');
  flow.press('Workshop photos');
  flow.find('VaultPublisher').props.onDirtyChange(true);
  flow.find('VaultPublisher').props.onBusyChange(true);
  flow.render();
  back();
  flow.render();
  assert.equal(flow.count('Modal'), 0);
  assert(flow.find('VaultPublisher'));
  flow.find('VaultPublisher').props.onBusyChange(false);
  flow.render();
  back();
  flow.render();
  assert.equal(flow.count('Modal'), 1);
  flow.press('Keep editing');
  assert(flow.find('VaultPublisher'));
});

for (const [filename, exportName, extra] of [
  ['staff-record-publisher.tsx', 'StaffRecordPublisher', { fixedType: 'invoice' }],
  ['staff-vault-publisher.tsx', 'StaffVaultPublisher', { fixedKind: 'media' }],
]) {
  test(`${exportName} hides repeated identity and refuses a mismatched fixed identity`, () => {
    const props = { snapshot, initialCustomerId: 'customer-a', initialVehicleId: 'vehicle-a', fixedIdentity: true, compact: true, ...extra };
    const valid = mountComponent(filename, exportName, props);
    valid.render();
    assert.equal(valid.count('Select'), 0);
    assert(valid.find('Button', node => node.props.label === 'Publish'));
    const invalid = mountComponent(filename, exportName, { ...props, initialVehicleId: 'vehicle-b' });
    invalid.render();
    assert.equal(invalid.count('Button'), 0);
  });
}

test('preview record workflow passes preview protection to both publishing destinations', () => {
  const flow = workflow({ customerId: 'customer-a', vehicleId: 'vehicle-a', previewMode: true });
  flow.press('Invoice');
  flow.press('Invoice details & PDF');
  assert.equal(flow.find('LegacyPublisher').props.previewMode, true);
  flow.press('Options');
  flow.press('Job invoice files');
  assert.equal(flow.find('VaultPublisher').props.previewMode, true);
});

for (const fixedType of ['repair', 'recommendation', 'dyno', 'invoice']) {
  test(`preview ${fixedType} records allow form editing but cannot publish or open a file picker`, () => {
    let operations = 0;
    const forbidden = () => { operations++; throw new Error('Preview performed a protected operation'); };
    const component = mountComponent('staff-record-publisher.tsx', 'StaffRecordPublisher', {
      snapshot, initialCustomerId: 'customer-a', initialVehicleId: 'vehicle-a', fixedIdentity: true, fixedType, previewMode: true,
    }, {
      'expo-document-picker': { getDocumentAsync: forbidden },
      '@/lib/staff-record-publishing': { publishPsiDyno: forbidden, publishPsiInvoice: forbidden, publishPsiRecommendation: forbidden, publishPsiRepair: forbidden },
    });
    component.render();
    const input = component.find('Input');
    assert.equal(input.props.editable, true);
    input.props.onChangeText('Example record');
    component.render();
    component.press('I checked the customer');
    const publish = component.find('Button', node => node.props.label === 'Preview only · Publish');
    assert.equal(publish.props.disabled, true);
    publish.props.onPress(); // Handler must remain safe even if a host invokes a disabled control.
    const picker = component.find('Button', node => node.props.label === 'Choose PDF');
    if (picker) { assert.equal(picker.props.disabled, true); picker.props.onPress(); }
    assert.equal(operations, 0);
  });
}

test('preview vault forms cannot pick files, create a job, publish, or download a job manifest', () => {
  let operations = 0;
  const forbidden = () => { operations++; throw new Error('Preview performed a protected operation'); };
  const component = mountComponent('staff-vault-publisher.tsx', 'StaffVaultPublisher', {
    snapshot, initialCustomerId: 'customer-a', initialVehicleId: 'vehicle-a', fixedIdentity: true, fixedKind: 'media', previewMode: true,
  }, {
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', Platform: { OS: 'web' }, StyleSheet: { create: styles => styles } },
    'expo-document-picker': { getDocumentAsync: forbidden },
    '@/lib/staff-vault': { createOrFindWorkshopJob: forbidden, publishVaultRecord: forbidden },
  });
  component.render();
  component.find('Input', node => node.props.placeholder === 'Major service').props.onChangeText('Example service');
  component.render();
  component.press('I checked the customer');
  for (const label of ['Choose files', 'Preview only · Publish', 'Download PC folder file']) {
    const control = component.find('Button', node => node.props.label === label);
    assert.equal(control.props.disabled, true);
    control.props.onPress();
  }
  assert.equal(operations, 0);
});

test('preview imports never load protected records, including their mount effect', async () => {
  let operations = 0;
  const component = mountComponent('staff-vault-publisher.tsx', 'StaffVaultReview', { previewMode: true }, {
    '@/lib/performance-plus': { vaultClient: () => { operations++; throw new Error('Preview queried protected records'); } },
  });
  component.render();
  const refresh = component.find('Button', node => node.props.label === 'Refresh');
  assert.equal(refresh.props.disabled, true);
  refresh.props.onPress();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(operations, 0);
});

test('preview complimentary access can be selected but cannot be granted', () => {
  let operations = 0;
  const component = mountComponent('staff-vault-publisher.tsx', 'StaffPerformanceAccess', {
    snapshot, customerId: 'customer-a', previewMode: true,
  }, {
    '@/lib/performance-plus': { vaultClient: () => { operations++; throw new Error('Preview changed customer access'); } },
  });
  component.render();
  component.press('Grant complimentary access');
  const grant = component.find('Button', node => node.props.label === 'Preview only · Grant access');
  assert.equal(grant.props.disabled, true);
  grant.props.onPress();
  assert.equal(operations, 0);
});

for (const [state, action, label] of [
  ['pending_staff_review', 'Approve requested date', 'Preview only · Approve date'],
  ['pending_staff_review', 'Propose another date', 'Preview only · Propose date'],
  ['pending_staff_review', 'Cancel request', 'Preview only · Confirm cancellation'],
  ['date_approved', 'Verify bank transfer', 'Preview only · Confirm bank transfer'],
]) {
  test(`preview booking action ${action} cannot send a decision or verify a payment`, () => {
    let operations = 0;
    const forbidden = () => { operations++; throw new Error('Preview changed a booking or payment'); };
    const component = mountComponent('staff-booking-review.tsx', 'StaffBookingReview', {
      booking: { id: 'example-booking', state, preferred_date: '2026-09-09', staff_note: '' }, onRefresh: () => {}, previewMode: true,
    }, {
      '@/lib/staff-portal': { reviewBookingRequest: forbidden, confirmBankTransferPayment: forbidden },
    });
    component.render();
    component.press(action);
    const input = component.find('Input');
    assert.equal(input.props.editable, true);
    input.props.onChangeText(action === 'Verify bank transfer' ? 'EXAMPLE-ONLY' : '10/09/2026');
    component.find('Pressable', node => node.props.accessibilityRole === 'checkbox').props.onPress();
    component.render();
    const submit = component.find('Button', node => node.props.label === label);
    assert.equal(submit.props.disabled, true);
    submit.props.onPress();
    assert.equal(operations, 0);
  });
}
