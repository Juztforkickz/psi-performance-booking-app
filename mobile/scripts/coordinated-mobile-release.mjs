import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import config from './mobile-release-config.cjs';
import guard from './native-release-guard.cjs';

const { MOBILE_ROOT, PROJECT_ID, TARGETS, releaseEnvironment } = config;
export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const shaPattern = /^[a-f0-9]{40}$/;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const jsonFile = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const writeJson = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');

export function command(program, args, options = {}) {
  const result = spawnSync(program, args, { cwd: MOBILE_ROOT, env: process.env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) {
    // Provider logs can contain signed URLs. Never echo raw output into public CI logs.
    throw new Error(`Release command failed: ${path.basename(program)} ${args[0] ?? ''}, exit ${result.status ?? 'unavailable'}`);
  }
  return result.stdout.trim();
}

export function commandJson(text) {
  const start = text.search(/^(?:\{|\[)/m);
  assert.ok(start >= 0, 'Provider did not return JSON');
  return JSON.parse(text.slice(start));
}

function checkedFile(directory, relative) {
  assert.equal(typeof relative, 'string');
  const normal = relative.replaceAll('\\', '/');
  assert.ok(!normal.split('/').includes('..') && !path.isAbsolute(normal) && !normal.includes(':'), 'Unsafe export path');
  const full = path.resolve(directory, normal);
  assert.ok(full.startsWith(path.resolve(directory) + path.sep), 'Export path escaped its directory');
  return full;
}

export async function describeExport(directory, target) {
  const metadata = await jsonFile(path.join(directory, 'metadata.json'));
  assert.deepEqual(Object.keys(metadata.fileMetadata), [target.platform], 'An export must contain exactly its intended phone platform');
  const platform = metadata.fileMetadata[target.platform];
  assert.ok(platform.bundle.endsWith('.hbc'), 'Expected a production Hermes bundle');
  const describe = async relative => ({ path: relative.replaceAll('\\', '/'), sha256: hash(await fs.readFile(checkedFile(directory, relative))) });
  return { ...target, bundle: await describe(platform.bundle),
    assets: await Promise.all([...new Set(platform.assets.map(asset => asset.path))].map(describe)),
    metadataSha256: hash(await fs.readFile(path.join(directory, 'metadata.json'))) };
}

export async function verifyExport(directory, expected) {
  assert.deepEqual(await describeExport(directory, expected), expected, 'Prepared release files were modified');
}

export function parseManifest(text, contentType) {
  const boundary = contentType?.match(/boundary="?([^";]+)/)?.[1];
  let manifest, extensions;
  for (const part of boundary ? text.split('--' + boundary) : [text]) {
    const start = boundary ? part.indexOf('\r\n\r\n') : -4;
    if (start === -1) continue;
    try {
      const value = JSON.parse(part.slice(start + 4).trim());
      if (value.id && value.launchAsset) manifest = value;
      else if (value.assetRequestHeaders) extensions = value;
    } catch { /* Non-manifest multipart sections are permitted. */ }
  }
  assert.ok(manifest, 'Update service did not return a launch manifest');
  return { manifest, extensions };
}

export async function verifyDelivery(target, update, { fetcher = fetch, verifiedAssets = new Set(), wait = sleep } = {}) {
  let parsed;
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetcher(`https://u.expo.dev/${PROJECT_ID}`, { signal: AbortSignal.timeout(30000), headers: {
      accept: 'multipart/mixed,application/expo+json,application/json', 'expo-protocol-version': '1',
      'expo-platform': target.platform, 'expo-channel-name': target.channel, 'expo-runtime-version': target.runtime,
    } });
    assert.equal(response.status, 200, 'Live update request failed');
    parsed = parseManifest(await response.text(), response.headers.get('content-type'));
    if (parsed.manifest.id === update.id) break;
    if (attempt < 4) await wait(3000);
  }
  const { manifest, extensions } = parsed;
  assert.equal(manifest.id, update.id, 'The customer channel does not serve the expected update');
  assert.equal(manifest.runtimeVersion, target.runtime, 'Delivered native runtime mismatch');
  assert.equal(manifest.extra?.expoClient?.extra?.eas?.projectId, PROJECT_ID, 'Delivered Expo project mismatch');
  const configSnapshot = manifest.extra.expoClient;
  assert.equal(configSnapshot.extra.psiDemoModeAvailable, true);
  assert.ok(!configSnapshot.extra.psiEnvironment && !configSnapshot.extra.psiAskPsiDeviceQa && !configSnapshot.extra.psiBoostPreview, 'Non-public environment delivered');
  const verifyAsset = async (asset, expectedHash) => {
    assert.equal(new URL(asset.url).protocol, 'https:', 'Non-HTTPS update asset');
    if (verifiedAssets.has(expectedHash)) return;
    const response = await fetcher(asset.url, { signal: AbortSignal.timeout(30000), headers: extensions?.assetRequestHeaders?.[asset.key] ?? {} });
    assert.equal(response.status, 200, 'Published asset download failed');
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), expectedHash, 'Published asset hash mismatch');
    verifiedAssets.add(expectedHash);
  };
  await verifyAsset(manifest.launchAsset, target.bundle.sha256);
  const expectedHashes = new Set(target.assets.map(asset => asset.sha256));
  const actualByHash = new Map(manifest.assets.map(asset => [Buffer.from(asset.hash, 'base64url').toString('hex'), asset]));
  assert.equal(actualByHash.size, expectedHashes.size, 'Published asset set differs from the prepared export');
  const queue = [...expectedHashes];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const expectedHash = queue.pop();
      const asset = actualByHash.get(expectedHash);
      assert.ok(asset, 'Prepared asset missing from the published update');
      await verifyAsset(asset, expectedHash);
    }
  }));
  return { updateId: update.id, group: update.group, runtime: target.runtime,
    bundleSha256: target.bundle.sha256, verifiedAssetCount: expectedHashes.size,
    deliveredBytesMatchPreparedExport: true };
}

