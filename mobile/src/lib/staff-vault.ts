import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { Image } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';
import { vaultClient, type ServiceCompletionCandidate, type VaultKind, type WorkshopJob } from '@/lib/performance-plus';

export async function loadServiceCompletionCandidate(bookingId: string): Promise<ServiceCompletionCandidate | null> {
  const { data, error } = await vaultClient()
    .from('service_completion_candidates')
    .select('*')
    .eq('booking_request_id', bookingId)
    .eq('state', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadWorkshopJobForBooking(bookingId: string): Promise<WorkshopJob | null> {
  const { data, error } = await vaultClient()
    .from('workshop_jobs')
    .select('*')
    .eq('booking_request_id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createOrFindWorkshopJob(input: { customerId: string; vehicleId: string; reference: string; title: string; date: string }) {
  const client = vaultClient();
  const reference = input.reference.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 -]{2,79}$/.test(reference)) throw new Error('Use a clear PSI job reference of 3–80 letters, numbers, spaces or dashes.');
  const { data: existing, error } = await client.from('workshop_jobs').select('*').eq('reference', reference).maybeSingle();
  if (error) throw error;
  if (existing) {
    if (existing.customer_id !== input.customerId || existing.vehicle_id !== input.vehicleId) throw new Error('This job reference belongs to another vehicle. Check the job before continuing.');
    return existing;
  }
  const { data: auth } = await getSupabaseClient().auth.getUser();
  if (!auth.user) throw new Error('Staff sign-in required.');
  const { data, error: insertError } = await client.from('workshop_jobs').insert({ customer_id: input.customerId, vehicle_id: input.vehicleId, reference, title: input.title.trim(), job_date: input.date, created_by: auth.user.id }).select('*').single();
  if (insertError) throw insertError;
  return data;
}
export async function publishVaultRecord(job: WorkshopJob, input: { kind: VaultKind; title: string; notes: string; date: string; files: DocumentPickerAsset[]; phase: 'before' | 'progress' | 'after'; powerKw?: number; torqueNm?: number; runStage?: 'before' | 'after' | 'baseline' }, progress: (text: string) => void) {
  const { data: auth } = await getSupabaseClient().auth.getUser();
  if (!auth.user) throw new Error('Staff sign-in required.');
  if (!input.title.trim()) throw new Error('Add a title.');
  if (input.kind === 'dyno' && (!input.files.length || input.files.some(f => f.mimeType !== 'application/pdf'))) throw new Error('Dyno records require an original PDF report.');
  if (input.files.length > 50) throw new Error('Select up to 50 files per batch.');
  const client = vaultClient();
  const { data: record, error } = await client.from('vault_records').insert({ job_id: job.id, customer_id: job.customer_id, vehicle_id: job.vehicle_id, kind: input.kind, title: input.title.trim(), notes: input.notes.trim(), occurred_on: input.date, created_by: auth.user.id, power_kw: input.powerKw, torque_nm: input.torqueNm, run_stage: input.runStage }).select('*').single();
  if (error) throw error;
  try {
    for (let i = 0; i < input.files.length; i++) {
      progress(`Preparing file ${i + 1} of ${input.files.length}…`);
      const file = input.files[i];
      let bytes: ArrayBuffer; let thumb: ArrayBuffer | null = null;
      const pdf = file.mimeType === 'application/pdf';
      if (file.size && file.size > 40 * 1024 * 1024) throw new Error('Choose source files smaller than 40 MB.');
      if (pdf) {
        bytes = await (await fetch(file.uri)).arrayBuffer();
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('The selected PDF is invalid.');
      } else {
        if (!file.mimeType?.startsWith('image/')) throw new Error('Only images and PDF files are accepted.');
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(file.uri, (width, height) => resolve({ width, height }), reject));
        const resize = dimensions.height > dimensions.width ? { height: Math.min(1600, dimensions.height) } : { width: Math.min(1600, dimensions.width) };
        const photo = await ImageManipulator.manipulateAsync(file.uri, [{ resize }], { compress: .8, format: ImageManipulator.SaveFormat.JPEG });
        const thumbSize = photo.height > photo.width ? { height: Math.min(360, photo.height) } : { width: Math.min(360, photo.width) };
        const small = await ImageManipulator.manipulateAsync(photo.uri, [{ resize: thumbSize }], { compress: .72, format: ImageManipulator.SaveFormat.JPEG });
        bytes = await (await fetch(photo.uri)).arrayBuffer();
        thumb = await (await fetch(small.uri)).arrayBuffer();
      }
      if (!bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024) throw new Error('Prepared file exceeds the 20 MB limit.');
      const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
      const sha256 = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
      const id = Crypto.randomUUID();
      const base = `${job.customer_id}/${job.vehicle_id}/${record.id}/${id}`;
      const objectPath = `${base}/original.${pdf ? 'pdf' : 'jpg'}`;
      const thumbPath = thumb ? `${base}/thumb.jpg` : null;
      const { error: metadataError } = await client.from('vault_assets').insert({ id, record_id: record.id, customer_id: job.customer_id, vehicle_id: job.vehicle_id, object_path: objectPath, thumbnail_path: thumbPath, mime_type: pdf ? 'application/pdf' : 'image/jpeg', size_bytes: bytes.byteLength, sha256, caption: file.name.slice(0, 300), phase: input.kind === 'media' ? input.phase : null, created_by: auth.user.id });
      if (metadataError?.code === '23505') continue;
      if (metadataError) throw metadataError;
      progress(`Uploading file ${i + 1} of ${input.files.length}…`);
      const storage = getSupabaseClient().storage.from('performance-vault');
      const upload = await storage.upload(objectPath, bytes, { contentType: pdf ? 'application/pdf' : 'image/jpeg', cacheControl: '0', upsert: false });
      if (upload.error) throw upload.error;
      if (thumb && thumbPath) { const result = await storage.upload(thumbPath, thumb, { contentType: 'image/jpeg', cacheControl: '0', upsert: false }); if (result.error) throw result.error; }
      const ready = await client.from('vault_assets').update({ ready: true }).eq('id', id);
      if (ready.error) throw ready.error;
    }
    const published = await client.from('vault_records').update({ published_at: new Date().toISOString() }).eq('id', record.id);
    if (published.error) throw published.error;
    return record;
  } catch {
    // Draft stays hidden from customers; staff can inspect before retrying.
    throw new Error(`Upload stopped. Draft ${record.id} is private and unpublished. Review it before retrying to avoid duplicates.`);
  }
}
