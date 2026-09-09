import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = await readFile(new URL('../mobile/src/lib/notification-lifecycle.ts', import.meta.url), 'utf8');
const { createNotificationRequestScope, createNotificationResponseTracker } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);

test('a slower previous refresh cannot replace the newest notification state', () => {
  const scope = createNotificationRequestScope();
  scope.open();
  const olderRead = scope.begin();
  const latestRead = scope.begin();
  assert.equal(olderRead(), false);
  assert.equal(latestRead(), true);
});

test('sign-out invalidates requests even when a scope is opened again', () => {
  const scope = createNotificationRequestScope();
  scope.open();
  const previousAccountRead = scope.begin();
  scope.close();
  assert.equal(scope.isActive(), false);
  assert.equal(previousAccountRead(), false);
  scope.open();
  assert.equal(previousAccountRead(), false);
  assert.equal(scope.begin()(), true);
});

test('marking alerts read prevents an older response from restoring the unread badge', () => {
  const scope = createNotificationRequestScope();
  scope.open();
  const beforeMarkRead = scope.begin();
  scope.invalidate();
  assert.equal(beforeMarkRead(), false);
  assert.equal(scope.isActive(), true);
  assert.equal(scope.begin()(), true);
});

test('cold-start and live deliveries of the same notification tap navigate once', () => {
  const responses = createNotificationResponseTracker();
  assert.equal(responses.consume('enquiry-1', 'default'), true);
  assert.equal(responses.consume('enquiry-1', 'default'), false);
  assert.equal(responses.consume('enquiry-2', 'default'), true);
  assert.equal(responses.consume('enquiry-1', 'default'), false);
});

test('distinct notification actions remain usable and identifiers cannot collide', () => {
  const responses = createNotificationResponseTracker();
  assert.equal(responses.consume('enquiry-1', 'default'), true);
  assert.equal(responses.consume('enquiry-1', 'reply'), true);
  assert.equal(responses.consume('a:b', 'c'), true);
  assert.equal(responses.consume('a', 'b:c'), true);
});
