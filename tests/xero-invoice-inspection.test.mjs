import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { xeroDescriptionRegistration } from '../supabase/functions/_shared/xero-invoice-registration.ts';

const require = createRequire(import.meta.url);
const ts = require('../mobile/node_modules/typescript');
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function inspectionHost({ invoiceChanges = {}, status = 'needs_review', changedDuringInspection = false, authenticated = true } = {}) {
  const queued = { id: id(1), status, identifiers: { tenantId: id(2), invoiceId: id(3), descriptionRegistration: 'OLD1' } };
  const updates = [];
  let reads = 0;
  let handler;
  const invoice = { InvoiceID: id(3), Type: 'ACCREC', Status: 'AUTHORISED', CurrencyCode: 'AUD', SentToContact: true,
    InvoiceNumber: 'INV-1646', DateString: '2026-09-28', Total: 100, Reference: 'VZ SERVICE / REPAIRS',
    Contact: { ContactID: id(4), Name: 'Fixture Customer' }, LineItems: [{ Description: 'REGISTRATION: TEST42' }], ...invoiceChanges };
  const admin = {
    from(table) {
      assert.equal(table, 'vault_import_queue', 'Inspection must not touch published records');
      let values;
      const filters = [];
      const builder = {
        select() { return builder; },
        eq(key, value) { filters.push(row => row[key] === value); return builder; },
        in(key, values) { filters.push(row => values.includes(row[key])); return builder; },
        update(value) { values = value; return builder; },
        async maybeSingle() {
          const row = { ...queued, source: 'xero' };
          if (values && changedDuringInspection) row.status = 'matched';
          if (!filters.every(filter => filter(row))) return { data: null };
          if (values) { updates.push(values); return { data: { id: queued.id } }; }
          return { data: queued };
        },
      };
      return builder;
    },
  };
  const modules = {
    'jsr:@supabase/functions-js/edge-runtime.d.ts': {},
    'npm:@supabase/supabase-js@2.112.3': { createClient: () => authenticated ? admin : { auth: { getUser: async () => ({ data: {} }) } } },
    '../_shared/xero-token-crypto.ts': {},
    '../_shared/xero-token-refresh.ts': {},
    '../_shared/xero-invoice-dedupe.ts': {},
    '../_shared/xero-invoice-match.ts': {},
    '../_shared/xero-invoice-registration.ts': { xeroDescriptionRegistration },
    '../_shared/xero-invoice-fetch.ts': { xeroInvoiceReader: () => ({ invoice: async requested => { assert.equal(requested, id(3)); reads++; return invoice; } }) },
  };
  const output = ts.transpileModule(readFileSync(new URL('../supabase/functions/process-xero-imports/index.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, Response, Request, URL, Date, setTimeout,
    require: name => { assert(name in modules, `Unexpected dependency ${name}`); return modules[name]; },
    Deno: { env: { get: name => ({ SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', SUPABASE_ANON_KEY: 'fixture-public' })[name] }, serve: callback => { handler = callback; } },
  };
  vm.runInNewContext(output + '\nrefreshedAccess = async () => ({ accessToken: "fixture-token" }); exports.inspectInvoice = inspectInvoice;', context);
  return { inspect: () => context.exports.inspectInvoice(admin, id(1)), updates, reads: () => reads, handler };
}

test('fresh inspection stores labelled vehicle evidence without matching or publishing', async () => {
  const host = inspectionHost();
  const result = await host.inspect();
  assert.equal(result.identifiers.descriptionRegistration, 'TEST42');
  assert.equal(result.identifiers.invoiceNumber, 'INV-1646');
  assert.equal(result.identifiers.invoiceDate, '2026-09-28');
  assert.equal(host.reads(), 1);
  assert.deepEqual(Object.keys(host.updates[0]), ['identifiers']);
});

test('fresh inspection clears stale evidence when Xero no longer has a labelled registration', async () => {
  const host = inspectionHost({ invoiceChanges: { LineItems: [{ Description: 'VZ repairs' }] } });
  assert.equal((await host.inspect()).identifiers.descriptionRegistration, null);
});

test('inspection rejects supplier bills, drafts, unsent invoices and foreign currencies without queue updates', async () => {
  for (const invoiceChanges of [{ Type: 'ACCPAY' }, { Status: 'DRAFT' }, { SentToContact: false }, { CurrencyCode: 'NZD' }]) {
    const host = inspectionHost({ invoiceChanges });
    await assert.rejects(host.inspect(), /xero_invoice_details_required/);
    assert.equal(host.updates.length, 0);
  }
});

test('inspection rejects an invoice which moved stages before or during the Xero fetch', async () => {
  const imported = inspectionHost({ status: 'imported' });
  await assert.rejects(imported.inspect(), /xero_import_not_reviewable/);
  assert.equal(imported.reads(), 0);
  const changed = inspectionHost({ changedDuringInspection: true });
  await assert.rejects(changed.inspect(), /xero_import_not_reviewable/);
  assert.equal(changed.updates.length, 0);
});

test('the new inspection endpoint rejects unauthenticated callers before reading Xero', async () => {
  const host = inspectionHost({ authenticated: false });
  const result = await host.handler(new Request('https://fixture.invalid', { method: 'POST',
    headers: { Authorization: 'Bearer unknown', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'inspect_invoice', queueId: id(1) }) }));
  assert.equal(result.status, 403);
  assert.equal(host.reads(), 0);
  assert.equal(host.updates.length, 0);
});
