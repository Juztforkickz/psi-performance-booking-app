import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const source = await readFile(new URL('../mobile/src/app/account/index.tsx', import.meta.url), 'utf8');
const syntax = ts.createSourceFile('account.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const controls = syntax.statements.find((statement) => ts.isFunctionDeclaration(statement)
  && statement.name?.text === 'AccountDeletionControls');
assert.ok(controls, 'The account deletion controls must be independently renderable');
const compiled = ts.transpileModule(controls.getText(syntax), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
  },
}).outputText;

const userId = '11111111-1111-4111-8111-111111111111';
const pending = {
  user_id: userId,
  status: 'requested',
  requested_at: '2026-08-31T01:00:00.000Z',
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

// Execute the real component with a small hook/render adapter. Effects run after
// renders, retain dependency identity and run cleanup on blur. Deferred service
// responses let the tests reproduce races without a native device or timers.
function mount({ load = async () => null, cancel = async () => undefined } = {}) {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let dirty = false;
  let tree;
  let focusSlot;
  let sessionRevision = 1;
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (value) => {
        slots[index].value = typeof value === 'function' ? value(slots[index].value) : value;
        dirty = true;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      const current = slots[index];
      if (!current || dependencies.some((value, dependency) => !Object.is(value, current.dependencies[dependency]))) {
        slots[index] = { callback, dependencies };
      }
      return slots[index].callback;
    },
    useEffect(callback, dependencies) {
      const index = cursor++;
      const current = slots[index];
      if (!current || dependencies.some((value, dependency) => !Object.is(value, current.dependencies[dependency]))) {
        slots[index] = { dependencies, cleanup: undefined };
        effects.push(() => {
          current?.cleanup?.();
          slots[index].cleanup = callback();
        });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    React: react,
    ...react,
    View: 'View',
    Text: 'Text',
    PrimaryButton: 'PrimaryButton',
    styles: {},
    formatAccountDate: (date) => date,
    loadOwnAccountDeletionRequest: (identity) => { assert.equal(identity, userId); return load(); },
    cancelOwnAccountDeletionRequest: (identity) => { assert.equal(identity, userId); return cancel(); },
    requestOwnAccountDeletion: () => { throw new Error('Unexpected account deletion submission'); },
    useFocusEffect(callback) {
      const index = cursor++;
      if (!slots[index] || slots[index].callback !== callback) {
        const previous = slots[index];
        slots[index] = { callback, cleanup: undefined };
        effects.push(() => {
          previous?.cleanup?.();
          slots[index].cleanup = callback();
        });
      }
      focusSlot = slots[index];
    },
  });
  const render = () => {
    cursor = 0;
    dirty = false;
    tree = exports.AccountDeletionControls({ compact: false, sessionRevision, userId });
    for (const effect of effects.splice(0)) effect();
  };
  const nodes = () => {
    const result = [];
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      result.push(node);
      visit(node.props?.children);
    };
    visit(tree);
    return result;
  };
  const text = () => {
    const fragments = [];
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (typeof node === 'string' || typeof node === 'number') fragments.push(String(node));
      else if (node && typeof node === 'object') visit(node.props?.children);
    };
    visit(tree);
    return fragments.join(' ');
  };
  render();
  return {
    text,
    labels: () => nodes().filter((node) => node.type === 'PrimaryButton').map((node) => node.props.label),
    press(label) {
      const button = nodes().find((node) => node.type === 'PrimaryButton' && node.props.label === label);
      assert.ok(button, `Button not found: ${label}`);
      assert.notEqual(button.props.disabled, true);
      button.props.onPress();
      if (dirty) render();
    },
    refocus() {
      focusSlot.cleanup?.();
      focusSlot.cleanup = focusSlot.callback();
      if (dirty) render();
    },
    refreshSession() {
      sessionRevision += 1;
      render();
    },
    async flush() {
      for (let step = 0; step < 12; step += 1) {
        await Promise.resolve();
        if (dirty) render();
      }
    },
  };
}

test('deletion actions remain hidden while initial status is unknown or failed', async () => {
  const read = deferred();
  const view = mount({ load: () => read.promise });
  assert.deepEqual(view.labels(), []);
  assert.match(view.text(), /Checking your account status/);
  read.reject(new Error('Offline'));
  await view.flush();
  assert.deepEqual(view.labels(), ['Retry status check']);
  assert.doesNotMatch(view.text(), /No account-deletion request is pending|REQUEST RECEIVED/);
});

test('successful cancellation displays that the account and files are being kept', async () => {
  const view = mount({ load: async () => pending });
  await view.flush();
  view.press('Cancel pending deletion request');
  await view.flush();
  assert.match(view.text(), /Your account and files are being kept/);
  assert.doesNotMatch(view.text(), /REQUEST RECEIVED|Requested/);
  assert.deepEqual(view.labels(), ['Request account deletion']);
});

test('an older focus read cannot restore the pending card after cancellation succeeds', async () => {
  const staleRead = deferred();
  let loads = 0;
  const view = mount({ load: () => ++loads === 1 ? Promise.resolve(pending) : staleRead.promise });
  await view.flush();
  view.refocus();
  view.press('Cancel pending deletion request');
  await view.flush();
  staleRead.resolve(pending);
  await view.flush();
  assert.match(view.text(), /Your account and files are being kept/);
  assert.doesNotMatch(view.text(), /REQUEST RECEIVED|Requested/);
});

