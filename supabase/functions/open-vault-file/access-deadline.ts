// Leave one second for signing/network latency. Never round beyond entitlement.
export function fileLinkLifetime(access: { unlimited?: boolean; expires_at?: string | null; server_time?: string }, now = Date.now()) {
  if (access.unlimited === true) return 60;
  const expiry = Date.parse(access.expires_at ?? '');
  const serverNow = Date.parse(access.server_time ?? '');
  const remaining = Math.floor((expiry - Math.max(now, Number.isFinite(serverNow) ? serverNow : now)) / 1000) - 1;
  return Number.isFinite(remaining) ? Math.max(0, Math.min(60, remaining)) : 0;
}
