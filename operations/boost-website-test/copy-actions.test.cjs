const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, 'message-actions.js'), 'utf8');
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.attributes = {}; }
  append(...children) { this.children.push(...children); }
  get childElementCount() { return this.children.length; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
}
function elements(root, predicate) {
  return [root, ...root.children.flatMap(child => elements(child, predicate))].filter(predicate);
}
function setup(clipboard, getEnquiry = () => 'Vehicle: Holden VF\nWork: Cam package', message = {}, active = true) {
  const sent = [], item = new Element('article');
  const context = { window: { navigator: { clipboard }, BoostKnowledge: { LINKS: { apple: { label: 'Apple App Store', url: 'https://example.test/apple' } } } }, document: { createElement: tag => new Element(tag) } };
  vm.runInNewContext(source, context);
  context.window.appendBoostActions(item, { role: 'boost', copyEnquiry: true, ...message }, text => sent.push(text), active, getEnquiry);
  return {
    item, sent,
    button: elements(item, element => element.tag === 'button' && element.textContent === 'Copy my enquiry')[0],
    status: elements(item, element => element.attributes.role === 'status')[0],
    draft: elements(item, element => element.tag === 'textarea')[0],
    fallback: elements(item, element => element.tag === 'label')[0],
  };
}

test('copy requires a click and reports success only after clipboard write completes', async () => {
  const copied = [];
  let finish;
  const draft = 'Vehicle: Holden VF\nWork: Cam package';
  const ui = setup({ writeText: text => { copied.push(text); return new Promise(resolve => { finish = resolve; }); } }, () => draft, { text: 'Unrelated conversation content' });
  assert.deepEqual(copied, []);
  const pending = ui.button.listeners.click();
  assert.equal(ui.button.disabled, true);
  assert.doesNotMatch(ui.status.textContent, /copied/i);
  assert.deepEqual(copied, [draft]);
  finish(); await pending;
  assert.match(ui.status.textContent, /Enquiry copied/);
  assert.match(ui.status.textContent, /Nothing has been sent/);
  assert.equal(ui.status.attributes['aria-live'], 'polite');
  assert.equal(ui.button.disabled, false);
  assert.equal(ui.fallback.hidden, true);
  assert.deepEqual(ui.sent, []);
});

for (const [label, clipboard] of [
  ['missing clipboard API', undefined],
  ['denied clipboard permission', { writeText: async () => { throw new Error('NotAllowedError'); } }],
]) {
  test(`${label} exposes selectable draft without claiming success or sending`, async () => {
    const ui = setup(clipboard);
    await ui.button.listeners.click();
    assert.match(ui.status.textContent, /Copy was unavailable/);
    assert.doesNotMatch(ui.status.textContent, /Enquiry copied/);
    assert.equal(ui.fallback.hidden, false);
    assert.equal(ui.draft.readOnly, true);
    assert.equal(ui.draft.value, 'Vehicle: Holden VF\nWork: Cam package');
    assert.equal(ui.draft.focused, true);
    assert.equal(ui.draft.selected, true);
    assert.deepEqual(ui.sent, []);
  });
}

test('empty draft does not access clipboard or expose unrelated message text', async () => {
  let writes = 0;
  const ui = setup({ writeText: async () => { writes++; } }, () => null, { text: 'Private conversation' });
  await ui.button.listeners.click();
  assert.equal(writes, 0);
  assert.match(ui.status.textContent, /no enquiry to copy/);
  assert.equal(ui.draft.value, '');
  assert.equal(ui.fallback.hidden, true);
  assert.equal(ui.button.disabled, false);
  assert.deepEqual(ui.sent, []);
});

test('copy is available only for an active Boost draft and preserves link and question actions', () => {
  assert.equal(setup(undefined, undefined, { copyEnquiry: false }).button, undefined);
  assert.equal(setup(undefined, undefined, {}, false).button, undefined);
  assert.equal(setup(undefined, undefined, { role: 'visitor' }).button, undefined);
  const ui = setup(undefined, undefined, { links: ['apple', 'untrusted'], prompts: ['Keep chatting', 'Message PSI'] });
  const anchors = elements(ui.item, element => element.tag === 'a');
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].href, 'https://example.test/apple');
  assert.equal(anchors[0].rel, 'noopener noreferrer');
  const prompt = elements(ui.item, element => element.tag === 'button' && element.textContent === 'Keep chatting')[0];
  prompt.listeners.click();
  assert.deepEqual(ui.sent, ['Keep chatting']);
});
