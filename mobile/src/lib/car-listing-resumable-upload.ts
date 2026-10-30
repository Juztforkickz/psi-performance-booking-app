import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as expoFetch } from 'expo/fetch';

const CHUNK_SIZE = 6 * 1024 * 1024;
const encode = (value: string) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < value.length; i += 3) {
    const a = value.charCodeAt(i), b = value.charCodeAt(i + 1), c = value.charCodeAt(i + 2);
    result += alphabet[a >> 2] + alphabet[((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4)]
      + (Number.isNaN(b) ? '=' : alphabet[((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6)])
      + (Number.isNaN(c) ? '=' : alphabet[c & 63]);
  }
  return result;
};

/** Immutable Supabase TUS upload. A retry asks the server for its offset first. */
export async function uploadCarListingBytes(input: {
  projectRef: string; userId: string; mediaId: string; objectPath: string; mime: string; bytes: ArrayBuffer;
  token: () => Promise<string>; progress: (percent: number) => void;
}, dependencies = { fetch: expoFetch, storage: AsyncStorage, wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!/^[a-z0-9]{20}$/.test(input.projectRef)) throw new Error('CAR_MEDIA_STORAGE_UNAVAILABLE');
  const endpoint = `https://${input.projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  const key = `psi:car-upload:v1:${input.userId}:${input.mediaId}`;
  const validUrl = (value: string) => {
    const url = new URL(value, endpoint + '/');
    if (url.origin !== new URL(endpoint).origin || !url.pathname.startsWith('/storage/v1/upload/resumable/')) throw new Error('CAR_MEDIA_UPLOAD_URL_INVALID');
    return url.href;
  };
  let location: string | null = null;
  try { const saved = await dependencies.storage.getItem(key); if (saved) location = validUrl(saved); } catch { /* Local resume storage is optional. */ }
  const request = async (url: string, method: string, headers: Record<string, string> = {}, body?: ArrayBuffer) => {
    // The installed React Native AbortSignal does not implement timeout().
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      return await dependencies.fetch(url, { method, headers: { authorization: `Bearer ${await input.token()}`, 'Tus-Resumable': '1.0.0', ...headers }, body, signal: controller.signal });
    } finally { clearTimeout(timer); }
  };
  const readOffset = async () => {
    if (!location) return 0;
    const response = await request(location, 'HEAD');
    if ([404, 410].includes(response.status)) { location = null; return 0; }
    if (!response.ok) throw new Error('CAR_MEDIA_UPLOAD_INTERRUPTED');
    const length = Number(response.headers.get('upload-length')), offset = Number(response.headers.get('upload-offset'));
    if (length !== input.bytes.byteLength || !Number.isSafeInteger(offset) || offset < 0 || offset > length) throw new Error('CAR_MEDIA_UPLOAD_OFFSET_INVALID');
    return offset;
  };
  let offset = await readOffset();
  if (!location) {
    const metadata = { bucketName: 'car-listing-media', objectName: input.objectPath, contentType: input.mime, cacheControl: '120' };
    const response = await request(endpoint, 'POST', { 'Upload-Length': String(input.bytes.byteLength),
      'Upload-Metadata': Object.entries(metadata).map(([k, v]) => `${k} ${encode(v)}`).join(',') });
    if (response.status !== 201 || !response.headers.get('location')) throw new Error('CAR_MEDIA_UPLOAD_INTERRUPTED');
    location = validUrl(response.headers.get('location')!);
    try { await dependencies.storage.setItem(key, location); } catch { /* The server reservation also makes a fresh retry safe. */ }
  }
  let failures = 0;
  while (offset < input.bytes.byteLength) {
    try {
      const response = await request(location!, 'PATCH', {
        'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream',
      }, input.bytes.slice(offset, offset + CHUNK_SIZE));
      if (!response.ok) throw new Error('CAR_MEDIA_UPLOAD_INTERRUPTED');
      const next = Number(response.headers.get('upload-offset'));
      if (!Number.isSafeInteger(next) || next <= offset || next > Math.min(offset + CHUNK_SIZE, input.bytes.byteLength)) throw new Error('CAR_MEDIA_UPLOAD_OFFSET_INVALID');
      offset = next; failures = 0;
      input.progress(Math.floor(offset * 100 / input.bytes.byteLength));
    } catch (error) {
      if (++failures > 3 || (error instanceof Error && /SESSION|OFFSET_INVALID/.test(error.message))) throw error;
      await dependencies.wait(failures * 500);
      offset = await readOffset();
      if (!location) throw new Error('CAR_MEDIA_UPLOAD_INTERRUPTED');
    }
  }
  try { await dependencies.storage.removeItem(key); } catch { /* A stale completed URL can safely be read back. */ }
}
