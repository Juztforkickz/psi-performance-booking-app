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
