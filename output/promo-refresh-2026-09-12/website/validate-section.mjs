import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(directory, 'psi-app-launch.liquid'), 'utf8');
const schemaBlocks = [...source.matchAll(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/g)];
assert.equal(schemaBlocks.length, 1, 'Exactly one section schema');
const schema = JSON.parse(schemaBlocks[0][1]);
assert.ok(schema.name.length <= 25);
const settings = new Map(schema.settings.filter(item => item.id).map(item => [item.id, item]));
assert.equal(settings.size, schema.settings.filter(item => item.id).length, 'Unique setting IDs');
for (const name of ['launch_mode', 'ios_verified', 'android_verified']) assert.equal(settings.get(name).default, false);
for (const name of ['ios_url', 'android_url']) assert.equal(settings.get(name).default, undefined, 'No invented store URL');
assert.equal(schema.max_blocks, 10);
assert.equal(schema.presets[0].blocks.length, 10);
assert.equal(schema.presets[0].blocks.filter(item => item.settings.name).length, 10);

const withoutComments = source.replace(/{%\s*comment\s*%}[\s\S]*?{%\s*endcomment\s*%}/g, '');
const withoutSchema = withoutComments.replace(/{%\s*schema\s*%}[\s\S]*?{%\s*endschema\s*%}/g, '');
const liquidStack = [];
const starts = new Set(['if', 'unless', 'for', 'case', 'capture', 'style']);
function checkLiquidTag(raw) {
  const token = raw.trim().split(/\s+/)[0];
  if (starts.has(token)) liquidStack.push(token);
  else if (token.startsWith('end')) assert.equal(liquidStack.pop(), token.slice(3), `Liquid balance: ${token}`);
  else if (token === 'else' || token === 'elsif') assert.ok(['if', 'unless', 'case'].includes(liquidStack.at(-1)));
}
for (const match of withoutSchema.matchAll(/{%\s*([\s\S]*?)\s*%}/g)) {
  if (match[1].startsWith('liquid\n')) match[1].slice(7).split('\n').filter(line => line.trim()).forEach(checkLiquidTag);
  else checkLiquidTag(match[1]);
}
assert.deepEqual(liquidStack, []);

const html = withoutSchema.replace(/{%\s*style\s*%}[\s\S]*?{%\s*endstyle\s*%}/g, '').replace(/{%[\s\S]*?%}/g, '').replace(/{{[\s\S]*?}}/g, '');
const htmlStack = [];
const voidTags = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'track', 'wbr']);
for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
  const tag = match[2].toLowerCase();
  if (voidTags.has(tag)) continue;
  if (match[1]) assert.equal(htmlStack.pop(), tag, `HTML balance: ${tag}`);
  else htmlStack.push(tag);
}
assert.deepEqual(htmlStack, []);
assert.ok(source.includes('autoplay: false, controls: true'));
assert.ok(source.includes('object-fit:contain'));
assert.ok(!source.includes('<script'));

// Evaluate the section's own first Liquid block for its small condition/assign
// subset. This checks the real release/media branch, not a copied JS guard.
const setupLines = source.match(/{% liquid\n([\s\S]*?)%}/)[1].split('\n').map(line => line.trim()).filter(Boolean);
function evaluateSetup(overrides = {}) {
  const configured = Object.fromEntries([...settings].map(([key, item]) => [key, item.default ?? '']));
  Object.assign(configured, overrides);
  const variables = {};
  const active = [true];
  function value(token) {
    token = token.trim();
    if (token.startsWith("'")) return token.slice(1, -1);
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'blank') return '';
    if (token.startsWith('section.settings.')) return configured[token.slice(17)];
    return variables[token];
  }
  function condition(expression) {
    if (expression.includes(' or ')) return expression.split(' or ').some(condition);
    if (expression.includes(' and ')) return expression.split(' and ').every(condition);
    if (expression.includes(' != ')) { const [left, right] = expression.split(' != '); return value(left) !== value(right); }
    if (expression.includes(' == ')) { const [left, right] = expression.split(' == '); return value(left) === value(right); }
    return Boolean(value(expression));
  }
  for (const line of setupLines) {
    if (line.startsWith('if ')) { active.push(active.at(-1) && condition(line.slice(3))); continue; }
    if (line === 'endif') { active.pop(); continue; }
    if (!active.at(-1)) continue;
    const assignment = line.match(/^assign (\w+) = (.*)$/);
    assert.ok(assignment, `Unsupported setup statement: ${line}`);
    const [expression, filter] = assignment[2].split(' | ');
    let resolved = value(expression);
    if (filter?.startsWith('slice:')) { const [start, length] = filter.slice(6).split(',').map(Number); resolved = String(resolved).slice(start, start + length); }
    else if (filter?.startsWith('image_url:')) resolved = `image:${resolved}`;
    else assert.equal(filter, undefined, `Unsupported setup filter: ${filter}`);
    variables[assignment[1]] = resolved;
  }
  return variables;
}
const apple = 'https://apps.apple.com/au/app/example/id123';
const google = 'https://play.google.com/store/apps/details?id=example';
assert.equal(evaluateSetup().launched, false);
assert.equal(evaluateSetup({ launch_mode: true }).launched, false);
assert.equal(evaluateSetup({ launch_mode: true, ios_url: apple }).launched, false);
assert.equal(evaluateSetup({ ios_verified: true, ios_url: apple }).launched, false);
assert.equal(evaluateSetup({ launch_mode: true, ios_verified: true, ios_url: apple }).launched, true);
assert.equal(evaluateSetup({ launch_mode: true, android_verified: true, android_url: google }).launched, true);
assert.equal(evaluateSetup({ launch_mode: true, ios_verified: true, ios_url: 'https://apps.apple.com.evil.invalid/x' }).launched, false);
assert.equal(evaluateSetup({ launch_mode: true, ios_verified: true, ios_url: 'http://apps.apple.com/x' }).launched, false);
assert.equal(evaluateSetup({ launch_image: 'launch', preview_image: 'preview' }).hero_image, 'preview');
assert.equal(evaluateSetup({ launch_mode: true, ios_verified: true, ios_url: apple, launch_image: 'launch', preview_video: 'preview-movie' }).hero_video, '');
assert.equal(evaluateSetup({ launch_mode: true, ios_verified: true, ios_url: apple, launch_image: 'launch' }).hero_image, 'launch');
console.log('PASS: section schema, 10 partner blocks, Liquid/HTML structure, media accessibility, 11 release/media scenarios.');
console.log('Shopify renderer and theme/device visual checks remain for the unpublished theme preview.');
