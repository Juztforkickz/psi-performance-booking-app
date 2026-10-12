import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { decode } from 'jpeg-js';
import { Image } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { vaultClient, type VaultAsset, type WorkshopJob } from '@/lib/performance-plus';
import { createOrFindWorkshopJob } from '@/lib/staff-vault';
import { readUploadBytes } from '@/lib/upload-file-bytes';
import { photoSignature, visuallyIdentical, identicalPhotoPixels } from '@/lib/photo-identity';

const sha = async (bytes: ArrayBuffer) => Array.from(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes))).map(v => v.toString(16).padStart(2, '0')).join('');
const decoded = (bytes: ArrayBuffer) => decode(new Uint8Array(bytes), { useTArray: true, maxResolutionInMP: 5, maxMemoryUsageInMB: 128 });
const signature = (bytes: ArrayBuffer) => photoSignature(decoded(bytes));

async function prepare(file: DocumentPickerAsset) {
  if (file.size && file.size > 40 * 1024 * 1024) throw new Error('Choose source files smaller than 40 MB.');
  const raw = await readUploadBytes(file.uri);
  if (!raw.byteLength || raw.byteLength > 40 * 1024 * 1024) throw new Error('Choose source files smaller than 40 MB.');
  const sourceSha = await sha(raw);
  const pdf = file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (pdf) {
    if (String.fromCharCode(...new Uint8Array(raw.slice(0, 5))) !== '%PDF-' || raw.byteLength > 20 * 1024 * 1024) throw new Error('Choose a valid PDF smaller than 20 MB.');
    return { bytes: raw, thumb: null, mime: 'application/pdf', digest: sourceSha, sourceSha, visual: null };
  }
  if (!file.mimeType?.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|tiff?)$/i.test(file.name)) throw new Error('Choose an image or PDF.');
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(file.uri, (width, height) => resolve({ width, height }), reject));
  const resize = dimensions.height > dimensions.width ? { height: Math.min(1600, dimensions.height) } : { width: Math.min(1600, dimensions.width) };
  const photo = await ImageManipulator.manipulateAsync(file.uri, [{ resize }], { compress: .8, format: ImageManipulator.SaveFormat.JPEG });
  const bytes = await readUploadBytes(photo.uri);
  const small = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: photo.height > photo.width ? { height: Math.min(360, photo.height) } : { width: Math.min(360, photo.width) } }], { compress: .72, format: ImageManipulator.SaveFormat.JPEG });
  if (!bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024) throw new Error('Prepared photo exceeds 20 MB.');
  return { bytes, thumb: await readUploadBytes(small.uri), mime: 'image/jpeg', digest: await sha(bytes), sourceSha, visual: signature(bytes) };
}

export async function findPhotoJob(customerId: string, vehicleId: string, date: string): Promise<WorkshopJob> {
  const client = vaultClient();
  const reference = `PSI-PHOTOS-${vehicleId.toUpperCase()}`;
  const collection = await client.from('workshop_jobs').select('*').eq('reference', reference).maybeSingle();
  if (collection.error) throw collection.error;
  if (collection.data) {
    if (collection.data.customer_id !== customerId || collection.data.vehicle_id !== vehicleId) throw new Error('Vehicle matching needs review.');
    return collection.data;
  }
  // Reuse an unambiguous current workspace. Otherwise keep a separate Photos
  // collection, rather than guessing which of several workshop visits applies.
  const since = new Date(`${date}T12:00:00Z`); since.setUTCDate(since.getUTCDate() - 30);
  const jobs = await client.from('workshop_jobs').select('*').eq('customer_id', customerId).eq('vehicle_id', vehicleId).gte('job_date', since.toISOString().slice(0, 10)).lte('job_date', date).limit(2);
  if (jobs.error) throw jobs.error;
  if (jobs.data?.length === 1) return jobs.data[0];
  try { return await createOrFindWorkshopJob({ customerId, vehicleId, reference, title: 'Photos', date }); }
  catch (error) {
    if ((error as { code?: string }).code !== '23505') throw error;
    return createOrFindWorkshopJob({ customerId, vehicleId, reference, title: 'Photos', date });
  }
}

async function signedBytes(path: string) {
  const signed = await getSupabaseClient().storage.from('performance-vault').createSignedUrl(path, 120);
  if (signed.error || !signed.data) throw signed.error ?? new Error('Photo unavailable.');
  return readUploadBytes(signed.data.signedUrl);
}

async function ensureObject(path: string, bytes: ArrayBuffer, mime: string) {
  const uploaded = await getSupabaseClient().storage.from('performance-vault').upload(path, bytes, { contentType: mime, cacheControl: '0', upsert: false });
  if (!uploaded.error) return;
  if (!['409', 'Duplicate'].includes(String((uploaded.error as { statusCode?: string }).statusCode)) && !/already exists|duplicate/i.test(uploaded.error.message)) throw uploaded.error;
  if (await sha(await signedBytes(path)) !== await sha(bytes)) throw new Error('The saved file differs. Keep both files for review.');
}

