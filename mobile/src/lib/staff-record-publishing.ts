import * as Crypto from 'expo-crypto';

import type {
  Database,
  DynoRecordRow,
  InvoiceRow,
  RecommendedWorkRow,
  RepairRecordRow,
  ServiceCompletionRow,
} from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

const PRIVATE_DOCUMENT_BUCKET = 'vehicle-documents' as const;
const MAX_STANDARD_UPLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type VehicleTarget = {
  customerId: string;
  vehicleId: string;
};

export type StaffPublishImage = {
  fileSize: number | null;
  height: number;
  mimeType: string | null;
  uri: string;
  width: number;
};

export type PublishResult<T> = {
  attachmentStored: boolean;
  attachmentWarning: string | null;
  record: T;
};

export type RepairPublishInput = VehicleTarget & {
  date: string;
  notes: string;
  odometerKm: string;
  recordKind: 'inspection' | 'repair' | 'service';
  title: string;
};

export type RecommendationPublishInput = VehicleTarget & {
  notes: string;
  status: 'due_soon' | 'monitor' | 'priority' | 'recommended';
  timing: string;
  title: string;
};

export type DynoPublishInput = VehicleTarget & {
  date: string;
  fuel: string;
  image: StaffPublishImage | null;
  notes: string;
  powerKw: string;
  torqueNm: string;
};

export type InvoicePublishInput = VehicleTarget & {
  amountAud: string;
  date: string;
  image: StaffPublishImage | null;
  invoiceNumber: string;
  summary: string;
};

export type ServiceCompletionPublishInput = VehicleTarget & {
  bookingId: string;
  completedDate: string;
  nextCheckInDate: string;
  nextCheckInOdometerKm: string;
  odometerKm: string;
  summary: string;
};