test('a failed cancellation reconciles a server review and removes the cancel action', async () => {
  let loads = 0;
  const view = mount({
    load: async () => ++loads === 1 ? pending : { ...pending, status: 'in_review' },
    cancel: async () => { throw new Error('Request changed'); },
  });
  await view.flush();
  view.press('Cancel pending deletion request');
  await view.flush();
  assert.match(view.text(), /DELETION IN REVIEW/);
  assert.match(view.text(), /Contact PSI to review/);
  assert.deepEqual(view.labels(), []);
  assert.doesNotMatch(view.text(), /No account-deletion request is pending/);
});

test('a lost cancellation response is reconciled to success when the request is absent', async () => {
  let loads = 0;
  const view = mount({
    load: async () => ++loads === 1 ? pending : null,
    cancel: async () => { throw new Error('Response lost'); },
  });
  await view.flush();
  view.press('Cancel pending deletion request');
  await view.flush();
  assert.match(view.text(), /Your account and files are being kept/);
  assert.doesNotMatch(view.text(), /could not|REQUEST RECEIVED/);
});

test('a cancellation whose result cannot be checked exposes only a status retry', async () => {
  let loads = 0;
  const view = mount({
    load: async () => {
      if (++loads === 1) return pending;
      throw new Error('Offline');
    },
    cancel: async () => { throw new Error('Offline'); },
  });
  await view.flush();
  view.press('Cancel pending deletion request');
  await view.flush();
  assert.deepEqual(view.labels(), ['Retry status check']);
  assert.match(view.text(), /Cancellation could not be verified/);
  assert.doesNotMatch(view.text(), /No account-deletion request is pending|REQUEST RECEIVED/);
});

test('a later unknown status cannot retain an earlier cancellation reassurance', async () => {
  let loads = 0;
  const view = mount({ load: async () => {
    if (++loads === 1) return pending;
    throw new Error('Offline on return');
  } });
  await view.flush();
  view.press('Cancel pending deletion request');
  await view.flush();
  view.refocus();
  await view.flush();
  assert.deepEqual(view.labels(), ['Retry status check']);
  assert.doesNotMatch(view.text(), /No account-deletion request is pending|files are being kept/);
});

test('a newly loaded pending request replaces any earlier cancellation reassurance', async () => {
  const view = mount({ load: async () => pending });
  await view.flush();
  view.press('Cancel pending deletion request');
  await view.flush();
  view.refocus();
  await view.flush();
  assert.match(view.text(), /REQUEST RECEIVED/);
  assert.doesNotMatch(view.text(), /No account-deletion request is pending|files are being kept/);
});

test('a token refresh during cancellation preserves its eventual result', async () => {
  const cancellation = deferred();
  let loads = 0;
  let cancellations = 0;
  const view = mount({
    load: async () => { loads += 1; return pending; },
    cancel: () => { cancellations += 1; return cancellation.promise; },
  });
  await view.flush();
  view.press('Cancel pending deletion request');
  view.refreshSession();
  await view.flush();
  assert.equal(loads, 1, 'Token refresh must not race the active cancellation with a new status read');
  assert.equal(cancellations, 1);
  assert.doesNotMatch(view.text(), /Your account and files are being kept/);
  cancellation.resolve();
  await view.flush();
  assert.match(view.text(), /Your account and files are being kept/);
  assert.doesNotMatch(view.text(), /REQUEST RECEIVED|Requested/);
  assert.deepEqual(view.labels(), ['Request account deletion']);
});

test('a session refresh rechecks status when no cancellation is active', async () => {
  let loads = 0;
  const view = mount({ load: async () => ++loads === 1 ? pending : null });
  await view.flush();
  assert.match(view.text(), /REQUEST RECEIVED/);
  view.refreshSession();
  await view.flush();
  assert.equal(loads, 2);
  assert.doesNotMatch(view.text(), /REQUEST RECEIVED|Requested/);
  assert.deepEqual(view.labels(), ['Request account deletion']);
});

test('switching accounts resets controls while a same-account token refresh preserves the instance', () => {
  let usage;
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(syntax) === 'AccountDeletionControls') usage = node;
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  assert.ok(usage, 'The account screen must render its deletion controls');
  const key = usage.attributes.properties.find((attribute) => attribute.name?.text === 'key');
  const identity = usage.attributes.properties.find((attribute) => attribute.name?.text === 'userId');
  assert.ok(key?.initializer?.expression, 'Controls must have an identity-bound React key');
  assert.equal(identity?.initializer?.expression?.getText(syntax), 'authenticatedUserId');
  const keyFor = (authenticatedUserId, sessionRevision) => vm.runInNewContext(
    key.initializer.expression.getText(syntax), { authenticatedUserId, auth: { sessionRevision } },
  );
  assert.notEqual(keyFor('first-account', 1), keyFor('second-account', 1));
  assert.equal(keyFor('first-account', 1), keyFor('first-account', 2));
});
