import assert from 'node:assert/strict';
import test from 'node:test';
import { sealXeroTokens, openXeroTokens, xeroStateHash } from '../supabase/functions/_shared/xero-token-crypto.ts';
const key = Buffer.alloc(32, 7).toString('base64');
test('tokens are encrypted with a fresh nonce and bound to the organisation', async () => {
  const tokens = { access_token: 'private-access', refresh_token: 'private-refresh' };
  const first = await sealXeroTokens(tokens, 'tenant-a', key);
  const second = await sealXeroTokens(tokens, 'tenant-a', key);
  assert.notEqual(first, second); assert.ok(!first.includes('private-access'));
  assert.deepEqual(await openXeroTokens(first, 'tenant-a', key), tokens);
  await assert.rejects(openXeroTokens(first, 'tenant-b', key));
  await assert.rejects(openXeroTokens(first, 'tenant-a', Buffer.alloc(32, 8).toString('base64')));
  const parts = first.split('.'); const bytes = Buffer.from(parts[2], 'base64'); bytes[0] ^= 1; parts[2] = bytes.toString('base64');
  await assert.rejects(openXeroTokens(parts.join('.'), 'tenant-a', key));
});
test('wrong key lengths and envelope versions fail closed', async () => {
  await assert.rejects(sealXeroTokens({}, 'tenant', 'eA=='), /configuration_required/);
  await assert.rejects(openXeroTokens('v2.a.b', 'tenant', key), /invalid_encrypted_tokens/);
});
test('OAuth state is stored only as SHA-256', async () => {
  assert.equal(await xeroStateHash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
