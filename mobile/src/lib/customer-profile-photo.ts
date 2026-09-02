import * as Crypto from 'expo-crypto';

import type { CustomerProfileRow } from '@/lib/database.types';
import type { LocalVehiclePhoto } from '@/lib/local-vehicle-photo';
import { getSupabaseClient } from '@/lib/supabase';

const PRIVATE_PHOTO_BUCKET = 'vehicle-photos' as const;
const MAX_PROFILE_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export async function createCustomerProfilePhotoSignedUrl(profile: CustomerProfileRow) {
  const supabase = getSupabaseClient();
  const user = await getVerifiedCustomer();
  const objectPath = profile.profile_photo_object_path;
  if (!objectPath || profile.user_id !== user.id || !objectPath.startsWith(`${user.id}/profile/`)) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(PRIVATE_PHOTO_BUCKET)
    .createSignedUrl(objectPath, 10 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadCustomerProfilePhoto(photo: LocalVehiclePhoto) {
  const supabase = getSupabaseClient();
  const user = await getVerifiedCustomer();
  const mimeType = normalizeImageMimeType(photo.mimeType, photo.uri);
  if (photo.fileSize !== null && photo.fileSize > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error('PROFILE_PHOTO_TOO_LARGE');
  }

  const response = await fetch(photo.uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('PROFILE_PHOTO_EMPTY');
  if (bytes.byteLength > MAX_PROFILE_PHOTO_BYTES) throw new Error('PROFILE_PHOTO_TOO_LARGE');

  const { data: currentProfile, error: currentError } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();
  if (currentError) throw currentError;

  const objectPath = `${user.id}/profile/${Crypto.randomUUID()}.${extensionForMimeType(mimeType)}`;
  const { error: uploadError } = await supabase.storage.from(PRIVATE_PHOTO_BUCKET).upload(objectPath, bytes, {
    cacheControl: '3600',
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: profile, error: updateError } = await supabase
    .from('customer_profiles')
    .update({
      profile_photo_mime_type: mimeType,
      profile_photo_object_path: objectPath,
      profile_photo_updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select('*')
    .single();
  if (updateError) {
    await supabase.storage.from(PRIVATE_PHOTO_BUCKET).remove([objectPath]);
    throw updateError;
  }

  const previousPath = currentProfile.profile_photo_object_path;
  let cleanupWarning: string | null = null;
  if (previousPath && previousPath !== objectPath && previousPath.startsWith(`${user.id}/profile/`)) {
    const { error } = await supabase.storage.from(PRIVATE_PHOTO_BUCKET).remove([previousPath]);
    if (error) cleanupWarning = 'Your new profile photo is active. The previous private image is queued for cleanup.';
  }

  const signedUrl = await createCustomerProfilePhotoSignedUrl(profile);
  if (!signedUrl) throw new Error('PROFILE_PHOTO_SIGNED_URL_REQUIRED');
  return { cleanupWarning, profile, signedUrl };
}

export async function removeCustomerProfilePhoto(profile: CustomerProfileRow) {
  const supabase = getSupabaseClient();
  const user = await getVerifiedCustomer();
  const objectPath = profile.profile_photo_object_path;
  if (profile.user_id !== user.id) throw new Error('PROFILE_PHOTO_ACCESS_DENIED');

  const { data: updatedProfile, error: updateError } = await supabase
    .from('customer_profiles')
    .update({
      profile_photo_mime_type: null,
      profile_photo_object_path: null,
      profile_photo_updated_at: null,
    })
    .eq('user_id', user.id)
    .select('*')
    .single();
  if (updateError) throw updateError;

  if (!objectPath || !objectPath.startsWith(`${user.id}/profile/`)) {
    return { profile: updatedProfile, storageRemoved: true };
  }
  const { error: storageError } = await supabase.storage.from(PRIVATE_PHOTO_BUCKET).remove([objectPath]);
  return { profile: updatedProfile, storageRemoved: !storageError };
}

async function getVerifiedCustomer() {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error || !data.user) throw error ?? new Error('CUSTOMER_SESSION_REQUIRED');
  return data.user;
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
  throw new Error('PROFILE_PHOTO_TYPE_UNSUPPORTED');
}

function extensionForMimeType(mimeType: typeof ALLOWED_IMAGE_TYPES[number]) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}
