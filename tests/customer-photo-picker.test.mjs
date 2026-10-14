import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const ts = createRequire(new URL('../mobile/package.json', import.meta.url))('typescript');
const asset = { uri: 'file://selected.jpg', width: 800, height: 600, mimeType: 'image/jpeg' };

async function mount(component, platform, cameraGranted = false) {
  const code = ts.transpileModule(await readFile(new URL(`../mobile/src/components/${component}.tsx`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const slots = []; let cursor = 0; let tree; let selected; let libraryCalls = 0; let cameraCalls = 0;
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const modules = {
    react: { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { Platform: { OS: platform }, StyleSheet: { create: v => v }, ActivityIndicator: 'ActivityIndicator', Image: 'Image', Pressable: 'Pressable', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '@/constants/brand': { colors: {}, spacing: {}, mobileFrame: {} },
    '@/components/garage-photo-framing': { GaragePhotoFraming: 'Framing' },
    'expo-image-picker': {
      requestMediaLibraryPermissionsAsync: async () => { throw new Error('Broad library permission must not be requested'); },
      requestCameraPermissionsAsync: async () => ({ granted: cameraGranted }),
      launchImageLibraryAsync: async options => { libraryCalls++; assert.equal(options.allowsEditing, false); assert.deepEqual(Array.from(options.mediaTypes), ['images']); return { canceled: false, assets: [asset] }; },
      launchCameraAsync: async () => { cameraCalls++; return { canceled: false, assets: [asset] }; },
    },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  const render = () => { cursor = 0; tree = component === 'vehicle-photo-picker'
    ? exports.VehiclePhotoPicker({ value: null, onChange: value => { selected = value; } })
    : exports.ProfilePhotoPicker({ initials: 'AB', uri: null, saving: false, onChange: value => { selected = value; } }); };
  const nodes = value => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
  const press = async label => {
    render();
    let button = nodes(tree).find(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
    if (!button) { const action = nodes(tree).find(n => n.props.label === label); assert.ok(action, label); button = action.type(action.props); }
    await button.props.onPress();
    await new Promise(resolve => setImmediate(resolve)); render();
  };
  render();
  return { press, nodes: () => nodes(tree), selected: () => selected, libraryCalls: () => libraryCalls, cameraCalls: () => cameraCalls };
}

for (const platform of ['android', 'ios', 'web']) {
  for (const component of ['vehicle-photo-picker', 'profile-photo-picker']) {
    test(`${platform} ${component} selects photos without library permission and preserves camera consent`, async () => {
      const app = await mount(component, platform);
      await app.press(component === 'vehicle-photo-picker' ? 'Choose a photo of your vehicle' : 'Choose photo');
      assert.equal(app.libraryCalls(), 1);
      if (component === 'vehicle-photo-picker') {
        const framing = app.nodes().find(n => n.type === 'Framing');
        assert.equal(framing.props.photo.uri, asset.uri);
        framing.props.onSave(framing.props.photo);
      }
      assert.equal(app.selected().uri, asset.uri);
      await app.press(component === 'vehicle-photo-picker' ? 'Take a photo from camera' : 'Take photo');
      assert.equal(app.cameraCalls(), 0);
      assert.ok(app.nodes().some(n => n.props?.children?.includes?.('Camera permission')));
    });
  }
}
