import * as Crypto from 'expo-crypto';
import type { DocumentPickerAsset } from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

import { uploadCarListingBytes } from '@/lib/car-listing-resumable-upload';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { loadStaffMfaSecurityAccess } from '@/lib/staff-portal';
import { getSupabaseClient, SUPABASE_CONNECTION } from '@/lib/supabase';
import { readUploadBytes } from '@/lib/upload-file-bytes';

export const CAR_MEDIA_BUCKET = 'car-listing-media';
export type CarListingMedia = {
  id: string; listing_id: string; object_path: string; filename: string; mime_type: string;
  kind: 'photo' | 'video' | 'file'; size_bytes: number; state: 'pending' | 'ready' | 'removed'; is_cover: boolean;
  created_at: string; updated_at: string;
};
const FIELDS = 'id,listing_id,object_path,filename,mime_type,kind,size_bytes,state,is_cover,created_at,updated_at';
const documentTypes: Record<string, string> = { pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

export function carMediaFileType(file: Pick<DocumentPickerAsset, 'name' | 'mimeType'>) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (/^(jpe?g|png|webp|heic|heif|tiff?)$/.test(extension) || ['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.mimeType ?? '')) return 'photo';
  if (['mp4','m4v','mov','webm'].includes(extension) || ['video/mp4','video/quicktime','video/webm'].includes(file.mimeType ?? '')) return 'video';
  if (documentTypes[extension]) return 'file';
  throw new Error('CAR_MEDIA_TYPE_INVALID');
}

async function prepare(file: DocumentPickerAsset) {
  const kind = carMediaFileType(file);
  const limit = (kind === 'photo' ? 40 : kind === 'video' ? 50 : 20) * 1024 * 1024;
  if (file.size && file.size > limit) throw new Error('CAR_MEDIA_SIZE_INVALID');
  let bytes: ArrayBuffer, mime: string;
  if (kind === 'photo') {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(file.uri, (width, height) => resolve({ width, height }), reject));
    const photo = await ImageManipulator.manipulateAsync(file.uri, [{ resize: dimensions.height > dimensions.width ? { height: Math.min(1600, dimensions.height) } : { width: Math.min(1600, dimensions.width) } }], { compress: .82, format: ImageManipulator.SaveFormat.JPEG });
    bytes = await readUploadBytes(photo.uri); mime = 'image/jpeg';
  } else {
    bytes = await readUploadBytes(file.uri);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    mime = kind === 'video' ? (ext === 'mov' || file.mimeType === 'video/quicktime' ? 'video/quicktime' : ext === 'webm' || file.mimeType === 'video/webm' ? 'video/webm' : 'video/mp4') : documentTypes[ext];
  }
  const outputLimit = (kind === 'photo' ? 10 : kind === 'video' ? 50 : 20) * 1024 * 1024;
  if (!bytes.byteLength || bytes.byteLength > outputLimit) throw new Error('CAR_MEDIA_SIZE_INVALID');
  const head = new Uint8Array(bytes.slice(0, 24));
  const ascii = String.fromCharCode(...head);
  const valid = mime === 'image/jpeg' ? head[0] === 255 && head[1] === 216
    : mime === 'application/pdf' ? ascii.startsWith('%PDF-')
      : mime === 'video/webm' ? head[0] === 26 && head[1] === 69 && head[2] === 223 && head[3] === 163
        : mime.startsWith('video/') ? ascii.slice(4, 8) === 'ftyp'
          : /openxmlformats/.test(mime) ? ascii.startsWith('PK')
            : ['application/msword','application/vnd.ms-excel'].includes(mime) ? head[0] === 208 && head[1] === 207 && head[2] === 17 && head[3] === 224
              : !new Uint8Array(bytes).includes(0);
  if (!valid) throw new Error('CAR_MEDIA_CONTENT_INVALID');
  const sha256 = Array.from(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes))).map(v => v.toString(16).padStart(2, '0')).join('');
  return { bytes, mime, sha256, filename: file.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200) || 'Listing attachment' };
}

