import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const root = fileURLToPath(new URL('../mobile/', import.meta.url));
const pluginRoot = path.join(path.dirname(require.resolve('expo-splash-screen/package.json')), 'plugin/build');
const { getIosSplashConfig } = require(path.join(pluginRoot, 'getIosSplashConfig.js'));
const { getAndroidSplashConfig } = require(path.join(pluginRoot, 'getAndroidSplashConfig.js'));
const { getTemplateAsync } = require(path.join(pluginRoot, 'withIosSplashScreenStoryboard.js'));
const { applySplashScreenStoryboard } = require(path.join(pluginRoot, 'withIosSplashScreenStoryboardImage.js'));
const { setSplashImageDrawablesAsync } = require(path.join(pluginRoot, 'withAndroidSplashImages.js'));
const { TARGETS, resolvedReleaseConfig } = require('../mobile/scripts/mobile-release-config.cjs');
const { nativeContract } = require('../mobile/scripts/native-release-guard.cjs');
const config = JSON.parse(await fs.readFile(path.join(root, 'app.json'), 'utf8')).expo;
const splash = config.plugins.find(item => Array.isArray(item) && item[0] === 'expo-splash-screen')[1];

test('iPhone native launch and React loading use the same approved Tori artwork', async () => {
  const ios = getIosSplashConfig(splash);
  assert.equal(ios.image, './assets/images/psi-startup-tori-yellow-calipers.png');
  assert.equal(ios.enableFullScreenImage_legacy, true);
  assert.equal(ios.resizeMode, 'cover');
  assert.equal(ios.backgroundColor, '#050505');
  const screen = await fs.readFile(path.join(root, 'src/components/garage-startup-screen.tsx'), 'utf8');
  assert(screen.includes(ios.image.slice(2)));
  assert.match(screen, /resizeMode="cover"/);
  assert.doesNotMatch(JSON.stringify(splash), /psi-splash-logo/);
});

test('the installed Expo plugin produces an edge to edge aspect fill iPhone storyboard', async () => {
  const storyboard = applySplashScreenStoryboard(await getTemplateAsync(), getIosSplashConfig(splash));
  const view = storyboard.document.scenes[0].scene[0].objects[0].viewController[0].view[0];
  const image = view.subviews[0].imageView.find(item => item.$.id === 'EXPO-SplashScreen');
  assert.equal(image.$.image, 'SplashScreenLegacy');
  assert.equal(image.$.contentMode, 'scaleAspectFill');
  const constraints = view.constraints[0].constraint;
  assert.equal(constraints.length, 4);
  assert.deepEqual(constraints.map(item => item.$.firstAttribute).sort(), ['bottom', 'leading', 'top', 'trailing']);
  await fs.mkdir(new URL('../work/startup-single-2026-10-28/', import.meta.url), { recursive: true });
  await fs.writeFile(new URL('../work/startup-single-2026-10-28/ios-storyboard-verified.json', import.meta.url), JSON.stringify(storyboard, null, 2));
});

test('Android generates a transparent system launch drawable without a separate logo', async () => {
  const base = fileURLToPath(new URL('../work/startup-single-2026-10-28/', import.meta.url));
  await fs.mkdir(base, { recursive: true });
  const fixture = await fs.mkdtemp(path.join(base, 'android-native-fixture-'));
  assert(path.resolve(fixture).startsWith(path.resolve(base) + path.sep));
  // Expo clears generated splash resources only inside this verified empty fixture.
  await fs.mkdir(path.join(fixture, 'assets'), { recursive: true });
  await fs.copyFile(path.join(root, 'assets/android-launch-empty.xml'), path.join(fixture, 'assets/android-launch-empty.xml'));
  await setSplashImageDrawablesAsync(getAndroidSplashConfig(splash), fixture);
  const generated = await fs.readFile(path.join(fixture, 'android/app/src/main/res/drawable/splashscreen_logo.xml'), 'utf8');
  assert.match(generated, /fillColor="#00000000"/);
  assert.doesNotMatch(generated, /psi-splash-logo|bitmap|mipmap/);
});

test('the candidate retains the installed runtimes, package, updater, icon and backend configuration', async () => {
  const baseline = JSON.parse(await fs.readFile(path.join(root, 'release-native-baselines.json'), 'utf8')).contract;
  const candidate = nativeContract();
  assert.deepEqual(candidate.dependencies, baseline.dependencies);
  for (const target of TARGETS) {
    const current = resolvedReleaseConfig(target);
    assert.equal(current.runtimeVersion, target.runtime);
    assert.equal(current.icon, baseline.platforms[target.platform].icon);
    assert.equal(current.ios.bundleIdentifier, 'com.psiperformance.booking');
    assert.equal(current.android.package, 'com.psiperformance.booking');
    const previous = structuredClone(baseline.platforms[target.platform]);
    const next = structuredClone(candidate.platforms[target.platform]);
    delete previous.plugins; delete next.plugins;
    delete previous.version; delete next.version;
    assert.deepEqual(next, previous);
  }
  const changedArtwork = new Set(['assets/images/psi-splash-logo.png', 'assets/images/psi-startup-tori-yellow-calipers.png', 'assets/android-launch-empty.xml']);
  for (const [name, hash] of Object.entries(baseline.files)) {
    if (!changedArtwork.has(name)) assert.equal(candidate.files[name], hash, name);
  }
});

test('the real startup gate keeps Home mounted but hidden until the chosen garage artwork is ready', async () => {
  const ts = require('typescript');
  const input = await fs.readFile(path.join(root, 'src/app/_layout.tsx'), 'utf8') + '\nexport { GarageStartupGate };';
  const compiled = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const api = {}; let ready = false, hidden = 0;
  vm.runInNewContext(compiled, { exports: api, require(name) {
    if (name === 'react') return { useEffect: effect => effect() };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === 'react-native') return { View: 'View', StyleSheet: { create: value => value } };
    if (name === 'expo-splash-screen') return { preventAutoHideAsync: async () => {}, hideAsync: async () => { hidden++; } };
    if (name.includes('use-private-garage-artwork')) return { useGarageStartupArtwork: () => ({ ready }) };
    if (name.includes('garage-startup-screen')) return { GarageStartupScreen: 'ToriLoadingArtwork' };
    return {};
  } });
  const pending = api.GarageStartupGate({ children: 'HOME AND NOTIFICATION NAVIGATOR' });
  assert.equal(pending.props.children[0].props.children, 'HOME AND NOTIFICATION NAVIGATOR');
  assert.equal(pending.props.children[0].props.pointerEvents, 'none');
  assert.equal(pending.props.children[0].props.accessibilityElementsHidden, true);
  assert.equal(pending.props.children[1].type, 'ToriLoadingArtwork');
  assert.equal(hidden, 0);
  ready = true;
  const opened = api.GarageStartupGate({ children: 'HOME AND NOTIFICATION NAVIGATOR' });
  assert.equal(opened.props.children[0].props.pointerEvents, 'auto');
  assert.equal(opened.props.children[1], null);
  assert.equal(hidden, 1);
});
