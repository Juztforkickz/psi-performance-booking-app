import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const dateSource = await readFile(new URL('../mobile/src/lib/australian-date.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(dateSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dateModule = { exports: {} };
vm.runInNewContext(compiled, { exports: dateModule.exports, module: dateModule });

const {
  addIsoMonths,
  daysInIsoMonth,
  formatIsoDate,
  isoWeekday,
  monthCalendarGrid,
  shiftIsoMonth,
} = dateModule.exports;

test('4 November 2026 is Wednesday in every date only formatter and calendar column', () => {
  assert.equal(isoWeekday('2026-11-04'), 3);
  assert.equal(formatIsoDate('2026-11-04', { dateStyle: 'full' }), 'Wednesday, 4 November 2026');

  const grid = monthCalendarGrid(2026, 11);
  const cell = grid.indexOf(4);
  assert.notEqual(cell, -1);
  assert.equal(cell % 7, 2, 'Wednesday must occupy the third column of a Monday first calendar');
});

test('calendar grids preserve every Gregorian month length and weekday', () => {
  for (let year = 1900; year <= 2100; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const grid = monthCalendarGrid(year, month);
      const days = grid.filter((value) => value !== null);
      assert.equal(days.length, daysInIsoMonth(year, month));
      assert.equal(JSON.stringify(days), JSON.stringify(Array.from({ length: days.length }, (_, index) => index + 1)));
      for (const day of days) {
        const column = grid.indexOf(day) % 7;
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        assert.equal(column, (isoWeekday(iso) + 6) % 7);
      }
    }
  }
});

test('month movement and booking limits clamp safely at year and leap month boundaries', () => {
  assert.equal(JSON.stringify(shiftIsoMonth({ month: 12, year: 2026 }, 1)), JSON.stringify({ month: 1, year: 2027 }));
  assert.equal(JSON.stringify(shiftIsoMonth({ month: 1, year: 2027 }, -1)), JSON.stringify({ month: 12, year: 2026 }));
  assert.equal(addIsoMonths('2025-01-31', 1), '2025-02-28');
  assert.equal(addIsoMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addIsoMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(addIsoMonths('2025-08-31', 18), '2027-02-28');
});

test('customer, portal and integration date only paths use fixed UTC calendar calculations', async () => {
  const [picker, bookingFlow, adminQueue, integrationWorker] = await Promise.all([
    readFile(new URL('../mobile/src/components/month-calendar-picker.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/components/BookingFlow.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/AdminQueue.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/functions/process-booking-integrations/index.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(picker, /monthCalendarGrid/u);
  assert.match(picker, /formatIsoDate/u);
  assert.doesNotMatch(picker, /new Date\(year, month/u);
  assert.match(bookingFlow, /getUTCDay\(\)/u);
  assert.match(bookingFlow, /timeZone: "UTC"/u);
  assert.match(adminQueue, /T12:00:00Z/u);
  assert.match(integrationWorker, /T12:00:00Z/u);
  assert.doesNotMatch(integrationWorker, /T12:00:00\+10:00/u);
});
