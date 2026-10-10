export type GarageStartupCache = {
  userId: string; vehicleId: string; illustrationId: string;
  sourceUri: string | null; previewUri: string | null; savedAt: number;
};
export const garageStartupKey = (userId: string) => `psi-garage-startup-v1:${userId}`;
export function parseGarageStartupCache(value: string | null, userId: string, allowPrivate: boolean, now = Date.now()): GarageStartupCache | null {
  try {
    const cache = JSON.parse(value ?? 'null') as GarageStartupCache | null;
    if (!cache || cache.userId !== userId || typeof cache.vehicleId !== 'string' || typeof cache.illustrationId !== 'string'
      || !Number.isFinite(cache.savedAt) || cache.savedAt > now || now - cache.savedAt > 7 * 86400_000) return null;
    const validImage = (uri: unknown) => typeof uri === 'string' && uri.startsWith('data:image/jpeg;base64,') && uri.length < 4_000_000;
    return { ...cache, sourceUri: allowPrivate && validImage(cache.sourceUri) ? cache.sourceUri : null, previewUri: allowPrivate && validImage(cache.previewUri) ? cache.previewUri : null };
  } catch { return null; }
}
export function jpegDataUri(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = [];
  let part = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const bits = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    part += alphabet[(bits >>> 18) & 63] + alphabet[(bits >>> 12) & 63]
      + (i + 1 < bytes.length ? alphabet[(bits >>> 6) & 63] : '=')
      + (i + 2 < bytes.length ? alphabet[bits & 63] : '=');
    if (part.length >= 8192) { chunks.push(part); part = ''; }
  }
  chunks.push(part);
  return `data:image/jpeg;base64,${chunks.join('')}`;
}
