import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('../mobile/src/lib/home-shortcut-preferences.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const key = '@psi-performance/home-shortcuts/v2';
const legacyKey = '@psi-performance/home-shortcuts/v1';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function mount(storage = new Map(), options = {}) {
  let cursor = 0, dirty = true, value, mounted = true;
  const slots = [], effects = [], pending = [], calls = [];
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => { assert(mounted, 'State update after unmount'); slots[i] = typeof next === 'function' ? next(slots[i]) : next; dirty = true; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(callback) { cursor++; return callback; },
    useEffect(callback, deps) {
      const i = cursor++;
      // Hook callbacks are stable in React. Ignore their adapter identity here.
      if (!effects[i]) pending.push(() => { effects[i] = { cleanup: callback(), deps }; });
    },
  };
  const api = {};
  vm.runInNewContext(source, { exports: api, require(name) {
    if (name === 'react') return react;
    if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: {
      async getItem(name) { if (options.read) await options.read(name); return storage.get(name) ?? null; },
      async setItem(name, data) { calls.push(JSON.parse(data)); if (options.write) await options.write(name, data); storage.set(name, data); },
    } };
    throw Error(name);
  } });
  const render = () => { cursor = 0; dirty = false; value = api.useHomeShortcutPreferences(); while (pending.length) pending.shift()(); return value; };
  return {
    api, calls, storage, render,
    get value() { return value; },
    async flush() { for (let i = 0; i < 40; i++) { if (dirty) render(); await Promise.resolve(); } return value; },
    unmount() { for (const effect of effects) effect?.cleanup?.(); mounted = false; },
  };
}
const array = value => Array.from(value);

test('all 12 defaults appear exactly once in the existing two Home sections', async () => {
  const app = mount(); await app.flush();
  assert.equal(app.value.ready, true);
  assert.equal(app.value.shortcutIds.length, 12);
  const groups = app.api.visibleHomeTileGroups(app.value.shortcutIds);
  assert.equal(groups.shortcuts.length, 6); assert.equal(groups.workshop.length, 6);
  assert.equal(new Set([...groups.shortcuts, ...groups.workshop]).size, 12);
  assert.deepEqual(JSON.parse(app.storage.get(key)), array(app.value.shortcutIds));
});

test('legacy defaults migrate once while genuine custom choices are preserved', async () => {
  for (const previous of [
    ['garage', 'bookings', 'book-ahead', 'alerts'],
    ['garage', 'bookings', 'book-ahead', 'psi-events', 'alerts'],
    ['garage', 'bookings', 'book-ahead', 'psi-events', 'performance-plus', 'alerts'],
  ]) {
    const app = mount(new Map([[legacyKey, JSON.stringify(previous)]])); await app.flush();
    assert.equal(app.value.shortcutIds.length, 12);
    assert.equal(app.storage.get(legacyKey), JSON.stringify(previous), 'Keep the legacy preference for recovery');
  }
  const app = mount(new Map([[legacyKey, '["garage","dyno","rewards"]']])); await app.flush();
  assert.deepEqual(array(app.value.shortcutIds), ['garage', 'dyno', 'rewards']);
});

test('unchecking any tile hides it from its Home section and persists after restart', async () => {
  const app = mount(); await app.flush();
  for (const id of app.api.HOME_TILE_IDS) {
    app.value.toggleShortcut(id); await app.flush();
    const groups = app.api.visibleHomeTileGroups(app.value.shortcutIds);
    assert(![...groups.shortcuts, ...groups.workshop].includes(id));
  }
  assert.deepEqual(array(app.value.shortcutIds), []);
  const reopened = mount(app.storage); await reopened.flush();
  assert.deepEqual(array(reopened.value.shortcutIds), []);
  reopened.value.resetShortcuts(); await reopened.flush();
  assert.equal(reopened.value.shortcutIds.length, 12);
});

test('rapid taps use the latest selection and writes finish in the correct order', async () => {
  const held = deferred(); let delay = false;
  const app = mount(new Map([[key, '["garage","bookings","alerts"]']]), { write: async () => { if (delay) await held.promise; } });
  await app.flush(); delay = true;
  app.value.toggleShortcut('garage'); app.value.toggleShortcut('bookings'); app.value.toggleShortcut('rewards');
  await app.flush(); assert.deepEqual(array(app.value.shortcutIds), ['alerts', 'rewards']);
  held.resolve(); await app.flush();
  assert.deepEqual(JSON.parse(app.storage.get(key)), ['alerts', 'rewards']);
});

test('the old six tile set remains a valid new selection without being reset while toggling', async () => {
  const app = mount(); await app.flush();
  for (const id of app.api.HOME_WORKSHOP_TILE_IDS) app.value.toggleShortcut(id);
  await app.flush(); assert.deepEqual(array(app.value.shortcutIds), array(app.api.HOME_SHORTCUT_TILE_IDS));
  app.value.toggleShortcut('performance-plus'); await app.flush();
  assert(!app.value.shortcutIds.includes('performance-plus'));
});

test('late hydration cannot overwrite a newer user selection', async () => {
  const held = deferred(); const app = mount(new Map([[key, '["garage"]']]), { read: () => held.promise });
  app.render(); app.value.toggleShortcut('rewards'); await app.flush();
  held.resolve(); await app.flush();
  assert.equal(app.value.shortcutIds.length, 11); assert(!app.value.shortcutIds.includes('rewards'));
});

test('storage failure is visible, retryable and never loses the in memory selection', async () => {
  let fail = true;
  const app = mount(new Map([[key, '["garage"]']]), { write: async () => { if (fail) throw Error('storage unavailable'); } });
  await app.flush(); app.value.toggleShortcut('rewards'); await app.flush();
  assert.equal(app.value.saveError, true); assert.deepEqual(array(app.value.shortcutIds), ['garage', 'rewards']);
  fail = false; app.value.retrySave(); await app.flush();
  assert.equal(app.value.saveError, false); assert.deepEqual(JSON.parse(app.storage.get(key)), ['garage', 'rewards']);
});

test('corrupt preferences cannot block Home and completion after unmount cannot update state', async () => {
  const app = mount(new Map([[key, 'invalid json']])); await app.flush();
  assert.equal(app.value.ready, true); assert.equal(app.value.shortcutIds.length, 12);
  const held = deferred(); const closing = mount(new Map(), { read: () => held.promise });
  closing.render(); closing.unmount(); held.resolve(); await closing.flush();
  assert.equal(closing.calls.length, 0);
});
