import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { xeroInvoiceOdometerKm, xeroWorkshopOdometer } from '../supabase/functions/_shared/xero-invoice-odometer.ts';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const read = path => readFile(new URL('../'+path, import.meta.url),'utf8');
async function load(path, imports = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(await read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, require: name => {
    if (!(name in imports)) throw Error(`Unmocked import ${name}`); return imports[name];
  }, Intl, Date, Number });
  return module.exports;
}
const dates = await load('mobile/src/lib/australian-date.ts');
const helpers = await load('mobile/src/lib/workshop-odometer.ts', { '@/lib/australian-date': dates });
const invoice = text => ({ LineItems: [{ Description: text }] });

test('explicit invoice kilometres support normal labels and number formatting', () => {
  for (const text of ['Odometer: 84,210 km','ODO 84210','KMs: 84210','Kilometres reading: 84210','Odometer (km): 84,210']) {
    assert.equal(xeroInvoiceOdometerKm(invoice(text)),84210,text);
  }
  assert.equal(xeroInvoiceOdometerKm(invoice('Repair cooling system\nOdometer: 84210 km\nParts and labour')),84210);
  assert.equal(xeroInvoiceOdometerKm(invoice('KMS : 247.254')),247254);
  assert.equal(xeroInvoiceOdometerKm({ LineItems: [{ Description: 'ODO: 0 km' }] }),0);
  assert.equal(xeroInvoiceOdometerKm({ LineItems: [{ Description: 'ODO: 84210' },{ Description: 'ODO: 84,210 km' }] }),84210);
});

test('prices, service intervals, miles, malformed and conflicting readings never become a workshop reading', () => {
  for (const text of ['Invoice total $842.10','Service every 10,000 km','Next service odometer: 90000','Odo: 84210 miles','Odo: -1','Odo: 84.21','Odo: 10000000','ODO: 84,21','Engine code 84210','Odo: 84210 km\nODO: 85210 km']) {
    assert.equal(xeroInvoiceOdometerKm(invoice(text)),null,text);
  }
  assert.equal(xeroInvoiceOdometerKm({}),null);
});

test('Xero reading uses the verified visit date and never associates another customer, vehicle or parts sale', () => {
  const target = { jobId: 'job-a', customerId: 'customer-a', vehicleId: 'vehicle-a', partsOnly: false };
  const job = { id: 'job-a', customer_id: 'customer-a', vehicle_id: 'vehicle-a', job_date: '2026-10-20' };
  const source = { ...invoice('ODO: 84210'), DateString: '2026-10-21' };
  assert.deepEqual(xeroWorkshopOdometer(source,target,job,'2026-10-21'),{ odometer_km: 84210, odometer_recorded_on: '2026-10-20' });
  for (const other of [{...job,id:'job-b'},{...job,customer_id:'customer-b'},{...job,vehicle_id:'vehicle-b'},{...job,job_date:'2026-10-22'},null]) {
    assert.deepEqual(xeroWorkshopOdometer(source,target,other,'2026-10-21'),{ odometer_km: null, odometer_recorded_on: null });
  }
  assert.equal(xeroWorkshopOdometer(source,{...target,partsOnly:true},job,'2026-10-21').odometer_km,null);
});

test('portal kilometre inputs require a matching real date and preserve zero or omitted readings', () => {
  assert.equal(JSON.stringify(helpers.workshopOdometerInput('84210','20/10/2026','21/10/2026')),JSON.stringify({odometer_km:84210,odometer_recorded_on:'2026-10-20'}));
  assert.equal(helpers.workshopOdometerInput('0','','20/10/2026').odometer_km,0);
  assert.equal(helpers.workshopOdometerInput('','20/10/2026','20/10/2026').odometer_recorded_on,null);
  for (const km of ['-1','8.5','10000000','84,210']) assert.throws(() => helpers.workshopOdometerInput(km,'20/10/2026','20/10/2026'),/ODOMETER_INVALID/);
  for (const date of ['31/02/2026','01/01/2099','unknown']) assert.throws(() => helpers.workshopOdometerInput('84210',date,'20/10/2026'),/ODOMETER_DATE_INVALID/);
  assert.match(helpers.workshopOdometerDate('2026-10-20'),/20.*2026/);
  assert.equal(helpers.workshopOdometerDate(null),'Date not recorded');
});

