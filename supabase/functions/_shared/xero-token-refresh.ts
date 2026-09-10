export type XeroTokenSet = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

const safeToken = (value: unknown) => typeof value === 'string' && value.length >= 8 && value.length <= 16384 && !/[\r\n]/u.test(value);

export function parseXeroTokenSet(value: unknown): XeroTokenSet {
  if (!value || typeof value !== 'object') throw new Error('xero_invalid_token_response');
  const candidate = value as Record<string, unknown>;
  if (!safeToken(candidate.access_token) || !safeToken(candidate.refresh_token)) throw new Error('xero_invalid_token_response');
  if (candidate.expires_in !== undefined && (!Number.isFinite(candidate.expires_in) || Number(candidate.expires_in) <= 0)) throw new Error('xero_invalid_token_response');
  return {
    access_token: candidate.access_token as string,
    refresh_token: candidate.refresh_token as string,
    expires_in: candidate.expires_in === undefined ? undefined : Number(candidate.expires_in),
    token_type: typeof candidate.token_type === 'string' ? candidate.token_type : undefined,
    scope: typeof candidate.scope === 'string' ? candidate.scope : undefined,
  };
}

export async function requestXeroTokenRefresh(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  request: typeof fetch = fetch,
) {
  if (!safeToken(refreshToken) || !safeToken(clientId) || !safeToken(clientSecret)) throw new Error('xero_refresh_configuration_required');
  const response = await request('https://identity.xero.com/connect/token', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) throw new Error('xero_reauthorisation_required');
    if (response.status === 429) throw new Error('xero_rate_limited_retry_later');
    throw new Error('xero_refresh_temporarily_unavailable');
  }
  return parseXeroTokenSet(body);
}
