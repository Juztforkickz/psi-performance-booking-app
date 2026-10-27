import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { coordinateRelease, hash, verifyDelivery, describeExport, verifyExport, commandJson, assertUpdate } from '../mobile/scripts/coordinated-mobile-release.mjs';
const require = createRequire(import.meta.url);
const { TARGETS, PROJECT_ID, releaseEnvironment } = require('../mobile/scripts/mobile-release-config.cjs');
const { verifyNativeContract } = require('../mobile/scripts/native-release-guard.cjs');
const root = fileURLToPath(new URL('../mobile/', import.meta.url));
const sha = 'a'.repeat(40);
const release = () => ({ schema: 1, sourceSha: sha, targets: TARGETS.map(target => ({ ...target, bundle: { path: 'bundle.hbc', sha256: 'bundle' }, assets: [] })) });
const update = (target, sourceSha = sha) => ({ id: `${target.platform}-id`, group: `${target.platform}-group`, platform: target.platform, runtimeVersion: target.runtime, gitCommitHash: sourceSha, isRollBackToEmbedded: false });
function provider() {
  const saved = new Map(), calls = [];
  return { saved, calls,
    preflight: async target => { calls.push(`preflight:${target.platform}`); },
    find: async target => saved.get(target.platform) ?? null,
    publish: async target => { calls.push(`publish:${target.platform}`); const result = update(target); saved.set(target.platform, result); return result; },
  };
}
const verified = async (_target, item) => ({ updateId: item.id, deliveredBytesMatchPreparedExport: true });

test('both destinations are checked before publication, and both must verify', async () => {
  const adapter = provider(), receipts = [];
  const receipt = await coordinateRelease({ manifest: release(), adapter, verify: verified, save: async item => receipts.push(structuredClone(item)) });
  assert.deepEqual(adapter.calls, ['preflight:ios', 'preflight:android', 'publish:ios', 'publish:android']);
  assert.equal(receipt.status, 'complete');
  assert.deepEqual(receipt.platforms.map(item => item.status), ['verified', 'verified']);
  assert.ok(receipts.slice(0, -1).every(item => item.status !== 'complete'));
});
test('an invalid destination blocks all publication', async () => {
  const adapter = provider();
  adapter.preflight = async target => { if (target.platform === 'android') throw new Error('wrong channel'); };
  await assert.rejects(coordinateRelease({ manifest: release(), adapter, verify: verified, save: async () => {} }), /wrong channel/);
  assert.equal(adapter.calls.length, 0);
});
test('a partial failure stays incomplete and retry does not duplicate a successful platform', async () => {
  const adapter = provider(), publish = adapter.publish, receipts = [];
  let fail = true;
  adapter.publish = async target => { if (target.platform === 'android' && fail) throw new Error('timeout'); return publish(target); };
  await assert.rejects(coordinateRelease({ manifest: release(), adapter, verify: verified, save: async item => receipts.push(structuredClone(item)) }), /requires provider verification/);
  assert.equal(receipts.at(-1).status, 'incomplete');
  assert.equal(receipts.at(-1).platforms[0].status, 'verified');
  assert.equal(receipts.at(-1).platforms[1].status, 'publication_uncertain');
  fail = false;
  const retried = await coordinateRelease({ manifest: release(), adapter, verify: verified, save: async () => {} });
  assert.equal(retried.status, 'complete');
  assert.equal(retried.platforms[0].reusedExistingPublication, true);
  assert.equal(adapter.calls.filter(item => item === 'publish:ios').length, 1);
});
test('success followed by a timeout is recovered through readback without another write', async () => {
  const adapter = provider(), publish = adapter.publish;
  adapter.publish = async target => { await publish(target); throw new Error('connection lost after success'); };
  assert.equal((await coordinateRelease({ manifest: release(), adapter, verify: verified, save: async () => {} })).status, 'complete');
  assert.equal(adapter.calls.filter(item => item.startsWith('publish:')).length, 2);
});
test('a repeated completed run publishes neither platform again', async () => {
  const adapter = provider();
  for (let i = 0; i < 2; i++) await coordinateRelease({ manifest: release(), adapter, verify: verified, save: async () => {} });
  assert.equal(adapter.calls.filter(item => item.startsWith('publish:')).length, 2);
});
test('corrupt delivery cannot produce a complete receipt', async () => {
  const adapter = provider(), receipts = [];
  await assert.rejects(coordinateRelease({ manifest: release(), adapter, verify: async () => { throw new Error('corrupt bytes'); }, save: async item => receipts.push(structuredClone(item)) }), /corrupt bytes/);
  assert.equal(receipts.at(-1).status, 'incomplete');
  assert.equal(adapter.calls.includes('publish:android'), false);
});
test('wrong commit, runtime, platform and rollback results are rejected', () => {
  const target = TARGETS[0];
  for (const patch of [{ gitCommitHash: 'b'.repeat(40) }, { runtimeVersion: 'preview' }, { platform: 'android' }, { isRollBackToEmbedded: true }]) assert.throws(() => assertUpdate({ ...update(target), ...patch }, target, sha));
});
test('review channels and moving references cannot enter a public release', async () => {
  for (const manifest of [{ ...release(), sourceSha: 'main' }, { ...release(), targets: [{ ...release().targets[0], channel: 'apple-review' }, release().targets[1]] }]) await assert.rejects(coordinateRelease({ manifest, adapter: provider(), verify: verified, save: async () => {} }));
});
test('public target environments remove inherited review flags and arbitrary public values', () => {
  for (const target of TARGETS) {
    const env = releaseEnvironment(target, { PATH: '/safe', EXPO_TOKEN: 'fictional-token', EXPO_PUBLIC_CUSTOM_OVERRIDE: 'evil', EXPO_PUBLIC_SUPABASE_URL: 'https://wrong.invalid', EXPO_PUBLIC_PSI_GOOGLE_REVIEW: 'true', EXPO_PUBLIC_ASK_PSI_DEVICE_QA: 'true' });
    assert.equal(env.EXPO_PUBLIC_CUSTOM_OVERRIDE, undefined);
    assert.equal(env.EXPO_PUBLIC_PSI_GOOGLE_REVIEW, 'false');
    assert.equal(env.EXPO_PUBLIC_ASK_PSI_DEVICE_QA, 'false');
    assert.equal(env.EXPO_PUBLIC_SUPABASE_URL, 'https://lslhfrujyuqcavsnugfx.supabase.co');
    assert.equal(env.EAS_BUILD_PLATFORM, target.platform);
    assert.equal(env.EXPO_TOKEN, 'fictional-token');
  }
});
test('provider JSON headings are handled without guessing state', () => {
  assert.deepEqual(commandJson('Channel: test\n\n{ "currentPage": { "name": "test" } }'), { currentPage: { name: 'test' } });
  assert.throws(() => commandJson('connection failed'));
});

