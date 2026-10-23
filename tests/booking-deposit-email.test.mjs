import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const ts = createRequire(new URL('../mobile/package.json', import.meta.url))('typescript');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const helper = { exports: {} };
vm.runInNewContext(compile(read('../supabase/functions/process-booking-integrations/booking-email-action.ts')), { exports: helper.exports });
const source = read('../supabase/functions/process-booking-integrations/index.ts').replace(/^import .*;\r?\n/gmu, '');
const sandbox = { exports: {}, Deno: { env: { get: () => 'owner@example.invalid' }, serve() {} },
  bookingEmailAction: helper.exports.bookingEmailAction, Intl, Date, URL };
vm.runInNewContext(compile(source + '\nglobalThis.emailFixture = { buildEmail, isJobStillApplicable };'), sandbox);
const { buildEmail, isJobStillApplicable } = sandbox.emailFixture;
const context = type => ({
  booking: { id: '00000000-0000-4000-8000-000000000001', booking_type: type, state: 'date_approved',
    approved_date: '2026-10-28', preferred_date: null, request_notes: 'Check the vehicle', request_context: {} },
  customer: { email: 'customer@example.invalid', first_name: 'Sample', last_name: 'Customer', mobile: '0400000000' },
  vehicle: { registration: 'DEMO01', year: 2020, make: 'Example', model: 'Coupe' }, remindersEnabled: false,
});

test('approved service, diagnostics and dyno emails contain a deposit navigation link in HTML and plain text', () => {
  for (const [type, amount] of [['service', 'A$100'], ['diagnostics', 'A$100'], ['dyno', 'A$300']]) {
    const email = buildEmail({ job_kind: 'notify_customer_date_approved' }, context(type));
    assert.equal(email.recipient, 'customer@example.invalid');
    assert.match(email.html, /href="https:\/\/juztforkickz.github.io\/psi-performance-booking-app\/bookings"/u);
    assert.match(email.html, />Pay booking deposit<\/a>/u);
    assert.ok(email.text.includes('Pay booking deposit: https://juztforkickz.github.io/psi-performance-booking-app/bookings'));
    assert.ok(email.text.includes(amount));
    assert.match(email.text, /Sign in with the email used for this booking/u);
    assert.match(email.text, /confirmed only after payment is verified/u);
    assert.doesNotMatch(email.html + email.text, /checkout\.stripe\.com|access_token|token=/u);
  }
});

test('proposals cannot look like deposit requests and obsolete approval jobs remain inapplicable', () => {
  const proposed = context('service'); proposed.booking.state = 'date_proposed';
  const email = buildEmail({ job_kind: 'notify_customer_date_proposed' }, proposed);
  assert.match(email.html, />View proposed date<\/a>/u);
  assert.match(email.text, /No deposit is requested yet/u);
  assert.doesNotMatch(email.html, />Pay booking deposit<\/a>/u);
  for (const state of ['date_proposed', 'confirmed', 'completed', 'cancelled']) {
    proposed.booking.state = state;
    assert.equal(isJobStillApplicable({ job_kind: 'notify_customer_date_approved' }, proposed), false);
  }
});

test('confirmed and cancelled messages do not request another deposit, and customer HTML stays escaped', () => {
  for (const kind of ['notify_customer_booking_confirmed', 'notify_customer_cancelled', 'notify_psi_request_received']) {
    assert.doesNotMatch(buildEmail({ job_kind: kind }, context('service')).html, />Pay booking deposit<\/a>/u);
  }
  const hostile = context('service'); hostile.customer.first_name = '<script>alert(1)</script>';
  hostile.booking.request_notes = '<a href="https://evil.invalid">Pay here</a>';
  const html = buildEmail({ job_kind: 'notify_customer_date_approved' }, hostile).html;
  assert.doesNotMatch(html, /<script>|href="https:\/\/evil.invalid"/u);
  assert.match(html, /&lt;script&gt;/u);
});
