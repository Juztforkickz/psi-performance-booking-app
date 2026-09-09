import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('../mobile/src/lib/staff-navigation.ts', import.meta.url), 'utf8');
const { resolveStaffSection, staffTabForSection } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);

test('staff deep links accept known sections and resolve repeated parameters consistently', () => {
  assert.equal(resolveStaffSection('bookings'), 'bookings');
  assert.equal(resolveStaffSection('settings'), 'settings');
  assert.equal(resolveStaffSection(['invitations', 'records']), 'invitations');
  assert.equal(resolveStaffSection(['', 'settings']), 'dashboard');
});

test('unknown, empty and inherited-property section names return to the dashboard', () => {
  for (const value of [undefined, [], '', 'unknown', '/account', 'https://example.com', 'constructor', '__proto__', 'toString']) {
    assert.equal(resolveStaffSection(value), 'dashboard');
  }
});

test('secondary staff pages keep their parent navigation tab selected', () => {
  for (const section of ['invitations', 'deletion', 'access']) assert.equal(staffTabForSection(section), 'customers');
  assert.equal(staffTabForSection('imports'), 'records');
  for (const section of ['events', 'connections', 'history', 'settings']) assert.equal(staffTabForSection(section), 'menu');
  for (const tab of ['dashboard', 'bookings', 'customers', 'records', 'menu']) assert.equal(staffTabForSection(tab), tab);
});
