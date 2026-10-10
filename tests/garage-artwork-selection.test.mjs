import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');

async function transpiledExports(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports });
  return exports;
}

test('garage artwork uses account storage only for a signed-in account', async () => {
  const { shouldPersistGarageArtwork } = await transpiledExports('../mobile/src/lib/garage-artwork-selection.ts');
  assert.equal(shouldPersistGarageArtwork(true, 'signed_in'), true);
  assert.equal(shouldPersistGarageArtwork(true, 'signed_out'), false);
  assert.equal(shouldPersistGarageArtwork(true, 'loading'), false);
  assert.equal(shouldPersistGarageArtwork(false, 'signed_in'), false);
});

test('every selectable garage illustration has one bundled asset and a database-safe ID', async () => {
  const [catalog, assets, migration] = await Promise.all([
    readFile(new URL('../mobile/src/lib/garage-art-catalog.ts', import.meta.url), 'utf8'),
    readFile(new URL('../mobile/src/lib/garage-art-assets.ts', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/migrations/20260908184408_performance_plus_foundation.sql', import.meta.url), 'utf8'),
  ]);
  const catalogIds = [...catalog.matchAll(/id:\s*'([^']+)'\s*,\s*make/g)].map(match => match[1]);
  const assetIds = [...assets.matchAll(/^\s*'([^']+)'\s*:\s*\{/gm)].map(match => match[1]);
  const maximum = Number(migration.match(/length\(illustration_id\) between 1 and (\d+)/i)?.[1]);

  assert.ok(catalogIds.length > 0);
  assert.equal(new Set(catalogIds).size, catalogIds.length);
  assert.deepEqual([...catalogIds].sort(), [...assetIds].sort());
  assert.ok(Number.isInteger(maximum));
  for (const id of catalogIds) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(id.length <= maximum, `${id} exceeds the database limit`);
  }
});

test('account artwork saves use the vehicle primary key and verify the stored result', async () => {
  const source = await readFile(new URL('../mobile/src/components/garage-artwork-picker.tsx', import.meta.url), 'utf8');
  assert.match(source, /shouldPersistGarageArtwork\(CUSTOMER_AUTH\.enabled, auth\.status\)/);
  assert.match(source, /upsert\([^;]+\{ onConflict: 'vehicle_id' \}\)/s);
  assert.match(source, /\.select\('vehicle_id,illustration_id'\)\s*\.single\(\)/s);
});

test('personal artwork requires a successful private Storage entitlement', async () => {
  const { canUseGarageArtwork, findGarageArtwork, PERSONAL_GARAGE_ART_ID, GARAGE_ART_CATALOG } =
    await transpiledExports('../mobile/src/lib/garage-art-catalog.ts');
  for (const access of [undefined, false]) {
    assert.equal(canUseGarageArtwork(PERSONAL_GARAGE_ART_ID, access), false);
    assert.equal(findGarageArtwork('', '', undefined, access).some(art => art.id === PERSONAL_GARAGE_ART_ID), false);
    assert.equal(findGarageArtwork('personal', 'Porsche', undefined, access).length, 0);
  }
  assert.equal(canUseGarageArtwork(PERSONAL_GARAGE_ART_ID, true), true);
  assert.equal(findGarageArtwork('personal', 'Porsche', undefined, true)[0].id, PERSONAL_GARAGE_ART_ID);
  assert.equal(canUseGarageArtwork('unknown', true), false);
  for (const art of GARAGE_ART_CATALOG.filter(art => !art.personalOnly)) {
    assert.equal(canUseGarageArtwork(art.id, false), true);
    assert.equal(canUseGarageArtwork(art.id), true);
  }
});

test('restricted saved IDs resolve to the public fallback without private image access', async () => {
  const catalog = await transpiledExports('../mobile/src/lib/garage-art-catalog.ts');
  const source = await readFile(new URL('../mobile/src/lib/garage-art-assets.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: id => id === '@/lib/garage-art-catalog' ? catalog : id });
  assert.equal(exports.garageArtById(catalog.PERSONAL_GARAGE_ART_ID).id, 'porsche');
  assert.equal(exports.garageArtById(catalog.PERSONAL_GARAGE_ART_ID, false).id, 'porsche');
  assert.equal(exports.garageArtById(catalog.PERSONAL_GARAGE_ART_ID, true).id, catalog.PERSONAL_GARAGE_ART_ID);
  assert.equal(exports.garageArtById('unknown').id, 'porsche');
  assert.doesNotMatch(source, /require\([^)]*personal-vehicle-artwork/);
});

test('private artwork requests require owner auth and disappear immediately on account switching', async () => {
  const source = await readFile(new URL('../mobile/src/hooks/use-private-garage-artwork.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  let auth = { status: 'signed_out', user: null };
  let state = null;
  let effects = [];
  let calls = 0;
  let removed = false;
  vm.runInNewContext(compiled, {
    exports, Date, setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 2, clearTimeout: () => {},
    require: id => {
      if (id === 'react') return { useState: () => [state, value => { state = typeof value === 'function' ? value(state) : value; }], useEffect: callback => { effects.push(callback); } };
      if (id === 'react-native') return { AppState: { addEventListener: () => ({ remove: () => { removed = true; } }) } };
      if (id === '@/lib/customer-auth-context') return { useCustomerAuth: () => auth };
      if (id === '@/lib/supabase') return { getSupabaseClient: () => ({ storage: { from: bucket => {
        assert.equal(bucket, 'owner-garage-artwork');
        return { createSignedUrls: async (paths, expires) => {
          calls++;
          assert.equal(expires, 600);
          assert.ok(paths.every(path => path.startsWith(`${auth.user.id}/`)));
          if (auth.user.id !== 'private-owner-test') return { data: null, error: new Error('denied') };
          return { data: [{ signedUrl: 'https://private.test/full' }, { signedUrl: 'https://private.test/thumb' }], error: null };
        } };
      } } }) };
      throw new Error(`Unexpected import ${id}`);
    },
  });
  assert.equal(exports.usePrivateGarageArtwork(), null);
  effects[0]();
  assert.equal(calls, 0);
  auth = { status: 'signed_in', user: { id: 'private-owner-test' } };
  effects = [];
  exports.usePrivateGarageArtwork();
  const cleanup = effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(exports.usePrivateGarageArtwork().preview.uri, 'https://private.test/thumb');
  assert.equal(calls, 1);
  auth = { status: 'signed_in', user: { id: 'another-account' } };
  effects = [];
  assert.equal(exports.usePrivateGarageArtwork(), null);
  effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.equal(exports.usePrivateGarageArtwork(), null);
  auth = { status: 'signed_out', user: null };
  assert.equal(exports.usePrivateGarageArtwork(), null);
  cleanup();
  assert.equal(removed, true);
});