export function assertUpdate(update, target, sha) {
  assert.equal(update.platform, target.platform);
  assert.equal(update.runtimeVersion, target.runtime);
  assert.equal(update.gitCommitHash, sha, 'Published source commit differs from the approved commit');
  assert.equal(update.isRollBackToEmbedded, false);
  assert.ok(update.id && update.group);
  return update;
}

export async function coordinateRelease({ manifest, adapter, save, verify = verifyDelivery }) {
  assert.equal(manifest.schema, 1);
  assert.match(manifest.sourceSha, shaPattern);
  assert.deepEqual(manifest.targets.map(({ platform, channel, runtime }) => ({ platform, channel, runtime })), TARGETS);
  const receipt = { sourceSha: manifest.sourceSha, status: 'in_progress', platforms: [], startedAt: new Date().toISOString() };
  const verifiedAssets = new Set();
  await save(receipt);
  try {
    // Check both destinations before either can be changed.
    for (const target of manifest.targets) await adapter.preflight(target);
    for (const target of manifest.targets) {
      const item = { platform: target.platform, channel: target.channel, status: 'checking' };
      receipt.platforms.push(item);
      await save(receipt);
      let update = await adapter.find(target, manifest.sourceSha);
      if (!update) {
        item.status = 'publishing';
        await save(receipt);
        try { update = await adapter.publish(target, manifest.sourceSha); }
        catch {
          // A timeout may follow a successful provider write. Read before any retry.
          update = await adapter.find(target, manifest.sourceSha);
          if (!update) { item.status = 'publication_uncertain'; throw new Error('Publication outcome requires provider verification before retry'); }
        }
      } else item.reusedExistingPublication = true;
      assertUpdate(update, target, manifest.sourceSha);
      item.updateId = update.id;
      item.group = update.group;
      item.status = 'verifying';
      await save(receipt);
      Object.assign(item, await verify(target, update, { verifiedAssets }), { status: 'verified' });
      await save(receipt);
    }
    receipt.status = 'complete';
    receipt.completedAt = new Date().toISOString();
    await save(receipt);
    return receipt;
  } catch (error) {
    receipt.status = 'incomplete';
    receipt.error = 'Both platforms are not verified. Inspect this run before reporting or retrying the release.';
    await save(receipt);
    throw error;
  }
}