test('database summary keeps values and dates paired, ownership scoped, published only and service scheduling untouched', async () => {
  const sql = await read('supabase/migrations/20261021060345_dated_workshop_odometer.sql');
  for (const source of ['completion','repair','reading','invoice','record']) {
    assert.match(sql,new RegExp(`${source}\\.customer_id = vehicle\\.customer_id`));
    assert.match(sql,new RegExp(`${source}\\.vehicle_id = vehicle\\.id`));
  }
  assert.match(sql,/record\.published_at is not null/);
  assert.match(sql,/job\.vehicle_id = record\.vehicle_id and job\.customer_id = record\.customer_id/);
  assert.match(sql,/order by candidates\.recorded_on desc, candidates\.created_at desc, candidates\.source_id desc/);
  assert.match(sql,/service\.next_psi_check_in_date/);
  assert.match(sql,/service\.next_psi_check_in_odometer_km/);
  assert.match(sql,/service\.latest_customer_odometer_km/);
  assert.match(sql,/customer_identity_access_allowed/);
  assert.match(sql,/vehicle\.customer_id = \(select auth\.uid\(\)\) or \(select private\.is_active_staff\(\)\)/);
  assert.doesNotMatch(sql,/max\(.*odometer|update public\.customer_vehicles|update public\.service_completions|delete from|drop table|disable row level/i);
});

test('invoice publishers save the paired metadata before publishing and clear it when changing vehicle', async () => {
  const [publisher,vault,legacy,garage,history,context] = await Promise.all([
    read('mobile/src/components/staff-vault-publisher.tsx'),read('mobile/src/lib/staff-vault.ts'),
    read('mobile/src/lib/staff-record-publishing.ts'),read('mobile/src/app/(tabs)/garage.tsx'),
    read('mobile/src/components/staff-vehicle-history.tsx'),read('mobile/src/lib/customer-account-context.tsx'),
  ]);
  assert.match(publisher,/setVehicleId\(id\); setOdometer\(''\); setOdometerDate\(''\)/);
  assert.match(publisher,/Kilometres recorded on/);
  assert.match(vault,/run_stage: input\.runStage, \.\.\.odometer/);
  assert.match(legacy,/workshopOdometerInput\(input\.odometerKm, input\.odometerDate, input\.date\)/);
  assert.match(garage,/workshopOdometerDate\(selectedVehicle\.latestPsiOdometerRecordedOn\)/);
  assert.match(history,/WorkshopOdometerSummary vehicleId=\{vehicleId\}/);
  assert.match(context,/\.eq\('customer_id', authUserId\)/);
  assert.match(context,/AppState\.currentState !== 'active'/);
  assert.match(context,/clearInterval\(timer\); subscription\.remove\(\)/);
});

test('reimport fills missing invoice metadata without overwriting an existing reading or customer entry', async () => {
  const worker = await read('supabase/functions/process-xero-imports/index.ts');
  assert.match(worker,/\.is\('odometer_km', null\)\.is\('odometer_recorded_on', null\)/);
  assert.match(worker,/\.eq\('customer_id', matched.customerId\)\.eq\('vehicle_id', matched.vehicleId\)/);
  assert.match(worker,/\.neq\('source', 'customer_entry'\)/);
  assert.match(worker,/fillMissingInvoiceOdometer\(admin, matched, invoice, publishedMatchedInvoice.id\)/);
  assert.match(worker,/fillMissingInvoiceOdometer\(admin, matched, invoice, existingVehicleInvoice.id, true\)/);
});
