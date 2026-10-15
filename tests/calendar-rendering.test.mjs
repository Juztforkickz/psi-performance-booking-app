import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const { default: Yoga } = await import(pathToFileURL(requireMobile.resolve('yoga-layout')));
function compile(path, dependencies = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: id => {
    assert(id in dependencies, `Unexpected dependency ${id}`); return dependencies[id];
  } });
  return module.exports;
}
const dates = compile('../mobile/src/lib/australian-date.ts');
// Independent Gregorian arithmetic, rather than comparing two Date-based paths.
const leap = y => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
const monthLength = (y, m) => [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
function weekday(y, m, d) {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (m < 3) y--;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + offsets[m - 1] + d) % 7;
}
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const children = node => [node?.props?.children].flat(Infinity).filter(v => v && typeof v === 'object');
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
let slots = [], cursor = 0;
const { MonthCalendarPicker } = compile('../mobile/src/components/month-calendar-picker.tsx', {
  react: {
    useMemo: fn => fn(),
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
  },
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: s => s } },
  '@expo/vector-icons': { Ionicons: 'Icon' },
  '@/constants/brand': { colors: {}, spacing: { sm: 8 } },
  '@/lib/australian-date': dates,
});
function render(props, reset = true) {
  if (reset) slots = [];
  cursor = 0;
  const tree = MonthCalendarPicker(props);
  const [header, headings, grid] = children(tree);
  return { tree, header, headings, weeks: children(grid) };
}

test('every day in a complete 400 year Gregorian cycle has the correct weekday and column', () => {
  let checked = 0;
  for (let y = 2000; y < 2400; y++) for (let m = 1; m <= 12; m++) {
    const grid = dates.monthCalendarGrid(y, m);
    assert.equal(dates.daysInIsoMonth(y, m), monthLength(y, m));
    assert.equal(grid.filter(d => d !== null).length, monthLength(y, m));
    for (let d = 1; d <= monthLength(y, m); d++) {
      const value = iso(y, m, d), expected = weekday(y, m, d);
      assert.equal(dates.isoWeekday(value), expected, value);
      assert.equal(grid.indexOf(d) % 7, (expected + 6) % 7, value);
      checked++;
    }
  }
  assert.equal(checked, 146097);
});

test('actual picker renders and selects every date in 2026 through 2038 under its correct heading', () => {
  for (let y = 2026; y <= 2038; y++) for (let m = 1; m <= 12; m++) {
    let selected;
    const { headings, weeks } = render({ value: iso(y, m, 1), onChange: v => { selected = v; } });
    assert.equal(children(headings).length, 7);
    let count = 0;
    for (const week of weeks) {
      const cells = children(week);
      assert.equal(cells.length, 7);
      cells.forEach((cell, column) => {
        const button = children(cell)[0];
        if (!button) return;
        const day = Number(button.props.children.props.children);
        const value = iso(y, m, day), expected = weekday(y, m, day);
        assert.equal(column, (expected + 6) % 7, value);
        assert(button.props.accessibilityLabel.startsWith(`${weekdayNames[expected]}, `), value);
        button.props.onPress();
        assert.equal(selected, value);
        count++;
      });
    }
    assert.equal(count, monthLength(y, m));
  }
});

function yogaRow(width, rowStyle, cellStyles, scale) {
  const config = Yoga.Config.create(); config.setPointScaleFactor(scale);
  const row = Yoga.Node.create(config); row.setWidth(width);
  row.setFlexDirection(Yoga.FLEX_DIRECTION_ROW);
  row.setFlexWrap(rowStyle.flexWrap === 'wrap' ? Yoga.WRAP_WRAP : Yoga.WRAP_NO_WRAP);
  cellStyles.forEach((style, i) => {
    const child = Yoga.Node.create(config);
    if (style.width) child.setWidthPercent(parseFloat(style.width));
    if (style.flex) child.setFlex(style.flex);
    if (style.minWidth !== undefined) child.setMinWidth(style.minWidth);
    child.setHeight(40); row.insertChild(child, i);
  });
  row.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
  const boxes = cellStyles.map((_, i) => row.getChild(i).getComputedLayout());
  row.freeRecursive(); config.free(); return boxes;
}
test('native layout keeps all seven dates on their weekday row at integer and fractional phone widths', () => {
  const { headings, weeks } = render({ value: '2026-10-01', onChange() {} });
  const cellStyles = children(weeks[0]).map(n => n.props.style);
  const headingStyles = children(headings).map(n => n.props.style);
  // The former wrapping layout reproducibly placed Sunday on the next row.
  assert(yogaRow(216, { flexWrap: 'wrap' }, Array(7).fill({ width: `${100 / 7}%` }), 1)[6].top > 0);
  for (const scale of [1, 2, 3]) for (let width = 200; width <= 1000; width += 0.25) {
    const boxes = yogaRow(width, weeks[0].props.style, cellStyles, scale);
    const labels = yogaRow(width, headings.props.style, headingStyles, scale);
    for (let col = 0; col < 7; col++) {
      assert.equal(boxes[col].top, 0, `${width} at ${scale}x column ${col}`);
      assert.equal(boxes[col].left, labels[col].left);
      assert.equal(boxes[col].width, labels[col].width);
      assert(boxes[col].width > 0);
    }
  }
});

test('navigation, leap day, bounds and availability preserve exact selected dates', () => {
  let chosen;
  const props = { value: '2028-02-29', minimumDate: '2028-02-10', maximumDate: '2028-03-05', isDateEnabled: v => weekday(...v.split('-').map(Number)) !== 0, onChange: v => { chosen = v; } };
  let result = render(props);
  const buttons = result.weeks.flatMap(w => children(w).flatMap(c => children(c)));
  const feb29 = buttons.find(b => b.props.accessibilityLabel === 'Tuesday, 29 February 2028');
  assert(feb29.props.accessibilityState.selected); feb29.props.onPress(); assert.equal(chosen, '2028-02-29');
  assert(buttons.find(b => b.props.accessibilityLabel.startsWith('Wednesday, 9 February')).props.disabled);
  assert(buttons.find(b => b.props.accessibilityLabel.startsWith('Sunday, 13 February')).props.disabled);
  children(result.header)[2].props.onPress(); result = render(props, false);
  assert.equal(children(result.header)[1].props.children, 'March 2028');
  assert(children(result.header)[2].props.disabled);
  children(result.header)[0].props.onPress(); result = render(props, false);
  assert.equal(children(result.header)[1].props.children, 'February 2028');
});
