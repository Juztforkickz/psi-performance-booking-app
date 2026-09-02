import type { CustomerAccountSnapshot } from '@/lib/customer-account';
import type { PreviewVehicle } from '@/lib/customer-preview';
import type {
  DynoRecordRow,
  InvoiceRow,
  RecommendedWorkRow,
  RepairRecordRow,
  VehicleFileRow,
} from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';
import { kilowattsToHorsepower } from '@/lib/dyno-power';
import type {
  DynoRecord,
  FutureRepair,
  InvoiceRecord,
  RepairRecord,
  SecureVehicleAttachment,
} from '@/lib/vehicle-reports-preview';

export type CustomerVehicleReportsSnapshot = {
  dynoRecords: DynoRecordRow[];
  invoices: InvoiceRow[];
  recommendedWork: RecommendedWorkRow[];
  repairRecords: RepairRecordRow[];
  vehicleFiles: VehicleFileRow[];
};

export async function loadCustomerVehicleReports(): Promise<CustomerVehicleReportsSnapshot> {
  const supabase = getSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user?.email) throw authError ?? new Error('CUSTOMER_SESSION_REQUIRED');

  const [dynoRecordsResult, repairRecordsResult, recommendedWorkResult, invoicesResult, vehicleFilesResult] = await Promise.all([
    supabase.from('dyno_records').select('*').eq('customer_id', user.id).is('archived_at', null).order('tested_at', { ascending: false }),
    supabase.from('repair_records').select('*').eq('customer_id', user.id).is('archived_at', null).order('repair_date', { ascending: false }),
    supabase.from('recommended_work').select('*').eq('customer_id', user.id).is('archived_at', null).order('created_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('customer_id', user.id).is('archived_at', null).order('invoice_date', { ascending: false }),
    supabase.from('vehicle_files').select('*').eq('customer_id', user.id).is('archived_at', null).order('created_at', { ascending: false }),
  ]);

  if (dynoRecordsResult.error) throw dynoRecordsResult.error;
  if (repairRecordsResult.error) throw repairRecordsResult.error;
  if (recommendedWorkResult.error) throw recommendedWorkResult.error;
  if (invoicesResult.error) throw invoicesResult.error;
  if (vehicleFilesResult.error) throw vehicleFilesResult.error;

  return {
    dynoRecords: dynoRecordsResult.data ?? [],
    invoices: invoicesResult.data ?? [],
    recommendedWork: recommendedWorkResult.data ?? [],
    repairRecords: repairRecordsResult.data ?? [],
    vehicleFiles: vehicleFilesResult.data ?? [],
  };
}

export function getAccountReportVehicles(account: CustomerAccountSnapshot): PreviewVehicle[] {
  return account.vehicles.map((vehicle) => {
    const summary = account.serviceSummaries.find((candidate) => candidate.vehicle_id === vehicle.id);
    return {
      id: vehicle.id,
      isPrimary: vehicle.is_primary,
      lastVisit: summary?.latest_psi_service_at ?? null,
      latestPsiOdometerKm: summary?.latest_psi_odometer_km ?? null,
      make: vehicle.make,
      model: vehicle.model,
      nextDue: summary?.next_psi_check_in_date ?? null,
      nextPsiCheckInOdometerKm: summary?.next_psi_check_in_odometer_km ?? null,
      odometerKm: summary?.latest_customer_odometer_km ?? vehicle.odometer_km,
      registration: vehicle.registration,
      vinLastFour: vehicle.vin_last_four,
      year: vehicle.year,
    };
  });
}

export function getAccountDynoRecords(reports: CustomerVehicleReportsSnapshot): DynoRecord[] {
  return getAccountDynoRecordsFromRows(reports.dynoRecords, reports.vehicleFiles);
}

export function getAccountDynoRecordsFromRows(dynoRecords: DynoRecordRow[], vehicleFiles: VehicleFileRow[]): DynoRecord[] {
  return dynoRecords.map((record) => ({
    createdBy: record.record_source === 'psi_verified' ? 'psi' : 'customer_account',
    fuel: record.fuel ?? 'Not recorded',
    graphImage: null,
    id: record.id,
    notes: record.notes ?? '',
    peakPowerHpAtHubs: kilowattsToHorsepower(record.power_kw_at_hubs),
    peakTorqueNmAtHubs: record.torque_nm_at_hubs,
    recordedAt: record.tested_at,
    secureAttachment: toSecureAttachment(newestFileFor(vehicleFiles, 'dyno_record_id', record.id, 'dyno_graph')),
    vehicleId: record.vehicle_id,
    verification: record.record_source === 'psi_verified' ? 'psi_verified' : 'customer_entry',
  }));
}

export function getAccountRepairRecords(reports: CustomerVehicleReportsSnapshot): RepairRecord[] {
  return reports.repairRecords.map((record) => ({
    createdBy: record.record_source === 'psi_record' ? 'psi' : 'customer_account',
    description: record.notes ?? 'No additional notes recorded.',
    id: record.id,
    odometerKm: record.odometer_km,
    repairedAt: record.repair_date,
    title: record.title,
    vehicleId: record.vehicle_id,
  }));
}

export function getAccountFutureRepairs(reports: CustomerVehicleReportsSnapshot): FutureRepair[] {
  return reports.recommendedWork.map((record) => ({
    createdBy: record.record_source === 'psi_record' ? 'psi' : 'customer_account',
    id: record.id,
    notes: record.notes ?? 'No additional notes recorded.',
    status: record.status,
    timing: record.timing ?? 'Timing to be confirmed',
    title: record.title,
    vehicleId: record.vehicle_id,
  }));
}

export function getAccountInvoices(reports: CustomerVehicleReportsSnapshot): InvoiceRecord[] {
  return reports.invoices.map((record) => {
    const secureAttachment = toSecureAttachment(newestFileFor(reports.vehicleFiles, 'invoice_id', record.id, 'invoice'));
    return {
      amountAud: record.amount_cents == null ? null : record.amount_cents / 100,
      attachment: null,
      attachmentStatus: secureAttachment ? 'secure_attachment_available' : 'secure_file_unavailable',
      createdBy: 'psi',
      id: record.id,
      invoiceDate: record.invoice_date,
      invoiceNumber: record.invoice_number,
      secureAttachment,
      summary: record.summary,
      vehicleId: record.vehicle_id,
    };
  });
}

function newestFileFor(
  files: VehicleFileRow[],
  relation: 'dyno_record_id' | 'invoice_id',
  recordId: string,
  fileKind: 'dyno_graph' | 'invoice',
) {
  return files.find((file) => file[relation] === recordId && file.file_kind === fileKind) ?? null;
}

function toSecureAttachment(file: VehicleFileRow | null): SecureVehicleAttachment | null {
  if (!file) return null;
  return {
    bucketId: file.bucket_id,
    fileSizeBytes: file.file_size_bytes,
    id: file.id,
    mimeType: file.mime_type,
    objectPath: file.object_path,
    recordSource: file.record_source,
  };
}