function mediaClient() { return getSupabaseClient(); }
export async function loadCarListingMedia(listingId: string): Promise<CarListingMedia[]> {
  const { data, error } = await mediaClient().from('customer_car_listing_media').select(FIELDS)
    .eq('listing_id', listingId).neq('state', 'removed').order('is_cover', { ascending: false }).order('created_at').order('id');
  if (error) throw error;
  return (data ?? []) as CarListingMedia[];
}
export async function carListingMediaUrl(media: CarListingMedia, download = false): Promise<string> {
  const { data, error } = await mediaClient().storage.from(CAR_MEDIA_BUCKET).createSignedUrl(media.object_path, 120,
    download ? { download: media.filename } : undefined);
  if (error || !data?.signedUrl) throw new Error('CAR_MEDIA_UNAVAILABLE');
  return data.signedUrl;
}
async function manage(action: string, listingId: string, mediaId?: string, metadata: Record<string, unknown> = {}) {
  if (REVIEW_ENVIRONMENT.enabled) throw new Error('CAR_MEDIA_PREVIEW_ONLY');
  const { data, error } = await mediaClient().rpc('manage_car_listing_media', {
    p_action: action, p_listing_id: listingId, p_media_id: mediaId, p_metadata: metadata,
  });
  if (error) throw error;
  return data as unknown as CarListingMedia;
}
export const removeCarListingMedia = (listingId: string, mediaId: string) => manage('remove', listingId, mediaId);
export const setCarListingCover = (listingId: string, mediaId: string) => manage('cover', listingId, mediaId);

export async function uploadCarListingMedia(listingId: string, files: DocumentPickerAsset[], progress: (message: string) => void) {
  if (REVIEW_ENVIRONMENT.enabled) throw new Error('CAR_MEDIA_PREVIEW_ONLY');
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready' || !access.staff.user_id) throw new Error('STAFF_AAL2_REQUIRED');
  if (!files.length || files.length > 24) throw new Error('CAR_MEDIA_LIMIT_REACHED');
  const userId = access.staff.user_id;
  const token = async () => {
    const { data } = await mediaClient().auth.getSession();
    if (!data.session || data.session.user.id !== userId) throw new Error('CAR_MEDIA_SESSION_CHANGED');
    return data.session.access_token;
  };
  const result = { uploaded: 0, skipped: 0, failed: [] as DocumentPickerAsset[], errors: [] as string[] };
  for (const [index, file] of files.entries()) {
    try {
      progress(`Preparing ${index + 1} of ${files.length}`);
      const prepared = await prepare(file);
      const reserved = await manage('reserve', listingId, undefined, {
        mime_type: prepared.mime, size_bytes: prepared.bytes.byteLength, sha256: prepared.sha256, filename: prepared.filename,
      });
      if (reserved.state === 'ready') { result.skipped++; continue; }
      // Recover a completed upload whose acknowledgement/finalization was interrupted.
      try { await manage('finish', listingId, reserved.id); result.uploaded++; continue; }
      catch (error) { if (!String((error as { message?: string }).message).includes('CAR_MEDIA_UPLOAD_INCOMPLETE')) throw error; }
      await uploadCarListingBytes({ projectRef: SUPABASE_CONNECTION.projectRef, userId, mediaId: reserved.id,
        objectPath: reserved.object_path, mime: prepared.mime, bytes: prepared.bytes, token,
        progress: percent => progress(`Uploading ${index + 1} of ${files.length}, ${percent}%`),
      });
      await manage('finish', listingId, reserved.id); result.uploaded++;
    } catch (error) { result.failed.push(file); result.errors.push(carMediaError(error)); }
  }
  return result;
}
export function carMediaError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? '');
  if (/STAFF|SESSION/.test(message)) return 'Open owner security and verify your staff session, then retry.';
  if (/SIZE/.test(message)) return 'Photos can be up to 40 MB before resizing, videos 50 MB and documents 20 MB.';
  if (/TYPE|CONTENT_INVALID/.test(message)) return 'Choose a photo, MP4, MOV or WebM video, PDF, document or spreadsheet.';
  if (/LIMIT/.test(message)) return 'A listing can contain up to 24 attachments. Remove an unused attachment and retry.';
  if (/LISTING_UNAVAILABLE/.test(message)) return 'Open an available listing or save a private draft first.';
  return 'Upload did not finish. Your listing and completed uploads are saved. Retry the selected file.';
}
