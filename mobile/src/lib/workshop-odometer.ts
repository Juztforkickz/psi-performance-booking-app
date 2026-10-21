import { australianDateToIso, formatAustralianDate, todayAustralianDate } from '@/lib/australian-date';

export function workshopOdometerInput(kilometres: string | undefined, recordedDate: string | undefined, fallbackDate: string) {
  const value = kilometres?.trim() ?? '';
  if (!value) return { odometer_km: null, odometer_recorded_on: null };
  if (!/^\d{1,7}$/u.test(value)) throw new Error('ODOMETER_INVALID');
  const date = australianDateToIso(recordedDate?.trim() || fallbackDate);
  if (!date || date > australianDateToIso(todayAustralianDate())!) throw new Error('ODOMETER_DATE_INVALID');
  return { odometer_km: Number(value), odometer_recorded_on: date };
}

export function workshopOdometerDate(value?: string | null) {
  return value ? `Recorded ${formatAustralianDate(value, 'Date unavailable')}` : 'Date not recorded';
}
