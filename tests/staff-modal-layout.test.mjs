import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const mobileRequire = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = mobileRequire('typescript');
const { default: Yoga } = await import(pathToFileURL(mobileRequire.resolve('yoga-layout')));
const read = file => readFileSync(new URL(`../mobile/src/${file}`, import.meta.url), 'utf8');
const jsx = (type, props) => ({ type, props: props ?? {} });
const native = { Modal: 'Modal', StyleSheet: { create: value => value }, Platform: { OS: 'android' } };
function execute(source, modules) {
  const result = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, { exports: result.exports, require(id) {
    assert.ok(id in modules, `Unexpected layout dependency ${id}`); return modules[id];
  } });
  return result.exports;
}
const brand = execute(read('constants/brand.ts'), { 'react-native': native });
const { StaffModal } = execute(read('components/staff-modal.tsx'), {
  'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
  'react-native-safe-area-context': { SafeAreaProvider: 'Provider', SafeAreaView: 'Safe' },
  '@/constants/brand': brand,
});

test('each portal modal measures its own native window and protects all four edges', () => {
  const close = () => {}, content = { type: 'Content' };
  for (const transparent of [true, false]) {
    const modal = StaffModal({ visible: true, transparent, animationType: 'slide', onRequestClose: close, children: content });
    assert.equal(modal.type, 'Modal');
    assert.equal(modal.props.onRequestClose, close);
    assert.equal(modal.props.visible, true);
    assert.equal(modal.props.transparent, transparent);
    const provider = modal.props.children;
    assert.equal(provider.type, 'Provider');
    assert.equal(provider.props.initialMetrics, undefined, 'Reopened or rotated windows must be measured again');
    const safe = provider.props.children;
    assert.equal(safe.type, 'Safe');
    assert.deepEqual(Array.from(safe.props.edges), ['top', 'right', 'bottom', 'left']);
    assert.equal(safe.props.children, content);
  }
});

test('all native portal popups use the protected boundary, with no duplicate inset views', () => {
  for (const file of ['components/staff-vault-publisher.tsx', 'components/staff-scroll-select.tsx',
    'components/staff-vehicle-history.tsx', 'components/staff-record-workflow.tsx',
    'hooks/use-staff-discard-confirmation.tsx', 'app/staff.tsx']) {
    const source = read(file);
    assert.match(source, /<StaffModal\b/, file);
    assert.doesNotMatch(source, /<Modal\b/, file);
    if (file !== 'app/staff.tsx') assert.doesNotMatch(source, /<SafeAreaView\b/, `Avoid double padding in ${file}`);
  }
});

function styles(file) {
  const source = read(file), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'styles') expression = node.initializer.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression);
  return vm.runInNewContext(expression, { StyleSheet: native.StyleSheet, ...brand });
}
const invoice = styles('components/staff-vault-publisher.tsx');
const ui = styles('components/ui.tsx');
const select = styles('components/staff-scroll-select.tsx');
const flatten = value => Object.assign({}, ...[value].flat(Infinity).filter(Boolean));

function apply(node, style) {
  const s = flatten(style);
  for (const [key, setter] of Object.entries({ flex: 'setFlex', flexGrow: 'setFlexGrow', flexShrink: 'setFlexShrink',
    width: 'setWidth', height: 'setHeight', minWidth: 'setMinWidth', minHeight: 'setMinHeight' })) {
    if (s[key] !== undefined) node[setter](s[key]);
  }
  if (s.flexDirection === 'row') node.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  if (s.alignItems === 'center') node.setAlignItems(Yoga.ALIGN_CENTER);
  if (s.justifyContent === 'space-between') node.setJustifyContent(Yoga.JUSTIFY_SPACE_BETWEEN);
  if (s.gap) node.setGap(Yoga.GUTTER_ALL, s.gap);
  for (const [key, edge] of [['padding', Yoga.EDGE_ALL], ['paddingHorizontal', Yoga.EDGE_HORIZONTAL],
    ['paddingVertical', Yoga.EDGE_VERTICAL], ['paddingTop', Yoga.EDGE_TOP], ['paddingBottom', Yoga.EDGE_BOTTOM],
    ['paddingLeft', Yoga.EDGE_LEFT], ['paddingRight', Yoga.EDGE_RIGHT]]) {
    if (s[key] !== undefined) node.setPadding(edge, s[key]);
  }
  if (s.borderWidth) node.setBorder(Yoga.EDGE_ALL, s.borderWidth);
}
function measuredText(text, style, scale) {
  const node = Yoga.Node.create(); apply(node, style);
  const s = flatten(style), font = (s.fontSize ?? 18) * scale;
  node.setMeasureFunc(width => {
    const natural = text.length * font * .72;
    return { width: Math.min(natural, width), height: Math.ceil(natural / Math.max(width, 1)) * (s.lineHeight ?? font * 1.3) * (s.lineHeight ? scale : 1) };
  });
  return node;
}

test('Invoice review Close stays inside measured cutouts at narrow widths, landscape and 200 percent text', () => {
  const fixtures = [
    [320, 568, { top: 20, right: 0, bottom: 0, left: 0 }],
    [390, 844, { top: 59, right: 0, bottom: 34, left: 0 }],
    [393, 852, { top: 62, right: 0, bottom: 34, left: 0 }],
    [360, 780, { top: 32, right: 0, bottom: 24, left: 0 }],
    [844, 390, { top: 0, right: 59, bottom: 21, left: 59 }],
  ];
  for (const [width, height, insets] of fixtures) for (const scale of [1, 1.5, 2]) {
    const root = Yoga.Node.create(); root.setWidth(width); root.setHeight(height);
    const safe = Yoga.Node.create(); apply(safe, { flex: 1, paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left }); root.insertChild(safe, 0);
    const header = Yoga.Node.create(); apply(header, invoice.sheetHeading); safe.insertChild(header, 0);
    const title = measuredText('Invoice review', [invoice.title, invoice.sheetTitle], scale); header.insertChild(title, 0);
    const close = Yoga.Node.create(); apply(close, [ui.button, ui.buttonOutline, ui.buttonStaff, invoice.sheetClose]);
    close.insertChild(measuredText('Close', [ui.buttonText, ui.buttonTextStaff], scale), 0); header.insertChild(close, 1);
    root.calculateLayout(width, height, Yoga.DIRECTION_LTR);
    const left = safe.getComputedLeft() + header.getComputedLeft() + close.getComputedLeft();
    const top = safe.getComputedTop() + header.getComputedTop() + close.getComputedTop();
    const info = `${width}x${height}, font ${scale}`;
    assert.ok(top >= insets.top, `Status bar collision: ${info}`);
    assert.ok(left >= insets.left && left + close.getComputedWidth() <= width - insets.right + .1, `Close clipped: ${info}`);
    assert.ok(top + close.getComputedHeight() <= height - insets.bottom, `Close below window: ${info}`);
    assert.ok(close.getComputedHeight() >= 48, `Touch target too small: ${info}`);
    assert.ok(title.getComputedLeft() + title.getComputedWidth() <= close.getComputedLeft(), `Heading overlaps Close: ${info}`);
    root.freeRecursive();
  }
});

test('searchable dropdown keeps a fixed close target and lets its option list shrink', () => {
  assert.ok(select.closeButton.height >= 48 && select.closeButton.width >= 48);
  assert.equal(select.optionList.flexShrink, 1);
  assert.match(read('components/staff-scroll-select.tsx'), /<KeyboardAvoidingView\b/);
});
