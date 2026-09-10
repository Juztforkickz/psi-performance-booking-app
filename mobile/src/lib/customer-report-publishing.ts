import * as Crypto from 'expo-crypto';

import { australianDateToIso } from '@/lib/australian-date';
import type {
  Database,
  DynoRecordRow,
  InvoiceRow,
  RecommendedWorkRow,
  RepairRecordRow,
} from '@/lib/database.types';
import { horsepowerToKilowatts } from '@/lib/dyno-power';
import { getSupabaseClient } from '@/lib/supabase';
import type { PreviewAttachment } from '@/lib/vehicle-reports-preview';

const PRIVATE_DOCUMENT_BUCKET = 'vehicle-documents' as const;
const MAX_CUSTOMER_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type VehicleTarget = { vehicleId: string };
type AttachmentResult = { attachmentStored: boolean; attachmentWarning: string | null };

export type CustomerDynoInput = VehicleTarget & {
  date: string;
  fuel: string;
  graphImage: PreviewAttachment | null;
  notes: string;
  power: string;
  torque: string;
};

export type CustomerRepairInput = VehicleTarget & {
  date: string;
  description: string;
  odometer: string;
  title: string;
};

export type CustomerRecommendationInput = VehicleTarget & {
  notes: string;
  status: 'due_soon' | 'monitor' | 'priority' | 'recommended';
  timing: string;
  title: string;
};

export type CustomerInvoiceInput = VehicleTarget & {
  amount: string;
  attachment: PreviewAttachment | null;
  date: string;
  invoiceNumber: string;
  summary: string;
};

export async function saveCustomerDyno(input: CustomerDynoInput): Promise<AttachmentResult & { record: DynoRecordRow }> {
  const actorId = await requireOwnedVehicle(input.vehicleId);
  const recordId = Crypto.randomUUID();
  const payload: Database['public']['Tables']['dyno_records']['Insert'] = {
    created_by: actorId,
    customer_id: actorId,
    fuel: requiredText(input.fuel, 'DYNO_FUEL_REQUIRED'),
    id: recordId,
    notes: optionalText(input.notes),
    power_kw_at_hubs: horsepowerToKilowatts(requiredPositiveNumber(input.power, 'DYNO_POWER_INVALID')),
    record_source: 'customer_entry',
    tested_at: middayUtc(requiredDate(input.date, 'DYNO_DATE_INVALID')),
    torque_nm_at_hubs: requiredPositiveNumber(input.torque, 'DYNO_TORQUE_INVALID'),
    vehicle_id: input.vehicleId,
  };
  const { data, error } = await getSupabaseClient().from('dyno_records').insert(payload).select('*').single();
  if (error) throw error;
  const attachment = await persistAttachment(input.graphImage, actorId, input.vehicleId, recordId, 'dyno');
  return { record: data, ...attachment };
}

