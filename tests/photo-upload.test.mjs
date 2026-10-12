import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { photoSignature, visuallyIdentical, identicalPhotoPixels } from '../mobile/src/lib/photo-identity.ts';

const require = createRequire(import.meta.url);
const ts = require('../mobile/node_modules/typescript');
const hash = bytes => createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const bytes = text => new TextEncoder().encode(text).buffer;

test('visual matching keeps changed details, colour, flat images and mismatched proportions', () => {
  const data = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = (i / 4) % 256; data[i + 1] = 80; data[i + 2] = 150; data[i + 3] = 255; }
  const first = photoSignature({ width: 64, height: 64, data });
  assert(visuallyIdentical(first, first));
  const changed = data.slice(); changed[20] += 10;
  assert(!visuallyIdentical(first, photoSignature({ width: 64, height: 64, data: changed })));
  const brighter = data.map((v, i) => i % 4 === 3 ? v : Math.min(255, v + 2));
  assert(!visuallyIdentical(first, photoSignature({ width: 64, height: 64, data: brighter })));
  assert(!visuallyIdentical(first, first.replace('64:64', '64:32')));
  const blank = photoSignature({ width: 64, height: 64, data: new Uint8Array(data.length) });
  assert(!visuallyIdentical(blank, blank));
  assert(!identicalPhotoPixels({ width: 64, height: 64, data }, { width: 64, height: 64, data: changed }));
  assert(identicalPhotoPixels({ width: 64, height: 64, data }, { width: 64, height: 64, data: data.slice() }));
});

function uploadHarness() {
  const records = [], assets = [], objects = new Map();
  let failPublication = true;
  const files = [{ uri: 'first', name: 'one.pdf', mimeType: 'application/pdf' }, { uri: 'second', name: 'two.pdf', mimeType: 'application/pdf' }];
  const originals = { first: bytes('%PDF-first'), second: bytes('%PDF-second') };
  const job = { id: 'job', customer_id: 'customer', vehicle_id: 'vehicle', reference: 'current', job_date: '2026-10-13' };
  const client = { from(table) {
    const filters = [];
    let action = 'read', payload, single = false;
    const chain = {
      select() { return chain; }, eq(k, v) { filters.push(row => k.startsWith('vault_records.') ? records.some(r => r.id === row.record_id && r[k.split('.')[1]] === v) : row[k] === v); return chain; },
      is(k, v) { filters.push(row => row[k] === v); return chain; },
      not(k) { if (k === 'vault_records.published_at') filters.push(row => records.some(r => r.id === row.record_id && r.published_at)); return chain; },
      order() { return chain; }, range() { return chain; }, gte() { return chain; }, lte() { return chain; }, limit() { return chain; },
      maybeSingle() { single = true; return chain; }, single() { single = true; return chain; },
      insert(value) { action = 'insert'; payload = value; return chain; }, update(value) { action = 'update'; payload = value; return chain; },
      then(resolve, reject) {
        try {
          let rows = table === 'vault_records' ? records : table === 'vault_assets' ? assets : table === 'customer_vehicles' ? [{ id: 'vehicle', customer_id: 'customer', archived_at: null }] : [job];
          if (action === 'insert') { const row = { id: `record-${records.length}`, published_at: null, ready: false, ...payload }; rows.push(row); rows = [row]; }
          else rows = rows.filter(row => filters.every(filter => filter(row)));
          if (action === 'update') {
            if (table === 'vault_records' && payload.published_at && rows[0]?.id === 'record-1' && failPublication) {
              failPublication = false; return Promise.resolve({ data: null, error: { code: 'NETWORK' } }).then(resolve, reject);
            }
            rows.forEach(row => Object.assign(row, payload));
          }
          return Promise.resolve({ data: single ? rows[0] ?? null : rows.map(row => ({ ...row })), error: null }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return chain;
  } };
  const api = { ...client, auth: { getUser: async () => ({ data: { user: { id: 'staff' } } }) }, storage: { from: () => ({
    upload: async (path, value) => { if (objects.has(path)) return { error: { statusCode: '409' } }; objects.set(path, value); return {}; },
    createSignedUrl: async path => ({ data: { signedUrl: path } }),
  }) } };
  const exports = {};
  const modules = {
    'expo-crypto': { digest: (_, value) => webcrypto.subtle.digest('SHA-256', value), CryptoDigestAlgorithm: { SHA256: 'SHA256' }, randomUUID: () => webcrypto.randomUUID() },
    'expo-image-manipulator': {}, 'jpeg-js': {}, 'react-native': {},
    '@/lib/supabase': { getSupabaseClient: () => api }, '@/lib/performance-plus': { vaultClient: () => client },
    '@/lib/staff-vault': { createOrFindWorkshopJob: () => { throw new Error('Should reuse the current job'); } },
    '@/lib/upload-file-bytes': { readUploadBytes: async uri => originals[uri] ?? objects.get(uri) },
    '@/lib/photo-identity': { photoSignature, visuallyIdentical, identicalPhotoPixels },
  };
  const source = ts.transpileModule(readFileSync(new URL('../mobile/src/lib/staff-photo-upload.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: id => { assert(id in modules, id); return modules[id]; }, Uint8Array, ArrayBuffer, Date });
  return { records, assets, objects, files, upload: selected => exports.publishVehiclePhotos({ customerId: 'customer', vehicleId: 'vehicle', date: '2026-10-13', files: selected }, () => {}) };
}

test('partial failure retains completed files, retries the existing draft and skips later repeats', async () => {
  const h = uploadHarness();
  const first = await h.upload(h.files);
  assert.equal(first.uploaded, 1); assert.equal(first.failed.length, 1);
  assert.equal(h.records.length, 2); assert.equal(h.objects.size, 2);
  const retry = await h.upload(first.failed);
  assert.equal(retry.uploaded, 1); assert.equal(retry.failed.length, 0);
  assert.equal(h.records.length, 2); assert.equal(h.objects.size, 2);
  const again = await h.upload(h.files);
  assert.equal(again.skipped, 2); assert.equal(again.uploaded, 0);
  assert(h.assets.every(asset => asset.source_sha256 === hash(h.objects.get(asset.object_path))));
});
