import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const requireMobile = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = requireMobile('typescript');
const source = await readFile(new URL('../mobile/src/lib/account-deletion.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const ownId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const request = (userId, status = 'requested') => ({
  user_id: userId,
  status,
  requested_at: '2026-08-31T01:00:00.000Z',
  completed_at: null,
  staff_note: null,
  updated_at: '2026-08-31T01:00:00.000Z',
});

// Model the broad SELECT visibility an owner has, then apply the adapter's actual
// filters. This catches a missing identity filter rather than assuming RLS will
// hide other customers' requests from an owner account.
function createAdapter(initialRows = [], override) {
  const rows = initialRows.map((row) => ({ ...row }));
  const queries = [];
  const client = {
    from(table) {
      assert.equal(table, 'account_deletion_requests');
      const query = { operation: 'select', filters: [], columns: '*', payload: null };
      const execute = async () => {
        queries.push(query);
        const overridden = await override?.(query);
        if (overridden !== undefined) return overridden;
        let matching;
        if (query.operation === 'insert') {
          matching = [request(query.payload.user_id)];
          rows.push(matching[0]);
        } else {
          matching = rows.filter((row) => query.filters.every(([column, value]) => row[column] === value));
          if (query.operation === 'delete') {
            for (const row of matching) rows.splice(rows.indexOf(row), 1);
          }
        }
        if (matching.length > 1) return { data: null, error: new Error('Multiple deletion requests returned') };
        const row = matching[0];
        return {
          data: row ? query.columns === 'user_id' ? { user_id: row.user_id } : { ...row } : null,
          error: null,
        };
      };
      const builder = {
        select(columns) { query.columns = columns; return builder; },
        eq(column, value) { query.filters.push([column, value]); return builder; },
        delete() { query.operation = 'delete'; return builder; },
        insert(payload) { query.operation = 'insert'; query.payload = payload; return builder; },
        maybeSingle: execute,
        single: execute,
      };
      return builder;
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      assert.equal(name, '@/lib/supabase');
      return { getSupabaseClient: () => client };
    },
  });
  return { ...exports, queries, rows };
}

test('an owner loading personal deletion status never sees another customer request', async () => {
  const adapter = createAdapter([request(otherId)]);
  assert.equal(await adapter.loadOwnAccountDeletionRequest(ownId), null);
  assert.equal(adapter.rows.length, 1);

  adapter.rows.push(request(ownId));
  assert.equal((await adapter.loadOwnAccountDeletionRequest(ownId)).user_id, ownId);
});

test('requesting deletion creates only the signed-in identity request', async () => {
  const adapter = createAdapter([request(otherId)]);
  const created = await adapter.requestOwnAccountDeletion(ownId);
  assert.equal(created.user_id, ownId);
  assert.equal(created.status, 'requested');
  assert.deepEqual(adapter.rows.map((row) => row.user_id), [otherId, ownId]);
  assert.deepEqual(Object.keys(adapter.queries[0].payload), ['user_id']);
});

test('cancelling an owned pending request preserves every other customer request', async () => {
  const adapter = createAdapter([request(ownId), request(otherId)]);
  assert.equal(await adapter.cancelOwnAccountDeletionRequest(ownId), undefined);
  assert.deepEqual(adapter.rows.map((row) => row.user_id), [otherId]);
  assert.deepEqual(adapter.queries.map((query) => query.operation), ['delete']);
});

test('a stale cancellation succeeds when no own request exists and preserves another customer request', async () => {
  const adapter = createAdapter([request(otherId)]);
  assert.equal(await adapter.cancelOwnAccountDeletionRequest(ownId), undefined);
  assert.deepEqual(adapter.rows.map((row) => row.user_id), [otherId]);
  assert.deepEqual(adapter.queries.map((query) => query.operation), ['delete', 'select']);
});

test('a request that has entered review cannot be cancelled', async () => {
  const adapter = createAdapter([request(ownId, 'in_review'), request(otherId)]);
  await assert.rejects(adapter.cancelOwnAccountDeletionRequest(ownId), /still active/);
  assert.equal(adapter.rows.find((row) => row.user_id === ownId).status, 'in_review');
  assert.equal(adapter.rows.length, 2);
});

test('a zero-row deletion does not claim success while an owned pending request remains', async () => {
  const adapter = createAdapter([request(ownId)], (query) => (
    query.operation === 'delete' ? { data: null, error: null } : undefined
  ));
  await assert.rejects(adapter.cancelOwnAccountDeletionRequest(ownId), /still active/);
  assert.equal(adapter.rows[0].status, 'requested');
});

test('a deletion API failure is surfaced without clearing the existing request', async () => {
  const failure = new Error('Connection unavailable');
  const adapter = createAdapter([request(ownId)], () => ({ data: null, error: failure }));
  await assert.rejects(adapter.cancelOwnAccountDeletionRequest(ownId), (error) => error === failure);
  assert.equal(adapter.rows.length, 1);
  assert.equal(adapter.queries.length, 1);
});

test('an unavailable verification read cannot turn a zero-row deletion into success', async () => {
  const failure = new Error('Verification unavailable');
  const adapter = createAdapter([], (query) => {
    if (query.operation === 'select') throw failure;
  });
  await assert.rejects(adapter.cancelOwnAccountDeletionRequest(ownId), (error) => error === failure);
  assert.deepEqual(adapter.queries.map((query) => query.operation), ['delete', 'select']);
});

test('loading rejects an unexpected other-account response even if the service returns it', async () => {
  const adapter = createAdapter([], () => ({ data: request(otherId), error: null }));
  await assert.rejects(adapter.loadOwnAccountDeletionRequest(ownId), /ACCOUNT_DELETION_IDENTITY_MISMATCH/);
});

test('inserting rejects an unexpected other-account response', async () => {
  const adapter = createAdapter([], () => ({ data: request(otherId), error: null }));
  await assert.rejects(adapter.requestOwnAccountDeletion(ownId), /ACCOUNT_DELETION_IDENTITY_MISMATCH/);
});
