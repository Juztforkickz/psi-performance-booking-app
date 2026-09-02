import * as Crypto from 'expo-crypto';

import type { CustomerVehicleRow, VehicleFileRow } from '@/lib/database.types';
import type { LocalVehiclePhoto } from '@/lib/local-vehicle-photo';
import { getSupabaseClient } from '@/lib/supabase';
import type { SecureVehicleAttachment } from '@/lib/vehicle-reports-preview';

const PRIVATE_PHOTO_BUCKET = 'vehicle-photos' as const;
const MAX_CUSTOMER_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type CustomerVehiclePhotoUploadResult = {
  cleanupWarning: string | null;
  file: VehicleFileRow;
  signedUrl: string;
};

export async function uploadCustomerVehiclePhoto(
  vehicleId: string,
  photo: LocalVehiclePhoto,
): Promise<CustomerVehiclePhotoUploadResult> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) throw userError ?? new Error('CUSTOMER_SESSION_REQUIRED');

  const { data: vehicle, error: vehicleError } = await supabase
    .from('customer_vehicles')
    .select('*')
    .eq('id', vehicleId)
    .eq('customer_id', user.id)
    .is('archived_at', null)
    .maybeSingle();
  if (vehicleError) throw vehicleError;
  if (!vehicle) throw new Error('CUSTOMER_VEHICLE_REQUIRED');

  const mimeType = normalizeImageMimeType(photo.mimeType, photo.uri);
  if (photo.fileSize !== null && photo.fileSize > MAX_CUSTOMER_PHOTO_BYTES) {
    throw new Error('VEHICLE_PHOTO_TOO_LARGE');
  }

  const response = await fetch(photo.uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('VEHICLE_PHOTO_EMPTY');
  if (bytes.byteLength > MAX_CUSTOMER_PHOTO_BYTES) throw new Error('VEHICLE_PHOTO_TOO_LARGE');

  const fileId = Crypto.randomUUID();
  const objectPath = `${user.id}/vehicles/${vehicle.id}/photos/${fileId}.${extensionForMimeType(mimeType)}`;
  const uploadResult = await supabase.storage.from(PRIVATE_PHOTO_BUCKET).upload(objectPath, bytes, {
    cacheControl: '3600',
    contentType: mimeType,
    upsert: false,
  });
  if (uploadResult.error) throw uploadResult.error;

  const metadataResult = await supabase.from('vehicle_files').insert({
    bucket_id: PRIVATE_PHOTO_BUCKET,
    created_by: user.id,
    customer_id: user.id,
    file_kind: 'vehicle_photo',
    file_size_bytes: bytes.byteLength,
    mime_type: mimeType,
    object_path: objectPath,
    record_source: 'customer_entry',
    vehicle_id: vehicle.id,
  }).select('*').single();

  if (metadataResult.error) {
    await supabase.storage.from(PRIVATE_PHOTO_BUCKET).remove([objectPath]);
    throw metadataResult.error;
  }

  const cleanupWarning = await archivePreviousCustomerPhotos(user.id, vehicle, metadataResult.data);
  const signedUrl = await createCustomerVehiclePhotoSignedUrl(metadataResult.data);
  return { cleanupWarning, file: metadataResult.data, signedUrl };
}

export async function createCustomerVehiclePhotoSignedUrl(file: VehicleFileRow) {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) throw userError ?? new Error('CUSTOMER_SESSION_REQUIRED');
  assertOwnedCustomerPhoto(file, user.id);

  const { data, error } = await supabase.storage
    .from(PRIVATE_PHOTO_BUCKET)
    .createSignedUrl(file.object_path, 10 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function createPrivateVehicleAttachmentSignedUrl(attachment: SecureVehicleAttachment) {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) throw userError ?? new Error('CUSTOMER_SESSION_REQUIRED');
  if (!attachment.objectPath.startsWith(`${user.id}/`)) throw new Error('CUSTOMER_FILE_ACCESS_DENIED');

  const { data, error } = await supabase.storage
    .from(attachment.bucketId)
    .createSignedUrl(attachment.objectPath, 10 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeCustomerVehiclePhoto(file: VehicleFileRow) {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) throw userError ?? new Error('CUSTOMER_SESSION_REQUIRED');
  assertOwnedCustomerPhoto(file, user.id);

  const { error: metadataError } = await supabase
    .from('vehicle_files')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', file.id)
    .eq('customer_id', user.id)
    .eq('created_by', user.id)
    .is('archived_at', null);
  if (metadataError) throw metadataError;

  const { error: storageError } = await supabase.storage.from(PRIVATE_PHOTO_BUCKET).remove([file.object_path]);
  return { storageRemoved: !storageError };
}

export function newestCustomerVehiclePhoto(files: readonly VehicleFileRow[], vehicleId: string) {
  return files.find((file) => (
    file.vehicle_id === vehicleId
    && file.bucket_id === PRIVATE_PHOTO_BUCKET
    && file.file_kind === 'vehicle_photo'
    && file.record_source === 'customer_entry'
    && file.archived_at === null
  )) ?? null;
}

async function archivePreviousCustomerPhotos(
  customerId: string,
  vehicle: CustomerVehicleRow,
  currentFile: VehicleFileRow,
) {
  const supabase = getSupabaseClient();
  const { data: previousFiles, error: previousError } = await supabase
    .from('vehicle_files')
    .select('*')
    .eq('customer_id', customerId)
    .eq('created_by', customerId)
    .eq('vehicle_id', vehicle.id)
    .eq('file_kind', 'vehicle_photo')
    .eq('record_source', 'customer_entry')
    .is('archived_at', null)
    .neq('id', currentFile.id);
  if (previousError || !previousFiles?.length) {
    return previousError ? 'Your new photo is private and active, but an older photo may still need cleanup.' : null;
  }

  const previousIds = previousFiles.map((file) => file.id);
  const archiveResult = await supabase
    .from('vehicle_files')
    .update({ archived_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('created_by', customerId)
    .in('id', previousIds);
  if (archiveResult.error) return 'Your new photo is private and active, but an older photo may still need cleanup.';

  const removalResult = await supabase.storage
    .from(PRIVATE_PHOTO_BUCKET)
    .remove(previousFiles.map((file) => file.object_path));
  return removalResult.error ? 'Your new photo is private and active. An older private file is queued for cleanup.' : null;
}

function assertOwnedCustomerPhoto(file: VehicleFileRow, userId: string) {
  if (
    file.customer_id !== userId
    || file.created_by !== userId
    || file.bucket_id !== PRIVATE_PHOTO_BUCKET
    || file.file_kind !== 'vehicle_photo'
    || file.record_source !== 'customer_entry'
    || !file.object_path.startsWith(`${userId}/`)
  ) {
    throw new Error('CUSTOMER_PHOTO_ACCESS_DENIED');
  }
}

function normalizeImageMimeType(value: string | null, uri: string) {
  const normalized = value?.trim().toLowerCase() ?? '';
  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as typeof ALLOWED_IMAGE_TYPES[number];
  }
  const path = uri.split(/[?#]/u)[0].toLowerCase();
  if (path.endsWith('.png') || uri.startsWith('data:image/png')) return 'image/png';
  if (path.endsWith('.webp') || uri.startsWith('data:image/webp')) return 'image/webp';
  if (/\.jpe?g$/u.test(path) || uri.startsWith('data:image/jpeg')) return 'image/jpeg';
  throw new Error('VEHICLE_PHOTO_TYPE_UNSUPPORTED');
}

function extensionForMimeType(mimeType: typeof ALLOWED_IMAGE_TYPES[number]) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}
