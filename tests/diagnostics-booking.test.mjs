import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const load = async (path, imports = {}, globals = {}) => {
  const source = ts.transpileModule(await read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (!(name in imports)) throw Error(`Unmocked import: ${name}`);
    return imports[name];
  }, Intl, Date, Set, Map, console, process: { env: {} }, ...globals });
  return module.exports;
};
const diagnostics = await load('mobile/src/lib/diagnostics.ts');
const date = await load('mobile/src/lib/australian-date.ts');
const bookingImports = {
  '@/lib/australian-date': date, '@/lib/diagnostics': diagnostics,
  '@/lib/booking-integrations': {}, '@/lib/notifications': {}, '@/lib/supabase': {},
};
const booking = await load('mobile/src/lib/booking.ts', bookingImports);
const validDetails = {
  ...diagnostics.EMPTY_DIAGNOSTICS_DETAILS, helpNeeded: 'diagnosis', startedWhen: 'Last week',
  occursWhen: 'When starting cold', drivingStatus: 'issue', warningLights: 'no',
};
const form = () => ({ ...booking.EMPTY_BOOKING, bookingType: 'diagnostics', vehiclePowertrain: 'petrol',
  diagnosticsDetails: { ...validDetails }, requestDetails: 'Engine hesitates on a cold start.',
  vehicleMake: 'Example', vehicleModel: 'Coupe', vehicleYear: '2020', registration: 'QA001',
  firstName: 'Example', lastName: 'Customer', email: 'example@example.com', mobile: '0400000000',
  appointmentPreferenceMode: 'flexible', consent: true, bookingTermsAccepted: true,
});

test('diagnostics requires the meaningful fault details and supports known repair and unsure paths', () => {
  for (let step = 1; step <= 5; step++) assert.equal(Object.keys(booking.validateBookingStep(form(), step)).length, 0);
  const incomplete = { ...form(), diagnosticsDetails: { ...diagnostics.EMPTY_DIAGNOSTICS_DETAILS } };
  for (const field of ['helpNeeded','startedWhen','occursWhen','drivingStatus','warningLights']) {
    assert.ok(booking.validateBookingStep(incomplete, 1)[`diagnosticsDetails.${field}`]);
  }
  const known = { ...form(), diagnosticsDetails: { ...validDetails, helpNeeded: 'known_repair', startedWhen: '', occursWhen: '' } };
  assert.equal(Object.keys(booking.validateBookingStep(known, 1)).length, 0);
  const unsure = { ...form(), diagnosticsDetails: { ...validDetails, helpNeeded: 'unsure', startedWhen: 'Not sure', occursWhen: 'Not sure', drivingStatus: 'unsure', warningLights: 'unsure' } };
  assert.equal(Object.keys(booking.validateBookingStep(unsure, 1)).length, 0);
  assert.ok(booking.validateBookingStep({ ...form(), requestDetails: 'short' }, 1).requestDetails);
  assert.ok(booking.validateBookingStep({ ...form(), consent: false }, 5).consent);
  assert.ok(booking.validateBookingStep({ ...form(), bookingTermsAccepted: false }, 5).bookingTermsAccepted);
});

test('warnings need details only when present, optional kilometres are valid, hidden answers are stripped', () => {
  assert.ok(diagnostics.validateDiagnosticsDetails({ ...validDetails, warningLights: 'yes' }).warningDetails);
  assert.ok(!diagnostics.validateDiagnosticsDetails({ ...validDetails, warningLights: 'yes', warningDetails: 'Check engine' }).warningDetails);
  for (const value of ['-1','12.5','text','10000000']) assert.ok(diagnostics.validateDiagnosticsDetails({ ...validDetails, odometerKm: value }).odometerKm);
  for (const value of ['', '0', '123456']) assert.ok(!diagnostics.validateDiagnosticsDetails({ ...validDetails, odometerKm: value }).odometerKm);
  const clean = diagnostics.sanitiseDiagnosticsDetails({ ...validDetails, helpNeeded: 'known_repair', warningDetails: 'Hidden light', unexpected: 'drop' });
  assert.equal(clean.startedWhen, ''); assert.equal(clean.occursWhen, ''); assert.equal(clean.warningDetails, '');
  assert.equal(clean.unexpected, undefined);
  const summary = diagnostics.diagnosticsSummary({ ...validDetails, previousDiagnosis: 'P0300, cylinder misfire', odometerKm: '123456' });
  assert.ok(summary.some(item => item.value === 'P0300, cylinder misfire'));
  assert.ok(summary.some(item => item.value === '123,456 km'));
});