export async function completePsiService(input: ServiceCompletionPublishInput): Promise<ServiceCompletionRow> {
  const actorId = await requireAal2StaffActor();
  const completedDate = requiredDate(input.completedDate, 'SERVICE_DATE_INVALID');
  const nextCheckInDate = input.nextCheckInDate.trim()
    ? requiredDate(input.nextCheckInDate, 'NEXT_CHECK_IN_DATE_INVALID')
    : null;
  const odometerKm = optionalWholeNumber(input.odometerKm, 'ODOMETER_INVALID');
  const nextCheckInOdometerKm = optionalWholeNumber(input.nextCheckInOdometerKm, 'NEXT_CHECK_IN_ODOMETER_INVALID');
  if (nextCheckInDate && nextCheckInDate < completedDate) throw new Error('NEXT_CHECK_IN_DATE_BEFORE_SERVICE');
  if (odometerKm !== null && nextCheckInOdometerKm !== null && nextCheckInOdometerKm < odometerKm) {
    throw new Error('NEXT_CHECK_IN_ODOMETER_BELOW_SERVICE');
  }

  const payload: Database['public']['Tables']['service_completions']['Insert'] = {
    booking_request_id: input.bookingId,
    completed_at: `${completedDate}T00:00:00+10:00`,
    created_by: actorId,
    customer_id: input.customerId,
    next_check_in_date: nextCheckInDate,
    next_check_in_odometer_km: nextCheckInOdometerKm,
    odometer_km: odometerKm,
    summary: requiredText(input.summary, 'SERVICE_SUMMARY_REQUIRED'),
    vehicle_id: input.vehicleId,
  };
  const { data, error } = await getSupabaseClient().from('service_completions').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function publishPsiRepair(input: RepairPublishInput): Promise<RepairRecordRow> {
  const actorId = await requireAal2StaffActor();
  const title = requiredText(input.title, 'REPAIR_TITLE_REQUIRED');
  const repairDate = requiredDate(input.date, 'REPAIR_DATE_INVALID');
  const odometerKm = optionalWholeNumber(input.odometerKm, 'ODOMETER_INVALID');
  const payload: Database['public']['Tables']['repair_records']['Insert'] = {
    created_by: actorId,
    customer_id: input.customerId,
    notes: optionalText(input.notes),
    odometer_km: odometerKm,
    record_kind: input.recordKind,
    record_source: 'psi_record',
    repair_date: repairDate,
    title,
    vehicle_id: input.vehicleId,
  };
  const { data, error } = await getSupabaseClient().from('repair_records').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function publishPsiRecommendation(input: RecommendationPublishInput): Promise<RecommendedWorkRow> {
  const actorId = await requireAal2StaffActor();
  const payload: Database['public']['Tables']['recommended_work']['Insert'] = {
    created_by: actorId,
    customer_id: input.customerId,
    notes: optionalText(input.notes),
    record_source: 'psi_record',
    status: input.status,
    timing: optionalText(input.timing),
    title: requiredText(input.title, 'RECOMMENDATION_TITLE_REQUIRED'),
    vehicle_id: input.vehicleId,
  };
  const { data, error } = await getSupabaseClient().from('recommended_work').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function publishPsiDyno(input: DynoPublishInput): Promise<PublishResult<DynoRecordRow>> {
  const actorId = await requireAal2StaffActor();
  const recordId = Crypto.randomUUID();
  const payload: Database['public']['Tables']['dyno_records']['Insert'] = {
    created_by: actorId,
    customer_id: input.customerId,
    fuel: optionalText(input.fuel),
    id: recordId,
    notes: optionalText(input.notes),
    power_kw_at_hubs: requiredPositiveNumber(input.powerKw, 'DYNO_POWER_INVALID'),
    record_source: 'psi_verified',
    tested_at: middayUtc(requiredDate(input.date, 'DYNO_DATE_INVALID')),
    torque_nm_at_hubs: optionalPositiveNumber(input.torqueNm, 'DYNO_TORQUE_INVALID'),
    vehicle_id: input.vehicleId,
  };
  const uploaded = input.image
    ? await uploadPrivateImage(input.image, input, recordId, 'dyno-graphs')
    : null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('dyno_records').insert(payload).select('*').single();
  if (error) {
    if (uploaded && !(await removeUploadedObject(uploaded.objectPath))) throw new Error('DYNO_RECORD_FAILED_UPLOAD_CLEANUP_REQUIRED');
    throw error;
  }
  if (!uploaded) return { attachmentStored: false, attachmentWarning: null, record: data };

  const metadataResult = await supabase.from('vehicle_files').insert({
    bucket_id: PRIVATE_DOCUMENT_BUCKET,
    created_by: actorId,
    customer_id: input.customerId,
    dyno_record_id: data.id,
    file_kind: 'dyno_graph',
    file_size_bytes: uploaded.byteLength,
    mime_type: uploaded.mimeType,
    object_path: uploaded.objectPath,
    record_source: 'psi_record',
    vehicle_id: input.vehicleId,
  });
  if (metadataResult.error) {
    const removed = await removeUploadedObject(uploaded.objectPath);
    return {
      attachmentStored: false,
      attachmentWarning: removed
        ? 'The verified dyno result was published, but its graph could not be attached. The unused private upload was removed.'
        : 'The verified dyno result was published without its graph. PSI must review private Storage because the unused upload could not be removed automatically.',
      record: data,
    };
  }
  return { attachmentStored: true, attachmentWarning: null, record: data };
}

export async function publishPsiInvoice(input: InvoicePublishInput): Promise<PublishResult<InvoiceRow>> {
  const actorId = await requireAal2StaffActor();
  const recordId = Crypto.randomUUID();
  const payload: Database['public']['Tables']['invoices']['Insert'] = {
    amount_cents: optionalAudCents(input.amountAud),
    created_by: actorId,
    currency: 'AUD',
    customer_id: input.customerId,
    id: recordId,
    invoice_date: requiredDate(input.date, 'INVOICE_DATE_INVALID'),
    invoice_number: requiredText(input.invoiceNumber, 'INVOICE_NUMBER_REQUIRED').toUpperCase(),
    summary: requiredText(input.summary, 'INVOICE_SUMMARY_REQUIRED'),
    vehicle_id: input.vehicleId,
  };
  const uploaded = input.image
    ? await uploadPrivateImage(input.image, input, recordId, 'invoices')
    : null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('invoices').insert(payload).select('*').single();
  if (error) {
    if (uploaded && !(await removeUploadedObject(uploaded.objectPath))) throw new Error('INVOICE_RECORD_FAILED_UPLOAD_CLEANUP_REQUIRED');
    throw error;
  }
  if (!uploaded) return { attachmentStored: false, attachmentWarning: null, record: data };

  const metadataResult = await supabase.from('vehicle_files').insert({
    bucket_id: PRIVATE_DOCUMENT_BUCKET,
    created_by: actorId,
    customer_id: input.customerId,
    file_kind: 'invoice',
    file_size_bytes: uploaded.byteLength,
    invoice_id: data.id,
    mime_type: uploaded.mimeType,
    object_path: uploaded.objectPath,
    record_source: 'psi_record',
    vehicle_id: input.vehicleId,
  });
  if (metadataResult.error) {
    const removed = await removeUploadedObject(uploaded.objectPath);
    return {
      attachmentStored: false,
      attachmentWarning: removed
        ? 'The invoice record was published, but its image could not be attached. The unused private upload was removed.'
        : 'The invoice record was published without its image. PSI must review private Storage because the unused upload could not be removed automatically.',
      record: data,
    };
  }
  return { attachmentStored: true, attachmentWarning: null, record: data };
}

async function requireAal2StaffActor() {
  const supabase = getSupabaseClient();
  const [{ data: userData, error: userError }, { data: assurance, error: assuranceError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (userError || !userData.user) throw userError ?? new Error('STAFF_SESSION_REQUIRED');
  if (assuranceError) throw assuranceError;
  if (assurance.currentLevel !== 'aal2') throw new Error('STAFF_AAL2_REQUIRED');

  const { data: staff, error: staffError } = await supabase
    .from('staff_members')
    .select('user_id,status')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staff || staff.status !== 'active') throw new Error('STAFF_ACCESS_DENIED');
  return userData.user.id;
}

async function uploadPrivateImage(
  image: StaffPublishImage,
  target: VehicleTarget,
  recordId: string,
  folder: 'dyno-graphs' | 'invoices',
) {
  const mimeType = normalizeImageMimeType(image.mimeType, image.uri);
  if (image.fileSize !== null && image.fileSize > MAX_STANDARD_UPLOAD_BYTES) throw new Error('IMAGE_TOO_LARGE');

  const response = await fetch(image.uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error('IMAGE_EMPTY');
  if (bytes.byteLength > MAX_STANDARD_UPLOAD_BYTES) throw new Error('IMAGE_TOO_LARGE');

  const objectPath = `${target.customerId}/vehicles/${target.vehicleId}/${folder}/${recordId}.${extensionForMimeType(mimeType)}`;
  const { error } = await getSupabaseClient()
    .storage
    .from(PRIVATE_DOCUMENT_BUCKET)
    .upload(objectPath, bytes, { cacheControl: '3600', contentType: mimeType, upsert: false });
  if (error) throw error;
  return { byteLength: bytes.byteLength, mimeType, objectPath };
}

async function removeUploadedObject(objectPath: string) {
  try {
    const { error } = await getSupabaseClient().storage.from(PRIVATE_DOCUMENT_BUCKET).remove([objectPath]);
    return !error;
  } catch {
    // Cleanup is best-effort. The database record is never represented as
    // having an attachment unless its vehicle_files row was inserted.
    return false;
  }
}

function normalizeImageMimeType(value: string | null, uri: string) {
  const normalized = value?.trim().toLowerCase() ?? '';
  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalized)) return normalized as typeof ALLOWED_IMAGE_TYPES[number];
  const uriWithoutQuery = uri.split(/[?#]/u)[0].toLowerCase();
  if (uriWithoutQuery.endsWith('.png') || uri.startsWith('data:image/png')) return 'image/png';
  if (uriWithoutQuery.endsWith('.webp') || uri.startsWith('data:image/webp')) return 'image/webp';
  if (/\.jpe?g$/u.test(uriWithoutQuery) || uri.startsWith('data:image/jpeg')) return 'image/jpeg';
  throw new Error('IMAGE_TYPE_UNSUPPORTED');
}

function extensionForMimeType(mimeType: typeof ALLOWED_IMAGE_TYPES[number]) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function requiredText(value: string, code: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function optionalText(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

function requiredDate(value: string, code: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(code);
  const date = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) throw new Error(code);
  return normalized;
}

function middayUtc(date: string) {
  return `${date}T12:00:00.000Z`;
}

function optionalWholeNumber(value: string, code: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) throw new Error(code);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}

function requiredPositiveNumber(value: string, code: string) {
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(code);
  return Math.round(parsed * 100) / 100;
}

function optionalPositiveNumber(value: string, code: string) {
  if (!value.trim()) return null;
  return requiredPositiveNumber(value, code);
}

function optionalAudCents(value: string) {
  const normalized = value.trim().replace(/^\$/u, '').replace(/,/gu, '');
  if (!normalized) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('INVOICE_AMOUNT_INVALID');
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('INVOICE_AMOUNT_INVALID');
  return cents;
}
