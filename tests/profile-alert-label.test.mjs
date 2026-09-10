import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('../mobile/src/lib/profile-alert-label.ts', import.meta.url), 'utf8');
const { profileAlertLabel } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const alertsScreen = await readFile(new URL('../mobile/src/app/(tabs)/alerts.tsx', import.meta.url), 'utf8');

test('personal alert labels preserve the profile name and clean whitespace', () => {
  assert.equal(profileAlertLabel('Matt'), 'Matt');
  assert.equal(profileAlertLabel('  Mary\nJane  '), 'Mary Jane');
  assert.equal(profileAlertLabel('Zoë'), 'Zoë');
  assert.equal(profileAlertLabel('李'), '李');
});

test('missing profile names use an account label without deriving an email identity', () => {
  for (const value of [undefined, null, '', '  ', 42, {}, 'matt@example.invalid']) {
    assert.equal(profileAlertLabel(value), 'Account');
  }
});

test('settings notification badge uses the profile alert label', () => {
  assert.match(alertsScreen, /const customerAlertLabel = profileAlertLabel\(account\?\.profile\?\.first_name\)/u);
  assert.match(alertsScreen, /\{customerAlertLabel\} \{notifications\.customerUnreadCount\}/u);
  assert.doesNotMatch(alertsScreen, />ME \{notifications\.customerUnreadCount\}</u);
});
