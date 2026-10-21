import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const source = readFileSync(new URL('../supabase/functions/process-booking-integrations/index.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source + '\nexport { syncGoogleCalendar };\n', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const bookingId = '00000000-0000-4000-8000-000000000001';
const eventId = 'psi' + bookingId.replaceAll('-', '');
const calendarText = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;').replace(/\r\n?|\n/g, '<br>\n');

function harness({ existing = true } = {}) {
  const requests = [], records = [];
  const values = {
    GOOGLE_CALENDAR_CLIENT_ID: 'fixture-client',
    GOOGLE_CALENDAR_CLIENT_SECRET: 'fixture-secret-not-a-credential',
    GOOGLE_CALENDAR_REFRESH_TOKEN: 'fixture-refresh-not-a-credential',
    PSI_GOOGLE_CALENDAR_ID: 'workshop@example.invalid',
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, URL, URLSearchParams, Response, atob,
    require(id) {
      if (id === '@supabase/functions-js/edge-runtime.d.ts') return {};
      if (id === '@supabase/supabase-js') return { createClient() { throw new Error('No live clients in tests'); } };
      if (id === './account-signup-notifications.ts') return { processAccountSignupNotifications() { throw new Error('No signup/email work in Calendar tests'); } };
      throw new Error('Unexpected dependency: ' + id);
    },
    Deno: { env: { get: name => values[name] }, serve() {} },
    async fetch(url, init = {}) {
      const request = { url: String(url), method: init.method, body: init.body };
      requests.push(request);
      if (String(url) === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'fixture-access-not-a-credential' });
      }
      assert.equal(new URL(url).hostname, 'www.googleapis.com');
      if (init.method === 'GET') return existing ? Response.json({ id: eventId }) : new Response(null, { status: 404 });
      if (init.method === 'DELETE') return new Response(null, { status: 204 });
      assert.ok(['POST', 'PUT'].includes(init.method));
      assert.equal(new URL(url).searchParams.get('sendUpdates'), 'none');
      return Response.json({ id: eventId });
    },
  });
  const admin = { from(table) {
    assert.equal(table, 'booking_calendar_events');
    return { async upsert(row, options) {
      records.push(JSON.parse(JSON.stringify({ row, options })));
      return { error: null };
    } };
  } };
  const context = {
    booking: { id: bookingId, booking_type: 'service', state: 'confirmed', approved_date: '2026-10-27',
      preferred_date: '2026-10-27', request_notes: 'Hesitates under load.\nCustomer suspects a sensor?',
      request_context: { arrivalArrangement: 'business_hours', serviceSelections: ['diagnostics_warning_lights'] } },
    customer: { first_name: 'Example', last_name: 'Customer', email: 'customer@example.invalid', mobile: '0400000000' },
    vehicle: { registration: 'TEST001', year: 2017, make: 'Example', model: 'Sedan' },
    remindersEnabled: false,
  };
  const job = { booking_request_id: bookingId, job_kind: 'sync_google_calendar_confirmed' };
  return { requests, records, context, job, run: () => module.exports.syncGoogleCalendar(admin, job, context),
    writes: () => requests.filter(item => item.method === 'PUT' || (item.method === 'POST' && item.url.includes('/events')))
      .map(item => JSON.parse(item.body)) };
}

for (const bookingType of ['service', 'dyno', 'diagnostics']) {
  test(`${bookingType} Calendar entries retain the complete customer notes, line breaks and visit details`, async () => {
    const h = harness();
    h.context.booking.booking_type = bookingType;
    const notes = '  Customer wording stays unchanged.\n\n' + 'Long symptom detail. '.repeat(200) + '\nTheir guess, not a diagnosis?  ';
    h.context.booking.request_notes = notes;
    await h.run();
    const body = h.writes()[0];
    assert.ok(body.description.includes('Customer booking notes (as supplied):<br>\n' + calendarText(notes)));
    assert.ok(body.description.includes('Arrival: Business Hours'));
    assert.ok(body.description.includes('Requested services: Diagnostics Warning Lights'));
    assert.equal(body.id, eventId);
    assert.equal(body.start.date, '2026-10-27');
    assert.equal(body.end.date, '2026-10-28');
    assert.equal(body.extendedProperties.private.psiBookingRequestId, bookingId);
    assert.deepEqual(body.attendees, []);
    assert.equal(body.visibility, 'default');
    assert.equal(h.records[0].row.sync_state, 'synced');
  });
}

test('customer markup is displayed as literal text rather than active HTML', async () => {
  const h = harness();
  h.context.booking.request_notes = '<img src="https://example.invalid/track">\nVoltage < 10 & sensor > 0. Customer\'s guess.';
  h.context.booking.request_context.diagnosticsDetails = { helpNeeded: 'diagnosis', previousDiagnosis: '<b>P0123</b> & wiring' };
  await h.run();
  const { description } = h.writes()[0];
  assert.ok(description.includes('&lt;img src=&quot;https://example.invalid/track&quot;&gt;<br>\n'));
  assert.ok(description.includes('Voltage &lt; 10 &amp; sensor &gt; 0. Customer&#039;s guess.'));
  assert.ok(description.includes('Previous diagnosis or fault codes: &lt;b&gt;P0123&lt;/b&gt; &amp; wiring'));
  assert.ok(!description.includes('<img'));
  assert.ok(!description.includes('<b>'));
});

for (const notes of [null, '', ' \n ']) {
  test(`absent notes (${JSON.stringify(notes)}) do not add invented symptoms or empty headings`, async () => {
    const h = harness();
    h.context.booking.request_notes = notes;
    h.context.booking.request_context = {};
    await h.run();
    const { description } = h.writes()[0];
    assert.equal(description, 'Customer: Example Customer<br>\nVehicle: 2017 Example Sedan (TEST001)<br>\nMobile: 0400000000');
  });
}

test('repeating a confirmed sync updates the same deterministic event, not a duplicate', async () => {
  const h = harness();
  await h.run(); await h.run();
  const writes = h.requests.filter(item => item.method === 'PUT');
  assert.equal(writes.length, 2);
  assert.equal(writes[0].url, writes[1].url);
  assert.equal(h.requests.filter(item => item.method === 'POST' && item.url.includes('/events')).length, 0);
  assert.equal(h.records.length, 2);
});

test('a missing confirmed event is inserted once with the same notes and identity', async () => {
  const h = harness({ existing: false });
  await h.run();
  assert.equal(h.writes().length, 1);
  assert.equal(h.writes()[0].id, eventId);
  assert.ok(h.writes()[0].description.includes(calendarText(h.context.booking.request_notes)));
});

test('unconfirmed requests never create a Calendar event', async () => {
  const h = harness();
  h.context.booking.state = 'pending_staff_review';
  await assert.rejects(h.run, /booking_not_confirmed/);
  assert.equal(h.writes().length, 0);
  assert.equal(h.records.length, 0);
});

test('booking cancellation still removes the existing event without sending notes or invitations', async () => {
  const h = harness();
  h.job.job_kind = 'sync_google_calendar_cancelled';
  h.context.booking.state = 'cancelled';
  await h.run();
  assert.equal(h.writes().length, 0);
  assert.equal(h.requests.filter(item => item.method === 'DELETE').length, 1);
  assert.equal(h.records[0].row.sync_state, 'removed');
});
