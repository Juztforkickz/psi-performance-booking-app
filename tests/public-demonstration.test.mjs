import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { demonstrationBookingDates, demonstrationOdometer } from '../mobile/src/lib/public-demonstration.ts';

test('sample dates follow real weekdays across the reported November boundary', () => {
  const dates = demonstrationBookingDates(new Date(2026, 9, 30, 23));
  assert.deepEqual(dates.map((item) => item.key), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
  assert.match(dates[2].label, /Wednesday/);
});

test('sample booking dates cross leap day and year boundaries correctly', () => {
  assert.equal(demonstrationBookingDates(new Date(2028, 1, 28))[0].key, '2028-02-29');
  assert.equal(demonstrationBookingDates(new Date(2026, 11, 31))[0].key, '2027-01-01');
});

test('sample odometer rejects invalid, decreasing and excessive readings', () => {
  assert.equal(demonstrationOdometer('85000', 84210), 85000);
  for (const value of ['', '84000', '-1', 'NaN', '85000.5', '1e5', '10000000']) assert.equal(demonstrationOdometer(value, 84210), null);
});

test('public tour imports only UI, configuration and sample data, not live account APIs', async () => {
  const source = await readFile(new URL('../mobile/src/app/demonstration.tsx', import.meta.url), 'utf8');
  const allowedImports = new Set(['@expo/vector-icons', 'expo-router', 'react', 'react-native', 'react-native-safe-area-context', '@/components/ui', '@/constants/brand', '@/hooks/use-responsive-layout', '@/lib/customer-preview', '@/lib/public-demonstration', '@/lib/review-environment', '@/lib/vehicle-reports-preview']);
  for (const [, imported] of source.matchAll(/from ['"]([^'"]+)['"]/g)) assert.ok(allowedImports.has(imported), `Live dependency added to public demonstration: ${imported}`);
  for (const forbidden of ['getSupabaseClient', 'useCustomerAccount', 'useCustomerAuth', 'AsyncStorage', 'SecureStore', 'fetch(', 'Linking.', 'beginHistoryImportPayment', 'requestPasswordlessEmailCode', 'registerPush', 'useNotifications']) assert.equal(source.includes(forbidden), false, forbidden);
  assert.match(source, /Demonstration • Sample data/);
  assert.match(source, /REVIEW_ENVIRONMENT\.enabled \? 'Open reviewer account'/);
});