export function expoAdapter(output, eas = process.env.EAS_CLI || 'eas') {
  const invoke = (args, target) => {
    const program = eas.endsWith('.js') || eas.endsWith('/bin/run') || eas.endsWith('\\bin\\run') ? process.execPath : eas;
    return commandJson(command(program, [...(program === process.execPath ? [eas] : []), ...args], { env: releaseEnvironment(target) }));
  };
  return {
    async preflight(target) {
      const { currentPage: channel } = invoke(['channel:view', target.channel, '--json'], target);
      const mapping = JSON.parse(channel.branchMapping);
      assert.equal(channel.name, target.channel);
      assert.equal(channel.isPaused, false, 'Customer update channel is paused');
      assert.equal(channel.isProtected, false, 'A protected Expo channel requires its own authorised approval process');
      assert.equal(mapping.data.length, 1, 'Channel rollout mappings require review');
      assert.equal(mapping.data[0].branchMappingLogic, 'true');
      assert.equal(channel.updateBranches.length, 1);
      assert.equal(mapping.data[0].branchId, channel.updateBranches[0].id);
      assert.equal(channel.updateBranches[0].name, target.channel, 'Existing channel mapping changed');
    },
    async find(target, sha) {
      const marker = `[psi-release:${sha}:${target.platform}]`;
      const list = invoke(['update:list', '--branch', target.channel, '--platform', target.platform, '--runtime-version', target.runtime, '--limit', '50', '--json'], target);
      const group = list.currentPage.find(item => item.message.includes(marker))?.group;
      if (!group) return null;
      return invoke(['update:view', group, '--json'], target).find(item => item.platform === target.platform);
    },
    async publish(target, sha) {
      const result = invoke(['update', '--channel', target.channel, '--environment', 'production', '--platform', target.platform,
        '--input-dir', path.join(output, target.platform), '--skip-bundler', '--emit-metadata', '--json', '--non-interactive',
        '--message', `PSI coordinated release [psi-release:${sha}:${target.platform}]`], target);
      const update = result.find(item => item.platform === target.platform);
      return { ...update, runtimeVersion: update.runtimeVersion ?? update.runtime?.version };
    },
  };
}

async function main() {
  const [action, outputArg] = process.argv.slice(2);
  assert.ok(['prepare', 'publish'].includes(action), 'Use prepare or publish');
  assert.ok(outputArg, 'A release artifact directory is required');
  const output = path.resolve(outputArg);
  const sourceSha = command('git', ['rev-parse', 'HEAD']);
  assert.match(sourceSha, shaPattern);
  if (process.env.GITHUB_SHA) assert.equal(process.env.GITHUB_SHA, sourceSha);
  command('git', ['diff', '--quiet']);
  command('git', ['diff', '--cached', '--quiet']);
  guard.verifyNativeContract();
  for (const target of TARGETS) command(process.execPath, [path.join(MOBILE_ROOT, 'scripts/assert-ota-update-config.cjs'), target.channel], { env: releaseEnvironment(target) });
  if (action === 'prepare') {
    await fs.mkdir(output, { recursive: true });
    const targets = [];
    for (const target of TARGETS) {
      const directory = path.join(output, target.platform);
      command(process.execPath, [path.join(MOBILE_ROOT, 'node_modules/expo/bin/cli'), 'export', '--platform', target.platform,
        '--output-dir', directory, '--max-workers', '2'], { env: { ...releaseEnvironment(target), EXPO_OFFLINE: '1' } });
      targets.push(await describeExport(directory, target));
    }
    await writeJson(path.join(output, 'release-manifest.json'), { schema: 1, sourceSha, preparedAt: new Date().toISOString(), targets });
    console.log(`Prepared both phone platforms from ${sourceSha}. No update was published.`);
  } else {
    const manifest = await jsonFile(path.join(output, 'release-manifest.json'));
    assert.equal(manifest.sourceSha, sourceSha, 'Artifact source differs from checkout');
    const remoteHead = command('git', ['ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0];
    assert.equal(remoteHead, sourceSha, 'Main advanced while release approval was pending. Validate the newer release instead.');
    for (const target of manifest.targets) await verifyExport(path.join(output, target.platform), target);
    const receiptFile = path.join(output, 'release-receipt.json');
    const receipt = await coordinateRelease({ manifest, adapter: expoAdapter(output), save: value => writeJson(receiptFile, value) });
    const summary = `Both phone update feeds verified for ${sourceSha}.\n\n` + receipt.platforms.map(item => `${item.platform}: ${item.updateId}, all prepared bytes verified.`).join('\n') + '\n\nStore processing and installation on individual phones are separate observations.\n';
    console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