test('all calendar days 2026 through 2035 use the correct diagnostics weekday and deposit', () => {
  for (let year = 2026; year <= 2035; year++) for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= date.daysInIsoMonth(year, month); day++) {
      const iso = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const eligible = [1,2,3,4,5].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());
      assert.equal(booking.isEligibleBookingDate('diagnostics', iso), eligible, iso);
    }
  }
  assert.equal(booking.depositAmountForBookingType('diagnostics'), 10000);
  assert.equal(booking.depositAmountForBookingType('service'), 10000);
  assert.equal(booking.depositAmountForBookingType('dyno'), 30000);
  assert.equal(booking.depositAmountForBookingType(''), null);
  assert.equal(booking.isEligibleBookingDate('unexpected', '2026-10-26'), false);
});

test('drafts retain diagnostics for that booking type and require fresh acknowledgements', async () => {
  const store = new Map();
  const drafts = await load('mobile/src/lib/booking-draft.ts', {
    '@/lib/booking': booking, '@/lib/diagnostics': diagnostics,
    '@/lib/review-environment': { environmentStorageKey: value => value },
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      setItem: async (key,value) => store.set(key,value), getItem: async key => store.get(key), removeItem: async key => store.delete(key),
    } },
  });
  await drafts.saveBookingDraft('diagnostics', form());
  const restored = await drafts.loadBookingDraft('diagnostics');
  assert.equal(restored.form.diagnosticsDetails.occursWhen, 'When starting cold');
  assert.equal(restored.form.consent, false); assert.equal(restored.form.bookingTermsAccepted, false);
  assert.equal(restored.form.serviceReminderConsent, false);
  assert.equal(await drafts.loadBookingDraft('service'), null);
});

