import assert from 'node:assert/strict';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const recoverable = new Set(['rewards_sync_retry_required', 'xero_rate_limited_retry_later']);

// Generates a bounded operational repair, not an award or worker invocation.
// Inputs must be a saved, reviewed live queue snapshot. Current rows must still
// match it, have no active lease, and have no receipt for this recovery batch.
export function rewardsQueueRecoverySql({ tenantId, occurredAt, jobs, priorityInvoiceId }) {
  assert(uuid.test(tenantId) && uuid.test(priorityInvoiceId));
  const at = new Date(occurredAt).toISOString();
  assert(Array.isArray(jobs) && jobs.length > 0 && jobs.length <= 100);
  const ids = new Set();
  const expected = jobs.map(row => {
    assert.equal(row.tenant_id, tenantId);
    assert(uuid.test(row.invoice_id) && !ids.has(row.invoice_id)); ids.add(row.invoice_id);
    assert(Number.isSafeInteger(row.revision) && Number.isSafeInteger(row.processed_revision));
    assert(row.revision > row.processed_revision && row.processed_revision >= 0);
    assert(Number.isSafeInteger(row.attempts) && row.attempts >= 0);
    assert(recoverable.has(row.last_error));
    return { tenant_id: tenantId, invoice_id: row.invoice_id, revision: row.revision,
      processed_revision: row.processed_revision, attempts: row.attempts, last_error: row.last_error };
  });
  return `with expected as (
    select * from jsonb_to_recordset($recovery$${JSON.stringify(expected)}$recovery$::jsonb)
      as x(tenant_id uuid,invoice_id uuid,revision bigint,processed_revision bigint,attempts integer,last_error text)
  ), candidates as materialized (
    select q.* from public.rewards_invoice_queue q join expected e using(tenant_id,invoice_id)
    where q.revision=e.revision and q.processed_revision=e.processed_revision and q.attempts=e.attempts
      and q.last_error=e.last_error and q.revision>q.processed_revision
      and (q.lease_until is null or q.lease_until<now())
      and not exists(select 1 from public.audit_events a where a.table_name='rewards_invoice_queue'
        and a.record_id=q.invoice_id and a.actor_kind='system' and a.occurred_at='${at}'::timestamptz)
    for update of q skip locked
  ), changed as (
    update public.rewards_invoice_queue q set attempts=0,last_error=null,lease_token=null,lease_until=null,
      available_at=now()+case when q.invoice_id='${priorityInvoiceId}'::uuid then interval '0' else interval '1 second' end
    from candidates c where q.tenant_id=c.tenant_id and q.invoice_id=c.invoice_id
    returning q.*
  ), audited as (
    insert into public.audit_events(table_name,record_id,customer_id,action,actor_user_id,actor_kind,occurred_at)
    select 'rewards_invoice_queue',invoice_id,null,'update',null,'system','${at}'::timestamptz from changed returning id
  ) select jsonb_build_object('occurredAt','${at}','recovered',(select count(*) from changed),
    'audited',(select count(*) from audited),'jobs',(select coalesce(jsonb_agg(to_jsonb(c) order by invoice_id),'[]') from changed c)) recovery;`;
}