export async function saveCustomerRepair(input: CustomerRepairInput): Promise<RepairRecordRow> {
  const actorId = await requireOwnedVehicle(input.vehicleId);
  const odometerKm = input.odometer.trim() ? requiredWholeNumber(input.odometer, 'ODOMETER_INVALID') : null;
  const payload: Database['public']['Tables']['repair_records']['Insert'] = {
    created_by: actorId,
    customer_id: actorId,
    notes: requiredText(input.description, 'REPAIR_DESCRIPTION_REQUIRED'),
    odometer_km: odometerKm,
    record_kind: 'repair',
    record_source: 'customer_entry',
    repair_date: requiredDate(input.date, 'REPAIR_DATE_INVALID'),
    title: requiredText(input.title, 'REPAIR_TITLE_REQUIRED'),
    vehicle_id: input.vehicleId,
  };
  const { data, error } = await getSupabaseClient().from('repair_records').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function saveCustomerRecommendation(input: CustomerRecommendationInput): Promise<RecommendedWorkRow> {
  const actorId = await requireOwnedVehicle(input.vehicleId);
  const payload: Database['public']['Tables']['recommended_work']['Insert'] = {
    created_by: actorId,
    customer_id: actorId,
    notes: requiredText(input.notes, 'RECOMMENDATION_NOTES_REQUIRED'),
    record_source: 'customer_entry',
    status: input.status,
    timing: requiredText(input.timing, 'RECOMMENDATION_TIMING_REQUIRED'),
    title: requiredText(input.title, 'RECOMMENDATION_TITLE_REQUIRED'),
    vehicle_id: input.vehicleId,
  };
  const { data, error } = await getSupabaseClient().from('recommended_work').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function saveCustomerInvoice(input: CustomerInvoiceInput): Promise<AttachmentResult & { record: InvoiceRow }> {
  const actorId = await requireOwnedVehicle(input.vehicleId);
  const recordId = Crypto.randomUUID();
  const payload: Database['public']['Tables']['invoices']['Insert'] = {
    amount_cents: input.amount.trim() ? audCents(input.amount) : null,
    created_by: actorId,
    currency: 'AUD',
    customer_id: actorId,
    id: recordId,
    invoice_date: requiredDate(input.date, 'INVOICE_DATE_INVALID'),
    invoice_number: requiredText(input.invoiceNumber, 'INVOICE_NUMBER_REQUIRED').toUpperCase(),
    record_source: 'customer_entry',
    summary: requiredText(input.summary, 'INVOICE_SUMMARY_REQUIRED'),
    vehicle_id: input.vehicleId,
  };
  const { data, error } = await getSupabaseClient().from('invoices').insert(payload).select('*').single();
  if (error) throw error;
  const attachment = await persistAttachment(input.attachment, actorId, input.vehicleId, recordId, 'invoice');
  return { record: data, ...attachment };
}

async function requireOwnedVehicle(vehicleId: string) {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) throw userError ?? new Error('CUSTOMER_SESSION_REQUIRED');
  const { data: vehicle, error: vehicleError } = await supabase
    .from('customer_vehicles')
    .select('id')
    .eq('id', vehicleId)
    .eq('customer_id', user.id)
    .is('archived_at', null)
    .maybeSingle();
  if (vehicleError) throw vehicleError;
  if (!vehicle) throw new Error('CUSTOMER_VEHICLE_REQUIRED');
  return user.id;
}

async function persistAttachment(
  attachment: PreviewAttachment | null,
  customerId: string,
  vehicleId: string,
  recordId: string,
  kind: 'dyno' | 'invoice',
): Promise<AttachmentResult> {
  if (!attachment) return { attachmentStored: false, attachmentWarning: null };
  let objectPath: string | null = null;
  try {
    const mimeType = normalizeMimeType(attachment.mimeType, attachment.uri);
    if (attachment.fileSizeBytes != null && attachment.fileSizeBytes > MAX_CUSTOMER_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_TOO_LARGE');
    const bytes = await (await fetch(attachment.uri)).arrayBuffer();
    if (!bytes.byteLength) throw new Error('ATTACHMENT_EMPTY');
    if (bytes.byteLength > MAX_CUSTOMER_ATTACHMENT_BYTES) throw new Error('ATTACHMENT_TOO_LARGE');
    objectPath = `${customerId}/vehicles/${vehicleId}/customer-${kind}/${recordId}.${extensionFor(mimeType)}`;
    const supabase = getSupabaseClient();
    const upload = await supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).upload(objectPath, bytes, {
      cacheControl: '3600', contentType: mimeType, upsert: false,
    });
    if (upload.error) throw upload.error;
    const metadata = await supabase.from('vehicle_files').insert({
      bucket_id: PRIVATE_DOCUMENT_BUCKET,
      created_by: customerId,
      customer_id: customerId,
      dyno_record_id: kind === 'dyno' ? recordId : null,
      file_kind: kind === 'dyno' ? 'dyno_graph' : 'invoice',
      file_size_bytes: bytes.byteLength,
      invoice_id: kind === 'invoice' ? recordId : null,
      mime_type: mimeType,
      object_path: objectPath,
      record_source: 'customer_entry',
      vehicle_id: vehicleId,
    });
    if (metadata.error) throw metadata.error;
    return { attachmentStored: true, attachmentWarning: null };
  } catch {
    if (objectPath) {
      try {
        await getSupabaseClient().storage.from(PRIVATE_DOCUMENT_BUCKET).remove([objectPath]);
      } catch {
        // The saved report remains valid even when orphan cleanup is unavailable.
      }
    }
    return {
      attachmentStored: false,
      attachmentWarning: `The ${kind === 'dyno' ? 'dyno result' : 'invoice'} was saved, but its image could not be attached. Choose a JPG, PNG or WebP image smaller than 8 MB and try a new entry.`,
    };
  }
}

function normalizeMimeType(value: string | null | undefined, uri: string) {
  const normalized = value?.trim().toLowerCase() ?? '';
  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalized)) return normalized as typeof ALLOWED_IMAGE_TYPES[number];
  const path = uri.split(/[?#]/u)[0].toLowerCase();
  if (path.endsWith('.png') || uri.startsWith('data:image/png')) return 'image/png';
  if (path.endsWith('.webp') || uri.startsWith('data:image/webp')) return 'image/webp';
  if (/\.jpe?g$/u.test(path) || uri.startsWith('data:image/jpeg')) return 'image/jpeg';
  throw new Error('ATTACHMENT_TYPE_UNSUPPORTED');
}

function extensionFor(mimeType: typeof ALLOWED_IMAGE_TYPES[number]) {
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
  const date = australianDateToIso(value);
  if (!date) throw new Error(code);
  return date;
}

function requiredPositiveNumber(value: string, code: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(code);
  return parsed;
}

function requiredWholeNumber(value: string, code: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}

function audCents(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || Math.round(parsed * 100) !== parsed * 100) throw new Error('INVOICE_AMOUNT_INVALID');
  return Math.round(parsed * 100);
}

function middayUtc(date: string) {
  return `${date}T12:00:00.000Z`;
}
