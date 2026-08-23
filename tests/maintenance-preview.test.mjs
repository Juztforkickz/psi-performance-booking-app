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

test('Garage exposes odometer and service scheduling fields with an honest preview boundary', async () => {
  const garage = await readFile(garagePath, 'utf8');

  assert.match(garage, /Edit Maintenance Details/u);
  assert.match(garage, /Customer odometer/u);
  assert.match(garage, /Last PSI service/u);
  assert.match(garage, /Next PSI check-in/u);
  assert.match(garage, /Personal last service/u);
  assert.match(garage, /Personal next check-in/u);
  assert.match(garage, /Nothing was uploaded or permanently saved/u);
  assert.match(garage, /cannot replace the protected Last PSI service or Next PSI check-in/u);
});

test('Vehicle Reports reads the same maintenance preview without adding persistence', async () => {
  const reports = await readFile(reportsPath, 'utf8');

  assert.match(reports, /vehicleMaintenance\[selectedVehicle\.id\]/u);
  assert.match(reports, /Local maintenance preview · not PSI verified/u);
  assert.doesNotMatch(reports, /AsyncStorage|localStorage|EXPO_PUBLIC_API_BASE_URL/u);
});
