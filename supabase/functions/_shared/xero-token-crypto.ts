const encode = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
const decode = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
async function keyFrom(secret: string) {
  const bytes = decode(secret);
  if (bytes.byteLength !== 32) throw new Error('xero_encryption_configuration_required');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function sealXeroTokens(tokens: unknown, tenantId: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(tenantId) }, await keyFrom(secret), new TextEncoder().encode(JSON.stringify(tokens)));
  return `v1.${encode(iv)}.${encode(new Uint8Array(sealed))}`;
}
export async function openXeroTokens(sealed: string, tenantId: string, secret: string) {
  const parts = sealed.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('xero_invalid_encrypted_tokens');
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(parts[1]), additionalData: new TextEncoder().encode(tenantId) }, await keyFrom(secret), decode(parts[2]));
  return JSON.parse(new TextDecoder().decode(raw));
}
export async function xeroStateHash(state: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state))), b => b.toString(16).padStart(2, '0')).join('');
}
