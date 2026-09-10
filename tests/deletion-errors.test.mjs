import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const source = await readFile(new URL('../mobile/src/lib/deletion-errors.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { parseAccountDeletionError, accountDeletionErrorMessage } = exports;

test('Edge failure body survives FunctionsHttpError without consuming its response', async () => {
  const response = Response.json({ error: 'deletion_lock_failed', details: 'private provider details' }, { status: 503 });
  const error = await parseAccountDeletionError({ message: 'Edge Function returned a non-2xx status code', context: response });
  assert.equal(error.code, 'deletion_lock_failed');
  assert.equal(error.message, 'deletion_lock_failed');
  assert.equal(response.bodyUsed, false);
  assert.match(accountDeletionErrorMessage(error), /No cleanup started on this attempt/);
  assert.doesNotMatch(accountDeletionErrorMessage(error), /remains locked|private provider/);
});

test('Response-compatible native contexts preserve safe error codes without clone', async () => {
  const error = await parseAccountDeletionError({ context: { json: async () => ({ error: 'confirmation_email_mismatch' }) } });
  assert.match(accountDeletionErrorMessage(error), /customer email exactly/);
});

test('session and owner verification failures direct the operator back to authentication', async () => {
  for (const code of ['authentication_required', 'invalid_session', 'owner_aal2_required']) {
    const error = await parseAccountDeletionError({ context: Response.json({ error: code }, { status: 403 }) });
    assert.match(accountDeletionErrorMessage(error), /authenticator/);
    assert.doesNotMatch(accountDeletionErrorMessage(error), /remains locked/);
  }
  const gatewayError = await parseAccountDeletionError({ context: new Response('Unauthenticated', { status: 401 }) });
  assert.equal(gatewayError.code, 'invalid_session');
});

test('cleanup phase failures explain locked access and retrying the same request', async () => {
  for (const code of ['private_storage_cleanup_failed', 'customer_data_cleanup_failed', 'auth_identity_cleanup_failed']) {
    const error = await parseAccountDeletionError({ context: Response.json({ error: code }, { status: 503 }) });
    assert.equal(error.code, code);
    assert.match(accountDeletionErrorMessage(error), /Customer access remains locked/);
    assert.match(accountDeletionErrorMessage(error), /retry this same deletion request/);
    assert.doesNotMatch(accountDeletionErrorMessage(error), /No cleanup started/);
  }
});

test('missing and inactive requests require a status refresh instead of a blind deletion retry', async () => {
  for (const code of ['customer_identity_not_found', 'active_deletion_request_required']) {
    const error = await parseAccountDeletionError({ context: Response.json({ error: code }, { status: 404 }) });
    assert.match(accountDeletionErrorMessage(error), /Refresh.*status/);
    assert.doesNotMatch(accountDeletionErrorMessage(error), /remains locked/);
  }
});

test('local validation errors retain actionable instructions', () => {
  assert.match(accountDeletionErrorMessage(new Error('RETENTION_REVIEW_REQUIRED')), /retention review/);
  assert.match(accountDeletionErrorMessage(new Error('CONFIRMATION_EMAIL_INVALID')), /customer email exactly/);
  assert.match(accountDeletionErrorMessage(new Error('STAFF_OWNER_AAL2_REQUIRED')), /PSI owner account/);
  assert.match(accountDeletionErrorMessage(new Error('STAFF_SESSION_REQUIRED')), /Sign in again/);
});

test('unknown, malformed and unavailable responses never claim cleanup status or expose raw details', async () => {
  const privateText = 'customer@example.invalid: internal database details';
  for (const context of [
    undefined,
    Response.json({ error: privateText }, { status: 503 }),
    Response.json({ error: { message: privateText } }, { status: 503 }),
    Response.json({ error: '__proto__' }, { status: 503 }),
    new Response(privateText, { status: 503 }),
    { json: async () => { throw new Error(privateText); } },
  ]) {
    const error = await parseAccountDeletionError({ message: privateText, context });
    assert.equal(error.code, 'ACCOUNT_DELETION_UNCONFIRMED');
    const message = accountDeletionErrorMessage(error);
    assert.match(message, /could not be confirmed/);
    assert.doesNotMatch(message, /customer@example|internal database|remains locked|No cleanup started/);
    assert.equal(error.message, 'ACCOUNT_DELETION_UNCONFIRMED');
  }
  assert.doesNotMatch(accountDeletionErrorMessage(new Error(privateText)), /customer@example|internal database/);
});
