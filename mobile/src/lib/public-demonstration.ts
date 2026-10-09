/** Pure, disposable examples. This module must never read or write an account. */
export type DemonstrationDate = { key: string; label: string };

export function demonstrationBookingDates(now = new Date()): DemonstrationDate[] {
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const dates: DemonstrationDate[] = [];
  while (dates.length < 5) {
    cursor.setDate(cursor.getDate() + 1);
    if (cursor.getDay() === 0 || cursor.getDay() === 6) continue;
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    dates.push({ key, label: cursor.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) });
  }
  return dates;
}

export function demonstrationOdometer(value: string, previous: number): number | null {
  if (!/^\d{1,7}$/.test(value.trim())) return null;
  const next = Number(value);
  return next >= previous && next <= 9999999 ? next : null;
}

export const DEMONSTRATION_PLANS = [
  { id: 'annual', title: 'Annual', price: 'AUD $99', interval: 'per year' },
  { id: 'monthly', title: 'Monthly', price: 'AUD $9.99', interval: 'per month' },
] as const;

export const DEMONSTRATION_SERVICES = ['Service & Report', 'Dyno Tuning'] as const;