async function paymentFixture({ type = 'diagnostics', amount = 10000, state = 'date_approved', method = 'stripe', existing = null, missing = false } = {}) {
  const writes = []; const stripeRequests = []; const filters = [];
  const requestBooking = { id: '00000000-0000-4000-8000-000000000001', customer_id: 'customer-example', booking_type: type,
    state, deposit_amount_cents: amount, currency: 'AUD', approved_date: '2026-10-26' };
  const admin = { from(table) {
    const query = { select() {return this;}, eq(key,value) { filters.push([table,key,value]); return this; }, in() { return this; },
      maybeSingle: async () => ({ data: table === 'booking_requests' ? missing ? null : requestBooking : existing }),
      insert: async payload => { writes.push({ table, payload }); return {}; }, update(payload) { writes.push({ table,payload }); return this; },
      then(resolve) { resolve({}); },
    }; return query;
  } };
  let handler;
  await load('supabase/functions/create-booking-payment/index.ts', {
    'jsr:@supabase/functions-js/edge-runtime.d.ts': {},
    'npm:@supabase/supabase-js@2': { createClient: (_url,key) => key === 'anon-fixture' ? { auth: { getUser: async () => ({ data: { user: { id: 'customer-example', email: 'example@example.com' } } }) } } : admin },
  }, {
    Deno: { serve: value => { handler=value; }, env: { get: key => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-fixture', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only',
      STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_LIVE_MODE: 'false', PSI_PAYMENT_RETURN_ORIGIN: 'https://example.com',
      PSI_BANK_TRANSFER_ACCOUNT_NAME: 'Example', PSI_BANK_TRANSFER_BSB: '000000', PSI_BANK_TRANSFER_ACCOUNT_NUMBER: '00000000',
    })[key] } },
    Request, Response, URLSearchParams, crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000002' },
    fetch: async (url,init) => { stripeRequests.push({ url, params: init.body }); return Response.json({ id: 'cs_fixture', url: 'https://checkout.stripe.com/fixture', expires_at: Math.floor(Date.now()/1000)+86400 }); },
  });
  const response = await handler(new Request('https://example.com/payment', { method: 'POST', headers: { Authorization: 'Bearer fixture-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: requestBooking.id, paymentMethod: method }) }));
  return { status: response.status, body: await response.json(), writes, stripeRequests, filters };
}

test('Stripe and bank deposit setup use AUD 100 for diagnostics and preserve ownership and approval guards', async () => {
  for (const method of ['stripe','bank_transfer']) {
    const result = await paymentFixture({ method });
    assert.equal(result.status, 201); assert.equal(result.body.amountCents, 10000); assert.equal(result.body.currency, 'AUD');
    assert.ok(result.filters.some(([table,key,value]) => table === 'booking_requests' && key === 'customer_id' && value === 'customer-example'));
    assert.equal(result.writes[0].payload.amount_cents, 10000);
    if (method === 'stripe') {
      assert.equal(result.stripeRequests[0].params.get('line_items[0][price_data][unit_amount]'), '10000');
      assert.equal(result.stripeRequests[0].params.get('line_items[0][price_data][product_data][name]'), 'PSI Diagnostics & Repairs deposit');
    } else { assert.equal(result.body.state, 'bank_transfer_pending'); assert.equal(result.stripeRequests.length, 0); }
  }
  for (const options of [{ amount: 30000 },{ state: 'pending_staff_review' },{ type: 'unexpected' }]) {
    const rejected = await paymentFixture(options); assert.equal(rejected.status,409); assert.equal(rejected.writes.length,0); assert.equal(rejected.stripeRequests.length,0);
  }
  assert.equal((await paymentFixture({ missing: true })).status,404);
  assert.equal((await paymentFixture({ type: 'service' })).body.amountCents,10000);
  assert.equal((await paymentFixture({ type: 'dyno', amount: 30000 })).body.amountCents,30000);
});

test('repeated checkout reuses a live payment attempt without a second charge setup', async () => {
  const result = await paymentFixture({ existing: { payment_method: 'stripe', amount_cents: 10000, provider_checkout_url: 'https://checkout.stripe.com/existing', expires_at: new Date(Date.now()+60000).toISOString(), state: 'awaiting_payment' } });
  assert.equal(result.status,200); assert.equal(result.writes.length,0); assert.equal(result.stripeRequests.length,0);
  assert.equal(result.body.checkoutUrl,'https://checkout.stripe.com/existing');
});

test('authenticated diagnostics submission keeps the owned vehicle, structured answers and request-only state', async () => {
  const writes = []; const lookups = []; let missingVehicle = false;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'customer-example', email: 'example@example.com' } } }) },
    from(table) {
      return {
        select() { return this; }, eq(key,value) { lookups.push([table,key,value]); return this; }, is() { return this; },
        maybeSingle: async () => ({ data: table === 'customer_profiles'
          ? { account_state: 'active', first_name: 'Example', last_name: 'Customer', mobile: '0400000000' }
          : missingVehicle ? null : { year: 2020, make: 'Example', model: 'Coupe', registration: 'QA001' } }),
        insert(payload) { writes.push(payload); return this; },
        single: async () => ({ data: { id: '00000000-0000-4000-8000-000000000003' } }),
      };
    },
  };
  const api = await load('mobile/src/lib/booking.ts', { ...bookingImports,
    '@/lib/supabase': { getSupabaseClient: () => client, SUPABASE_CONNECTION: { bookingEnabled: true } },
    '@/lib/booking-integrations': { dispatchBookingIntegrationNotifications: async () => {} },
    '@/lib/notifications': { dispatchBookingPushNotifications: async () => {} },
  });
  const result = await api.createBookingRequest({ ...form(), serviceReminderConsent: true, serviceSelections: ['scheduled_service'] }, '00000000-0000-4000-8000-000000000004', 'owned-vehicle-example');
  assert.equal(result.state, 'pending_staff_review'); assert.equal(result.paymentRequiredNow, false);
  assert.equal(writes[0].booking_type, 'diagnostics'); assert.equal(writes[0].customer_id, 'customer-example');
  assert.equal(writes[0].vehicle_id, 'owned-vehicle-example'); assert.equal(writes[0].state, 'pending_staff_review');
  assert.equal(writes[0].request_context.diagnosticsDetails.occursWhen, 'When starting cold');
  assert.equal(writes[0].request_context.serviceReminderConsent, false);
  assert.equal(writes[0].request_context.serviceSelections.length, 0);
  assert.equal(writes[0].request_context.tuningDetails, undefined);
  assert.equal(writes[0].deposit_amount_cents, undefined);
  assert.ok(lookups.some(([table,key,value]) => table === 'customer_vehicles' && key === 'customer_id' && value === 'customer-example'));
  missingVehicle = true;
  await assert.rejects(api.createBookingRequest(form(), '00000000-0000-4000-8000-000000000005', 'another-vehicle'), /not available in your private PSI account/);
  assert.equal(writes.length, 1);
});

test('server migration keeps verified-payment confirmation, immutable ownership, workshop attribution and service-only reminder boundaries', async () => {
  const migration = await read('supabase/migrations/20261021053449_diagnostics_repairs_bookings.sql');
  assert.match(migration, /when 'diagnostics' then 10000/);
  assert.match(migration, /expected_amount is null/);
  assert.match(migration, /p_amount_cents <> expected_amount/);
  assert.match(migration, /booking\.state <> 'date_approved'/);
  assert.match(migration, /Customer booking request details and ownership are immutable/);
  assert.match(migration, /on conflict \(provider, provider_event_id\) do nothing/);
  assert.match(migration, /when 'diagnostics' then 'Diagnostics & Repairs · '/);
  assert.doesNotMatch(migration, /(?:delete from|truncate|disable trigger|disable row level security)/i);
  const reminders = await read('supabase/migrations/20260911090000_service_due_reminders.sql');
  assert.match(reminders, /booking\.booking_type = 'service'/);
  for (const screen of ['index','bookings']) {
    const source = await read(`mobile/src/app/(tabs)/${screen}.tsx`);
    assert.match(source, /label="Diagnostics & Repairs"/); assert.match(source, /openBooking\('diagnostics'\)/);
  }
});
