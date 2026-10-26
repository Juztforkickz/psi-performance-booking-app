const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { MOBILE_ROOT, TARGETS, resolvedReleaseConfig } = require('./mobile-release-config.cjs');

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

function nativeContract(root = MOBILE_ROOT) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const files = new Set(['pnpm-lock.yaml']);
  const walk = dir => {
    if (!fs.existsSync(path.join(root, dir))) return;
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) files.add(file);
      else throw new Error('Native inputs must be regular files');
    }
  };
  for (const dir of ['plugins', 'android', 'ios']) walk(dir);
  const platforms = {};
  for (const target of TARGETS) {
    const config = resolvedReleaseConfig(target, root);
    // All native configuration is pinned. Extra and web are bundle/web settings.
    const { extra: _extra, web: _web, ...native } = config;
    platforms[target.platform] = native;
    const collect = value => {
      if (typeof value === 'string' && value.startsWith('./assets/')) files.add(value.slice(2));
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(native);
  }
  return { dependencies: pkg.dependencies, platforms,
    files: Object.fromEntries([...files].sort().map(file => {
      const bytes = fs.readFileSync(path.join(root, file));
      const normalised = /\.(?:yaml|yml|json|[cm]?js|[cm]?ts|java|kt|gradle|properties|xml|plist|pbxproj|xcconfig|h|m|mm|swift)$/.test(file)
        ? bytes.toString('utf8').replaceAll('\r\n', '\n') : bytes;
      return [file, digest(normalised)];
    })) };
}

function verifyNativeContract(root = MOBILE_ROOT) {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'release-native-baselines.json'), 'utf8'));
  assert.equal(stable(nativeContract(root)), stable(baseline.contract),
    'Native dependencies, configuration or embedded artwork changed. A reviewed store build and explicit compatibility baseline update are required before OTA publication.');
  return baseline;
}

if (require.main === module) {
  verifyNativeContract();
  console.log('Verified both public native compatibility baselines.');
}
module.exports = { nativeContract, verifyNativeContract, stable };
