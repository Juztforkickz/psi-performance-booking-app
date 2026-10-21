import type { XeroInvoice } from './xero-invoice-match.ts';

/** Accept one explicitly labelled reading, never service intervals, money or miles. */
export function xeroInvoiceOdometerKm(invoice: XeroInvoice): number | null {
  const readings = new Set<number>();
  const descriptions = (invoice.LineItems ?? []).map(item => item.Description ?? '');
  for (const description of descriptions) for (const line of description.split(/[\r\n]+/u)) {
    const match = /^(?:odometer|odo|kilometres|kilometers|kms?)(?:\s+reading)?(?:\s*\(km\))?\s*[:=]?\s*(\d{1,7}|\d{1,3}(?:,\d{3}){1,2}|\d{1,3}(?:\.\d{3}){1,2})(?:\s*(?:km|kms|kilometres|kilometers))?\s*$/iu.exec(line.trim());
    if (match) readings.add(Number(match[1].replace(/[,.]/gu, '')));
  }
  return readings.size === 1 ? [...readings][0] : null;
}

type Job = { id: string; customer_id: string; vehicle_id: string; job_date: string };
type Target = { customerId: string; vehicleId: string; jobId: string | null; partsOnly: boolean };
export function xeroWorkshopOdometer(invoice: XeroInvoice, target: Target, job: Job | null, today: string) {
  const empty = { odometer_km: null, odometer_recorded_on: null };
  const kilometres = xeroInvoiceOdometerKm(invoice);
  if (kilometres === null || target.partsOnly || !job || job.id !== target.jobId
    || job.customer_id !== target.customerId || job.vehicle_id !== target.vehicleId
    || !/^\d{4}-\d{2}-\d{2}$/u.test(job.job_date) || job.job_date > today) return empty;
  return { odometer_km: kilometres, odometer_recorded_on: job.job_date };
}