export type PhotoUploadResult = { uploaded: number; skipped: number; failed: DocumentPickerAsset[]; errors: string[] };
export async function publishVehiclePhotos(input: { customerId: string; vehicleId: string; date: string; files: DocumentPickerAsset[]; notes?: string }, progress: (message: string) => void): Promise<PhotoUploadResult> {
  if (!input.files.length || input.files.length > 50) throw new Error('Select between 1 and 50 photos or files.');
  const client = vaultClient();
  const { data: auth, error: authError } = await getSupabaseClient().auth.getUser();
  if (authError || !auth.user) throw new Error('Please sign in to the PSI portal again.');
  const vehicle = await getSupabaseClient().from('customer_vehicles').select('id').eq('id', input.vehicleId).eq('customer_id', input.customerId).is('archived_at', null).maybeSingle();
  if (vehicle.error || !vehicle.data) throw new Error('Choose the verified customer and vehicle again.');
  const existing: VaultAsset[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await client.from('vault_assets').select('*,vault_records!inner(kind,published_at)').eq('customer_id', input.customerId).eq('vehicle_id', input.vehicleId).eq('ready', true).eq('vault_records.kind', 'media').not('vault_records.published_at', 'is', null).order('id').range(offset, offset + 99);
    if (page.error) throw page.error;
    existing.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 100) break;
  }
  const result: PhotoUploadResult = { uploaded: 0, skipped: 0, failed: [], errors: [] };
  let job: WorkshopJob | undefined;
  for (const [index, file] of input.files.entries()) {
    let stage = 'Reading the selected file';
    try {
      progress(`Checking file ${index + 1} of ${input.files.length}…`);
      const prepared = await prepare(file);
      stage = 'Checking existing photos';
      let duplicate = existing.some(asset => asset.sha256 === prepared.digest || asset.source_sha256 === prepared.sourceSha);
      if (!duplicate && prepared.visual) for (const asset of existing) {
        if (asset.mime_type !== 'image/jpeg') continue;
        let previous: ArrayBuffer | undefined;
        try {
          if (!asset.visual_signature) {
            previous = await signedBytes(asset.object_path);
            asset.visual_signature = signature(previous);
          }
          if (visuallyIdentical(prepared.visual, asset.visual_signature)) {
            previous ??= await signedBytes(asset.object_path);
            if (identicalPhotoPixels(decoded(prepared.bytes), decoded(previous))) { duplicate = true; break; }
          }
        } catch { /* An unavailable comparison is uncertain: retain the new file. */ }
      }
      if (duplicate) { result.skipped++; continue; }
      stage = 'Preparing the photo folder';
      job ??= await findPhotoJob(input.customerId, input.vehicleId, input.date);
      const source = `portal-media:${input.customerId}:${input.vehicleId}:${prepared.sourceSha}`;
      const found = await client.from('vault_records').select('*').eq('source', 'staff').eq('source_reference', source).maybeSingle();
      if (found.error) throw found.error;
      let record = found.data;
      if (!record) {
        const created = await client.from('vault_records').insert({ job_id: job.id, customer_id: input.customerId, vehicle_id: input.vehicleId, kind: 'media', title: 'Photos', notes: input.notes?.trim() ?? '', occurred_on: input.date, source: 'staff', source_reference: source, created_by: auth.user.id }).select('*').single();
        if (created.error) throw created.error;
        record = created.data;
      }
      if (!record || record.customer_id !== input.customerId || record.vehicle_id !== input.vehicleId || record.kind !== 'media') throw new Error('The saved photo belongs to a different target.');
      if (record.published_at) { result.skipped++; continue; }
      const reserved = await client.from('vault_assets').select('*').eq('record_id', record.id);
      if (reserved.error) throw reserved.error;
      if ((reserved.data?.length ?? 0) > 1) throw new Error('The saved upload needs review.');
      let asset = reserved.data?.[0];
      if (!asset) {
        const id = Crypto.randomUUID(), base = `${input.customerId}/${input.vehicleId}/${record.id}/${id}`;
        const inserted = await client.from('vault_assets').insert({ id, record_id: record.id, customer_id: input.customerId, vehicle_id: input.vehicleId, object_path: `${base}/original.${prepared.mime === 'application/pdf' ? 'pdf' : 'jpg'}`, thumbnail_path: prepared.thumb ? `${base}/thumb.jpg` : null, mime_type: prepared.mime, size_bytes: prepared.bytes.byteLength, sha256: prepared.digest, source_sha256: prepared.sourceSha, visual_signature: prepared.visual, caption: file.name.slice(0, 300), phase: null, created_by: auth.user.id }).select('*').single();
        if (inserted.error) throw inserted.error;
        asset = inserted.data;
      }
      if (!asset || asset.customer_id !== input.customerId || asset.vehicle_id !== input.vehicleId || asset.sha256 !== prepared.digest) throw new Error('The selected file changed. Select the original again.');
      stage = 'Uploading the photo';
      progress(`Uploading file ${index + 1} of ${input.files.length}…`);
      if (!asset.ready) {
        await ensureObject(asset.object_path, prepared.bytes, prepared.mime);
        if (prepared.thumb && asset.thumbnail_path) await ensureObject(asset.thumbnail_path, prepared.thumb, 'image/jpeg');
        const ready = await client.from('vault_assets').update({ ready: true }).eq('id', asset.id);
        if (ready.error) throw ready.error;
      }
      stage = 'Saving the photo to the profile';
      const published = await client.from('vault_records').update({ published_at: new Date().toISOString() }).eq('id', record.id);
      if (published.error) throw published.error;
      existing.push({ ...asset, ready: true });
      result.uploaded++;
    } catch (error) {
      result.failed.push(file);
      const code = (error as { code?: string; statusCode?: string })?.code ?? (error as { statusCode?: string })?.statusCode;
      result.errors.push(`${stage} did not finish${code && /^[A-Za-z0-9_]{1,20}$/.test(String(code)) ? ` (${code})` : ''}.`);
    }
  }
  return result;
}
