const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const AUSTRALIAN_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/u;

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
