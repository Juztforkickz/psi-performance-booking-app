import { CUSTOMER_PREVIEW } from '@/lib/customer-preview';

export type PreviewAttachment = {
  height: number;
  uri: string;
  width: number;
};

export type SecureVehicleAttachment = {
  bucketId: 'vehicle-documents' | 'vehicle-photos';
  fileSizeBytes: number;
  id: string;
  mimeType: string;
  objectPath: string;
  recordSource: 'customer_entry' | 'psi_record';
};

export type DynoRecord = {
  createdBy: 'customer_account' | 'customer_preview' | 'psi' | 'psi_preview_fixture';
  fuel: string;
  graphImage: PreviewAttachment | null;
  id: string;
  notes: string;
  peakPowerKwAtHubs: number;
  peakTorqueNmAtHubs: number | null;
  recordedAt: string;
  secureAttachment?: SecureVehicleAttachment | null;
  vehicleId: string;
  verification: 'customer_entry' | 'customer_preview' | 'psi_verified';
};

export type RepairRecord = {
  createdBy: 'customer_account' | 'customer_preview' | 'psi' | 'psi_preview_fixture';
  description: string;
  id: string;
  odometerKm: number | null;
  repairedAt: string;
  title: string;
  vehicleId: string;
};

export type FutureRepairStatus = 'due_soon' | 'monitor' | 'priority' | 'recommended';

export type FutureRepair = {
  createdBy: 'customer_account' | 'customer_preview' | 'psi' | 'psi_preview_fixture';
  id: string;
  notes: string;
  status: FutureRepairStatus;
  timing: string;
  title: string;
  vehicleId: string;
};

export type InvoiceAttachmentStatus = 'image_selected_locally' | 'no_attachment' | 'preview_reference_only' | 'secure_attachment_available' | 'secure_file_unavailable';

export type InvoiceRecord = {
  amountAud: number | null;
  attachment: PreviewAttachment | null;
  attachmentStatus: InvoiceAttachmentStatus;
  createdBy: 'customer_preview' | 'psi' | 'psi_preview_fixture';
  id: string;
  invoiceDate: string;
  invoiceNumber: string;
  secureAttachment?: SecureVehicleAttachment | null;
  summary: string;
  vehicleId: string;
};

export const FUTURE_REPAIR_STATUS_LABELS: Readonly<Record<FutureRepairStatus, string>> = {
  monitor: 'Monitor',
  recommended: 'Recommended',
  due_soon: 'Due Soon',
  priority: 'Priority',
};

export const PREVIEW_DYNO_RECORDS: readonly DynoRecord[] = CUSTOMER_PREVIEW.dynoResults.map((result) => ({
  id: result.id,
  vehicleId: result.vehicleId,
  recordedAt: result.recordedAt,
  peakPowerKwAtHubs: result.peakPower.value,
  peakTorqueNmAtHubs: result.peakTorque.value,
  fuel: result.fuel,
  notes: result.summary,
  graphImage: null,
  createdBy: 'psi_preview_fixture',
  verification: 'psi_verified',
}));

export const PREVIEW_REPAIR_RECORDS: readonly RepairRecord[] = [
  {
    id: 'repair-vf-service-2026-05-14',
    vehicleId: 'vehicle-vf-ss',
    title: 'Service & workshop inspection',
    repairedAt: '2026-05-14',
    odometerKm: 84210,
    description: 'Fluids, filters and general vehicle health inspection.',
    createdBy: 'psi_preview_fixture',
  },
  {
    id: 'repair-vf-driveline-2026-02-18',
    vehicleId: 'vehicle-vf-ss',
    title: 'Driveline inspection',
    repairedAt: '2026-02-18',
    odometerKm: null,
    description: 'Workshop inspection and report.',
    createdBy: 'psi_preview_fixture',
  },
] as const;

export const PREVIEW_FUTURE_REPAIRS: readonly FutureRepair[] = [
  {
    id: 'future-vf-differential-leak',
    vehicleId: 'vehicle-vf-ss',
    title: 'Rear differential oil leak',
    timing: 'Next service check-in',
    notes: 'Inspect again at next service.',
    status: 'monitor',
    createdBy: 'psi_preview_fixture',
  },
  {
    id: 'future-vf-front-brakes',
    vehicleId: 'vehicle-vf-ss',
    title: 'Front brake pads',
    timing: 'Before the next performance visit',
    notes: 'Approximate remaining life to be confirmed by PSI.',
    status: 'due_soon',
    createdBy: 'psi_preview_fixture',
  },
  {
    id: 'future-vf-cooling',
    vehicleId: 'vehicle-vf-ss',
    title: 'Cooling system inspection',
    timing: 'During next planning review',
    notes: 'Review before next performance stage.',
    status: 'recommended',
    createdBy: 'psi_preview_fixture',
  },
] as const;

export const PREVIEW_INVOICE_RECORDS: readonly InvoiceRecord[] = [
  {
    id: 'invoice-vf-2026-0514',
    vehicleId: 'vehicle-vf-ss',
    invoiceNumber: 'PSI-INV-2026-0514',
    invoiceDate: '2026-05-14',
    amountAud: 423.5,
    summary: 'Service & workshop inspection',
    attachment: null,
    attachmentStatus: 'preview_reference_only',
    createdBy: 'psi_preview_fixture',
  },
  {
    id: 'invoice-vf-2026-0218',
    vehicleId: 'vehicle-vf-ss',
    invoiceNumber: 'PSI-INV-2026-0218',
    invoiceDate: '2026-02-18',
    amountAud: null,
    summary: 'Driveline inspection and workshop report',
    attachment: null,
    attachmentStatus: 'preview_reference_only',
    createdBy: 'psi_preview_fixture',
  },
] as const;

type DatedVehicleRecord = {
  invoiceDate?: string;
  recordedAt?: string;
  repairedAt?: string;
  vehicleId: string;
};

export function filterVehicleRecords<T extends DatedVehicleRecord>(records: readonly T[], vehicleId: string) {
  return records
    .filter((record) => record.vehicleId === vehicleId)
    .sort((left, right) => getRecordDate(right).localeCompare(getRecordDate(left)));
}

function getRecordDate(record: { invoiceDate?: string; recordedAt?: string; repairedAt?: string }) {
  return record.recordedAt ?? record.repairedAt ?? record.invoiceDate ?? '';
}
