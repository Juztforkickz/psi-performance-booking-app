const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const AUSTRALIAN_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/u;

export type IsoDateParts = { day: number; month: number; year: number };

export function australianDateToIso(value: string) {
  const match = AUSTRALIAN_DATE_PATTERN.exec(value.trim());
  if (!match) return null;
  const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
  return isRealIsoDate(isoDate) ? isoDate : null;
}

export function isoDateToAustralian(value: string | null | undefined) {
  if (!value) return '';
  const match = ISO_DATE_PATTERN.exec(value.slice(0, 10));
  if (!match || !isRealIsoDate(match[0])) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function isoDateParts(value: string | null | undefined): IsoDateParts | null {
  if (!value) return null;
  const match = ISO_DATE_PATTERN.exec(value.slice(0, 10));
  if (!match || !isRealIsoDate(match[0])) return null;
  return { day: Number(match[3]), month: Number(match[2]), year: Number(match[1]) };
}

export function isoDateUtc(value: string | null | undefined) {
  const parts = isoDateParts(value);
  return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)) : null;
}

export function formatIsoDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  fallback = '',
) {
  const date = isoDateUtc(value);
  return date
    ? new Intl.DateTimeFormat('en-AU', { ...options, timeZone: 'UTC' }).format(date)
    : fallback;
}

export function isoWeekday(value: string | null | undefined) {
  const date = isoDateUtc(value);
  return date ? date.getUTCDay() : null;
}

export function daysInIsoMonth(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return 0;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthCalendarGrid(year: number, month: number) {
  const daysInMonth = daysInIsoMonth(year, month);
  if (!daysInMonth) return [];
  const firstWeekdayMondayBased = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = Array(firstWeekdayMondayBased).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function shiftIsoMonth(value: { month: number; year: number }, offset: number) {
  const absoluteMonth = value.year * 12 + value.month - 1 + offset;
  const year = Math.floor(absoluteMonth / 12);
  return { month: absoluteMonth - year * 12 + 1, year };
}

export function addIsoMonths(value: string, months: number) {
  const parts = isoDateParts(value);
  if (!parts || !Number.isInteger(months)) return null;
  const target = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const targetDay = Math.min(parts.day, daysInIsoMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

export function formatAustralianDate(value: string | number | null | undefined, fallback = 'Not scheduled') {
  if (!value) return fallback;
  const storedDate = typeof value === 'string' ? isoDateToAustralian(value) : '';
  if (typeof value === 'string' && value.length === 10) return storedDate || fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return storedDate || fallback;
  const parts = new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: 'day' | 'month' | 'year') => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')}`;
}

export function formatAustralianDateTime(value: string, includeSeconds = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    month: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  const time = `${part('hour')}:${part('minute')}${includeSeconds ? `:${part('second')}` : ''} ${part('dayPeriod').toLowerCase()}`;
  return `${part('day')}/${part('month')}/${part('year')}, ${time}`;
}

export function todayAustralianDate(timeZone = 'Australia/Melbourne') {
  const parts = new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(new Date());
  const part = (type: 'day' | 'month' | 'year') => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')}`;
}

function isRealIsoDate(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
