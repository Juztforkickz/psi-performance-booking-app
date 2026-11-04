import assert from 'node:assert/strict';
import test from 'node:test';
import { rewardsQueueRecoverySql } from '../operations/rewards/recover-queue.mjs';
const { PGlite } = await import(process.env.PSI_PGLITE_MODULE ?? '@electric-sql/pglite');
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenantId=id(99),occurredAt='2026-11-04T03:37:00.000Z';
const row=(n,overrides={})=>({tenant_id:tenantId,invoice_id:id(n),revision:2,processed_revision:0,attempts:30,last_error:'rewards_sync_retry_required',...overrides});
const sql=jobs=>rewardsQueueRecoverySql({tenantId,occurredAt,jobs,priorityInvoiceId:id(1)});

test('recovery refuses guessed, duplicate, settled and nonrecoverable jobs',()=>{
 for(const jobs of [[],[row(1),row(1)],[row(1,{tenant_id:id(98)})],[row(1,{processed_revision:2})],
  [row(1,{last_error:'verified_rewards_customer_required'})],[row(1,{invoice_id:"unsafe'"})]]) assert.throws(()=>sql(jobs));
});

test('queue recovery is audited, excludes changed or leased rows, and is idempotent after later failure',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create table rewards_invoice_queue(tenant_id uuid,invoice_id uuid,revision bigint,processed_revision bigint,attempts int,
   last_error text,available_at timestamptz default now(),lease_until timestamptz,lease_token uuid,primary key(tenant_id,invoice_id));
   create table audit_events(id bigint generated always as identity,table_name text,record_id uuid,customer_id uuid,action text,
   actor_user_id uuid,actor_kind text,occurred_at timestamptz);`);
  const expected=[row(1),row(2,{last_error:'xero_rate_limited_retry_later'}),row(3),row(4),row(5)];
  for(const r of [...expected,row(6,{last_error:'verified_rewards_customer_required'})]){
   await db.query('insert into rewards_invoice_queue(tenant_id,invoice_id,revision,processed_revision,attempts,last_error) values($1,$2,$3,$4,$5,$6)',Object.values(r));
  }
  await db.query("update rewards_invoice_queue set lease_until=now()+interval '5 minutes',lease_token=$1 where invoice_id=$2",[id(88),id(3)]);
  await db.query('update rewards_invoice_queue set revision=3 where invoice_id=$1',[id(4)]);
  await db.query('update rewards_invoice_queue set processed_revision=revision where invoice_id=$1',[id(5)]);
  const statement=sql(expected),result=(await db.query(statement)).rows[0].recovery;
  assert.equal(result.recovered,2);assert.equal(result.audited,2);
  assert.deepEqual(result.jobs.map(j=>j.invoice_id),[id(1),id(2)]);
  assert.equal(result.jobs[0].revision,2);assert.equal(result.jobs[0].processed_revision,0);assert.equal(result.jobs[0].attempts,0);
  assert(new Date(result.jobs[0].available_at)<new Date(result.jobs[1].available_at));
  await db.query('update rewards_invoice_queue set attempts=30,last_error=$1 where invoice_id=$2',['rewards_sync_retry_required',id(1)]);
  assert.equal((await db.query(statement)).rows[0].recovery.recovered,0);
  assert.equal(Number((await db.query('select count(*) n from audit_events')).rows[0].n),2);
  assert.equal((await db.query('select attempts from rewards_invoice_queue where invoice_id=$1',[id(6)])).rows[0].attempts,30);
 } finally {await db.close();}
});