function deliveryFixture() {
  const bundle = Buffer.from('fictional hermes bundle'), asset = Buffer.from('fictional background');
  const target = { ...TARGETS[0], bundle: { sha256: hash(bundle) }, assets: [{ sha256: hash(asset) }] }, item = update(TARGETS[0]);
  const manifest = { id: item.id, runtimeVersion: target.runtime, launchAsset: { url: 'https://example.invalid/bundle', key: 'bundle' }, extra: { expoClient: { extra: { eas: { projectId: PROJECT_ID }, psiDemoModeAvailable: true } } }, assets: [{ url: 'https://example.invalid/asset', key: 'asset', hash: Buffer.from(hash(asset), 'hex').toString('base64url') }] };
  const calls = [];
  const fetcher = async (url, options) => { calls.push({ url, headers: options.headers }); return url.includes('u.expo.dev') ? new Response(JSON.stringify(manifest), { status: 200, headers: { 'content-type': 'application/expo+json' } }) : new Response(url.endsWith('/bundle') ? bundle : asset, { status: 200 }); };
  return { target, item, manifest, fetcher, calls };
}
test('customer feed headers and every delivered byte are verified', async () => {
  const fixture = deliveryFixture(), result = await verifyDelivery(fixture.target, fixture.item, { fetcher: fixture.fetcher });
  assert.equal(result.deliveredBytesMatchPreparedExport, true);
  assert.equal(result.verifiedAssetCount, 1);
  assert.equal(fixture.calls[0].headers['expo-channel-name'], TARGETS[0].channel);
  assert.equal(fixture.calls[0].headers['expo-runtime-version'], TARGETS[0].runtime);
  assert.equal(fixture.calls.length, 3);
});
test('stale update, wrong runtime or project, missing assets and corrupt bytes fail', async () => {
  for (const mutate of [f => { f.manifest.id = 'stale'; }, f => { f.manifest.runtimeVersion = 'wrong'; }, f => { f.manifest.extra.expoClient.extra.eas.projectId = 'wrong'; }, f => { f.manifest.assets = []; }, f => { f.target.bundle.sha256 = hash(Buffer.from('corrupt')); }, f => { f.manifest.extra.expoClient.extra.psiAskPsiDeviceQa = true; }]) {
    const fixture = deliveryFixture(); mutate(fixture);
    await assert.rejects(verifyDelivery(fixture.target, fixture.item, { fetcher: fixture.fetcher, wait: async () => {} }));
  }
});
async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'psi-release-test-'));
  t.after(async () => { assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep + 'psi-release-test-')); await fs.rm(directory, { recursive: true, force: true }); });
  return directory;
}
test('artifact tampering and unsafe paths are rejected before publishing', async t => {
  const directory = await temporary(t), target = TARGETS[0];
  await fs.writeFile(path.join(directory, 'bundle.hbc'), 'fixture');
  const metadata = { fileMetadata: { ios: { bundle: 'bundle.hbc', assets: [] } } };
  await fs.writeFile(path.join(directory, 'metadata.json'), JSON.stringify(metadata));
  const prepared = await describeExport(directory, target);
  await verifyExport(directory, prepared);
  await fs.writeFile(path.join(directory, 'bundle.hbc'), 'modified');
  await assert.rejects(verifyExport(directory, prepared));
  metadata.fileMetadata.ios.bundle = '../outside.hbc';
  await fs.writeFile(path.join(directory, 'metadata.json'), JSON.stringify(metadata));
  await assert.rejects(describeExport(directory, target), /Unsafe export path/);
});
test('native changes block OTA while JavaScript content changes remain compatible', async t => {
  const fixture = await temporary(t), baseline = JSON.parse(await fs.readFile(path.join(root, 'release-native-baselines.json'), 'utf8'));
  const files = new Set(['app.config.js', 'app.json', 'package.json', 'eas.json', 'release-native-baselines.json', ...Object.keys(baseline.contract.files)]);
  for (const entry of await fs.readdir(root)) if (entry.endsWith('.cjs')) files.add(entry);
  for (const file of files) { await fs.mkdir(path.dirname(path.join(fixture, file)), { recursive: true }); await fs.copyFile(path.join(root, file), path.join(fixture, file)); }
  // Test the deployed contract even while a new native store candidate is prepared.
  const baselineApp = JSON.parse(await fs.readFile(path.join(fixture, 'app.json'), 'utf8'));
  baselineApp.expo.plugins = baseline.contract.platforms.ios.plugins;
  baselineApp.expo.version = baseline.contract.platforms.ios.version;
  const deployedAppJson = JSON.stringify(baselineApp);
  await fs.writeFile(path.join(fixture, 'app.json'), deployedAppJson);
  verifyNativeContract(fixture);
  await fs.mkdir(path.join(fixture, 'src'));
  await fs.writeFile(path.join(fixture, 'src/example.tsx'), 'const content = "New information";');
  verifyNativeContract(fixture);
  const pkg = JSON.parse(await fs.readFile(path.join(fixture, 'package.json'), 'utf8')); pkg.dependencies['react-native'] = '999.0.0';
  await fs.writeFile(path.join(fixture, 'package.json'), JSON.stringify(pkg));
  assert.throws(() => verifyNativeContract(fixture), /store build/);
  await fs.copyFile(path.join(root, 'package.json'), path.join(fixture, 'package.json'));
  const app = JSON.parse(await fs.readFile(path.join(fixture, 'app.json'), 'utf8')); app.expo.android.permissions = ['android.permission.RECORD_AUDIO'];
  await fs.writeFile(path.join(fixture, 'app.json'), JSON.stringify(app));
  assert.throws(() => verifyNativeContract(fixture), /store build/);
  await fs.writeFile(path.join(fixture, 'app.json'), deployedAppJson);
  await fs.appendFile(path.join(fixture, 'assets/images/psi-app-icon-1024.png'), 'changed');
  assert.throws(() => verifyNativeContract(fixture), /store build/);
});
