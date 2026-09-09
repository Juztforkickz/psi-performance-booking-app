import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const source = await readFile(new URL('../mobile/src/lib/customer-account.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function accountHarness({ review = false, failures = {}, payments = [] } = {}) {
  const user = { id: 'fixture-customer', email: 'customer@example.invalid' };
  const queries = [];
  const environment = { enabled: review };
  const supabase = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({ data: { session: {} }, error: null }),
    },
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      const chain = {
        select() { return chain; },
        eq(column, value) { query.filters.push([column, value]); return chain; },
        is() { return chain; },
        in() { return chain; },
        order() { return chain; },
        maybeSingle() { return chain; },
        then(resolve, reject) {
          const error = failures[table] ?? null;
          const data = table === 'customer_profiles' ? { user_id: user.id }
            : table === 'customer_vehicles' ? [{ id: 'fixture-vehicle', customer_id: user.id }]
              : table === 'booking_payment_attempts' ? payments : [];
          return Promise.resolve({ data: error ? null : data, error, status: error ? 404 : 200 }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(specifier) {
      if (specifier === '@/lib/supabase') return { getSupabaseClient: () => supabase };
      if (specifier === '@/lib/review-environment') return { REVIEW_ENVIRONMENT: environment };
      throw new Error(`Unexpected runtime import: ${specifier}`);
    },
  });
  return { load: exports.loadCustomerAccount, queries, environment };
}

test('review accounts load real sandbox profile and vehicles without requesting the absent payment table', async () => {
  const app = accountHarness({ review: true, failures: { booking_payment_attempts: { code: 'PGRST205' } } });
  const result = await app.load();
  assert.equal(result.profile.user_id, 'fixture-customer');
  assert.equal(result.vehicles[0].id, 'fixture-vehicle');
  assert.equal(result.paymentAttempts.length, 0);
  assert.equal(app.queries.length, 6);
  assert.equal(app.queries.some(query => query.table === 'booking_payment_attempts'), false);
});

test('live mode reads payment attempts scoped to the verified customer', async () => {
  const app = accountHarness({ payments: [{ id: 'existing-attempt', state: 'paid' }] });
  const result = await app.load();
  assert.equal(result.paymentAttempts[0].id, 'existing-attempt');
  const paymentQuery = app.queries.find(query => query.table === 'booking_payment_attempts');
  assert.deepEqual(paymentQuery.filters, [['customer_id', 'fixture-customer']]);
});

test('live payment-table errors still fail the account load instead of being silently hidden', async () => {
  const failure = { code: 'PGRST205', message: 'Payment table unavailable' };
  const app = accountHarness({ failures: { booking_payment_attempts: failure } });
  await assert.rejects(app.load(), error => error === failure);
});

test('review mode does not swallow errors from protected customer records', async () => {
  const failure = { code: '42501', message: 'Permission denied' };
  const app = accountHarness({ review: true, failures: { vehicle_files: failure } });
  await assert.rejects(app.load(), error => error === failure);
});

test('switching back from review to live restores the live payment query', async () => {
  const app = accountHarness({ review: true, payments: [{ id: 'live-attempt' }] });
  assert.equal((await app.load()).paymentAttempts.length, 0);
  app.environment.enabled = false;
  assert.equal((await app.load()).paymentAttempts[0].id, 'live-attempt');
  assert.equal(app.queries.filter(query => query.table === 'booking_payment_attempts').length, 1);
});
