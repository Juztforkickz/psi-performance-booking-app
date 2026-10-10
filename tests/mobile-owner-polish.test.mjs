import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
const ts = createRequire(new URL('../mobile/package.json', import.meta.url))('typescript');
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
async function compile(path, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(await read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, ...globals });
  return exports;
}

test('startup cache rejects other accounts, expired data and remote URL credentials', async () => {
  const { parseGarageStartupCache, jpegDataUri } = await compile('../mobile/src/lib/garage-startup-cache.ts');
  const now = Date.now();
  const cache = { userId: 'owner', vehicleId: 'car', illustrationId: 'personal-vehicle-artwork', sourceUri: jpegDataUri(Uint8Array.from([255, 216, 255])), previewUri: jpegDataUri(Uint8Array.from([255, 216, 255])), savedAt: now };
  assert.equal(parseGarageStartupCache(JSON.stringify(cache), 'other', true, now), null);
  assert.equal(parseGarageStartupCache(JSON.stringify({ ...cache, savedAt: now - 8 * 86400_000 }), 'owner', true, now), null);
  assert.equal(parseGarageStartupCache(JSON.stringify(cache), 'owner', false, now).sourceUri, null);
  assert.equal(parseGarageStartupCache(JSON.stringify({ ...cache, sourceUri: 'https://private.invalid?token=secret' }), 'owner', true, now).sourceUri, null);
  assert.equal(parseGarageStartupCache(JSON.stringify(cache), 'owner', true, now).illustrationId, 'personal-vehicle-artwork');
  for (const size of [0, 1, 2, 3, 4, 8195]) {
    const bytes = Uint8Array.from({ length: size }, (_, index) => index % 256);
    assert.equal(jpegDataUri(bytes), `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`);
  }
});

test('double tap invokes portal action once while single taps retain profile action', async () => {
  let timer, cleanup; const calls = [];
  const { useProfileDoubleTap } = await compile('../mobile/src/hooks/use-profile-double-tap.ts', {
    require: () => ({ useRef: value => ({ current: value }), useEffect: effect => { cleanup = effect(); } }),
    setTimeout: callback => { timer = callback; return 1; }, clearTimeout: () => { timer = null; },
  });
  const press = useProfileDoubleTap(() => calls.push('profile'), () => calls.push('portal'), true);
  press(); assert.equal(calls.length, 0); press(); assert.deepEqual(calls, ['portal']); assert.equal(timer, null);
  press(); timer(); assert.deepEqual(calls, ['portal', 'profile']);
  press(); cleanup(); assert.equal(timer, null);
  useProfileDoubleTap(() => calls.push('customer'), () => calls.push('forbidden'), false)();
  assert.equal(calls.at(-1), 'customer');
});

test('booking notes retain correction and one keyboard inset owner, with a dismiss control', async () => {
  const [staff, review, ui, home] = await Promise.all([
    read('../mobile/src/app/staff.tsx'), read('../mobile/src/components/staff-booking-review.tsx'), read('../mobile/src/components/ui.tsx'), read('../mobile/src/app/(tabs)/index.tsx'),
  ]);
  assert.match(staff, /KeyboardAvoidingView enabled=\{Platform.OS === 'android'\}/);
  assert.match(staff, /automaticallyAdjustKeyboardInsets=\{Platform.OS === 'ios'\}/);
  assert.match(review, /FormInput autoCorrect spellCheck autoCapitalize="sentences"/);
  assert.match(review, /accessibilityLabel="Hide keyboard"/);
  assert.match(ui, /autoCorrect=\{proseInput\}/);
  assert.match(ui, /props.autoCapitalize !== 'characters'/);
  assert.match(home, /startupGarageDisplay\?\.vehicleId/);
});
