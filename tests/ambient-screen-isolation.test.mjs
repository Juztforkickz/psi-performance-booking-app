import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const ts = createRequire(new URL('../mobile/package.json', import.meta.url))('typescript');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx };
function compile(source, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: id => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

const scenes = compile(read('../mobile/src/lib/ambient-scene.ts'));
function components(platform, activeTheme) {
  return compile(read('../mobile/src/components/ambient-background.tsx'), {
    'react/jsx-runtime': runtime,
    'react-native': {
      Image: 'Image', View: 'View', Platform: { OS: platform },
      StyleSheet: { create: value => value, absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
    },
    '@/lib/ambient-scene': scenes,
    '@/lib/theme-preference': { useThemePreference: () => ({ activeTheme }) },
    '../../assets/images/ambient/garage.png': 'garage.png',
    '../../assets/images/ambient/reports.png': 'reports.png',
    '../../assets/images/ambient/forms.png': 'forms.png',
  });
}
const flatten = styles => Object.assign({}, ...[styles].flat(Infinity).filter(Boolean));

// Execute the callbacks from the real navigator JSX rather than a test-only wrapper.
function navigatorWrapper(path, navigatorName, AmbientScreen) {
  const source = read(path);
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === navigatorName) {
      const attribute = node.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.text === 'screenLayout');
      callback = attribute?.initializer?.expression?.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(callback, `${navigatorName} must isolate each retained screen`);
  return compile(`import { AmbientScreen } from 'scene'; export const wrap = ${callback};`, {
    'react/jsx-runtime': runtime, scene: { AmbientScreen },
  }).wrap;
}

test('both navigators give every retained screen an opaque ambient backing without replacing its child', () => {
  for (const platform of ['web', 'ios', 'android']) for (const mode of ['dark', 'bright']) {
    const { AmbientScreen, AmbientBackground } = components(platform, mode);
    for (const [path, navigator, routeNames] of [
      ['../mobile/src/app/_layout.tsx', 'Stack', ['(tabs)', 'booking', 'account/index', 'account/sign-up', 'vehicle-reports']],
      ['../mobile/src/app/(tabs)/_layout.tsx', 'Tabs', ['index', 'garage', 'bookings', 'alerts']],
    ]) {
      const wrap = navigatorWrapper(path, navigator, AmbientScreen);
      for (const name of routeNames) {
        const child = jsx('ExistingStatefulScreen', { identity: name });
        const element = wrap({ route: { name }, children: child });
        assert.equal(element.type, AmbientScreen);
        assert.equal(element.key, undefined, 'navigation must not force new screen keys');
        assert.equal(element.props.children, child);
        const scene = AmbientScreen(element.props);
        const style = flatten(scene.props.style);
        assert.match(style.backgroundColor, /^#[\da-f]{6}$/i, `${platform} ${mode} ${name} is opaque even before its image loads`);
        assert.equal(style.flex, 1);
        assert.equal(style.minHeight, 0);
        assert.equal(scene.props.children[1], child);
        const background = scene.props.children[0];
        if (name === '(tabs)') assert.equal(background, null);
        else {
          assert.equal(background.type, AmbientBackground);
          const rendered = AmbientBackground(background.props);
          assert.match(flatten(rendered.props.style).backgroundColor, /^#[\da-f]{6}$/i);
          assert.equal(rendered.props.pointerEvents, 'none');
          assert.equal(rendered.props.accessibilityElementsHidden, true);
        }
      }
    }
  }
});

test('retained Home, booking and report scenes keep distinct route artwork', () => {
  const { AmbientScreen, AmbientBackground } = components('web', 'bright');
  for (const [routeName, expectedPath, image] of [
    ['index', '/', 'garage.png'], ['bookings', '/bookings', 'forms.png'],
    ['account/sign-up', '/account/sign-up', 'forms.png'], ['vehicle-reports', '/vehicle-reports', 'reports.png'],
  ]) {
    const scene = AmbientScreen({ routeName, children: jsx('ExistingScreen', {}) });
    const background = scene.props.children[0];
    assert.equal(background.props.pathname, expectedPath);
    assert.equal(AmbientBackground(background.props).props.children[0].props.source, image);
  }
});
