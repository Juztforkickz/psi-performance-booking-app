import assert from 'node:assert/strict';
import test from 'node:test';
import { parseXeroTokenSet, requestXeroTokenRefresh } from '../supabase/functions/_shared/xero-token-refresh.ts';

test('Xero refresh uses the fixed token endpoint and accepts the rotated refresh token', async () => {
  const rotated = await requestXeroTokenRefresh('refresh-original', 'client-identifier', 'client-secret-value', async (url, options) => {
    assert.equal(url, 'https://identity.xero.com/connect/token');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.match(options.headers.Authorization, /^Basic /u);
    assert.equal(String(options.body), 'grant_type=refresh_token&refresh_token=refresh-original');
    return Response.json({ access_token: 'access-rotated', refresh_token: 'refresh-rotated', expires_in: 1800, token_type: 'Bearer' });
  });
  assert.equal(rotated.refresh_token, 'refresh-rotated');
  assert.equal(rotated.access_token, 'access-rotated');
});

test('Xero refresh fails closed for provider errors and malformed token bodies', async () => {
  await assert.rejects(
    requestXeroTokenRefresh('refresh-original', 'client-identifier', 'client-secret-value', async () => Response.json({ error: 'invalid_grant' }, { status: 400 })),
    /reauthorisation_required/u,
  );
  for (const value of [null, {}, { access_token: 'short', refresh_token: 'refresh-valid' }, { access_token: 'access-valid', refresh_token: '' }]) {
    assert.throws(() => parseXeroTokenSet(value), /invalid_token_response/u);
  }
});
