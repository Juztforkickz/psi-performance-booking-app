import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contextPath = new URL('../mobile/src/lib/customer-preview-context.tsx', import.meta.url);
const garagePath = new URL('../mobile/src/app/(tabs)/garage.tsx', import.meta.url);
const reportsPath = new URL('../mobile/src/app/vehicle-reports.tsx', import.meta.url);

test('vehicle maintenance edits stay in the shared in-memory preview context', async () => {
  const context = await readFile(contextPath, 'utf8');

  assert.match(context, /updateVehicleMaintenancePreview/u);
  assert.match(context, /updatedLocally: true/u);
  assert.doesNotMatch(context, /AsyncStorage|localStorage|fetch\s*\(/u);
});

test('Garage exposes the customer odometer and PSI-only service scheduling fields', async () => {
  const garage = await readFile(garagePath, 'utf8');

  assert.match(garage, /Edit details/u);
  assert.match(garage, /Customer odometer/u);
  assert.match(garage, /Last PSI service/u);
  assert.match(garage, /Next PSI check-in/u);
  assert.doesNotMatch(garage, /Personal last service/u);
  assert.doesNotMatch(garage, /Personal next check-in/u);
  assert.match(garage, /Your reading stays separate from PSI workshop service records\./u);
});

test('Vehicle Reports shows the customer odometer without personal service labels', async () => {
  const reports = await readFile(reportsPath, 'utf8');

  assert.match(reports, /vehicleMaintenance\[selectedVehicle\.id\]/u);
  assert.doesNotMatch(reports, /Personal reminder · not a PSI record/u);
  assert.doesNotMatch(reports, /Personal next check-in/u);
  assert.doesNotMatch(reports, /AsyncStorage|localStorage|EXPO_PUBLIC_API_BASE_URL/u);
});
