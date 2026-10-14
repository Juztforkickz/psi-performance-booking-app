import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PSI_PGLITE_MODULE ?? '@electric-sql/pglite');
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table vault_import_queue(id uuid primary key default gen_random_uuid(),source text,source_key text,status text,identifiers jsonb default '{}',reason text,job_id uuid,record_id uuid,attempt_count int default 0,available_at timestamptz default now(),created_at timestamptz default now(),completed_at timestamptz,last_attempt_at timestamptz,last_error_code text,unique(source,source_key));`);
await db.exec(await readFile(new URL('../migrations/20261014075631_preserve_xero_sync_decisions.sql',import.meta.url),'utf8'));
const event = (n,date='2026-10-14T08:00:00Z') => ({ tenantId:id(1),invoiceId:id(n),eventDateUtc:date,eventType:'UPDATE' });
const enqueue = async e => (await db.query('select enqueue_xero_invoice_events($1) as n',[JSON.stringify([e])])).rows[0].n;
const row = async n => (await db.query('select * from vault_import_queue where source_key=$1',[`${id(1)}:${id(n)}`])).rows[0];
const claim = async n => (await db.query('select * from claim_xero_invoice_sync(1,$1)',[(await row(n)).id])).rows[0];
const finish = async (q,values) => (await db.query('select finish_xero_invoice_sync($1,$2,$3,$4) as ok',[q.id,q.xero_sync_lease,q.xero_sync_revision,JSON.stringify(values)])).rows[0].ok;

test('repeated and older deliveries preserve imported record and saved identifiers', async () => {
  assert.equal(await enqueue(event(2)),1);
  await db.query("update vault_import_queue set status='imported',job_id=$1,record_id=$2,completed_at=now(),identifiers=identifiers||$3::jsonb where source_key=$4",[id(3),id(4),JSON.stringify({partsOnly:true,partsOnlyCustomerId:id(5)}),`${id(1)}:${id(2)}`]);
  assert.equal(await enqueue(event(2)),0);
  assert.equal(await enqueue(event(2,'2026-10-13T08:00:00Z')),0);
  assert.equal(await enqueue(event(2,'2026-10-14T08:01:00Z')),1);
  const q=await row(2); assert.equal(q.status,'imported'); assert.equal(q.record_id,id(4)); assert.equal(q.identifiers.partsOnly,true); assert.ok(q.completed_at);
});
test('one lease owns work; a concurrent new event remains due after completion', async () => {
  const q=await claim(2); assert.equal(q.xero_sync_previous_status,'imported'); assert.equal(await claim(2),undefined);
  await enqueue(event(2,'2026-10-14T08:02:00Z'));
  assert.equal(await finish(q,{status:'imported',identifiers:{...q.identifiers,amountPaidCents:100},last_error_code:null}),true);
  const r=await row(2); assert.equal(r.identifiers.eventDateUtc,'2026-10-14T08:02:00Z'); assert.ok(r.xero_sync_revision>r.xero_sync_processed_revision);
  const next=await claim(2); assert.equal(await finish(next,{status:'imported',last_error_code:null}),true);
  assert.equal(await claim(2),undefined);
});
test('waiting decisions and ignored records survive later deliveries', async () => {
  await enqueue(event(6)); await db.query("update vault_import_queue set status='waiting_for_customer',identifiers=identifiers||$1::jsonb where source_key=$2",[JSON.stringify({waitingConfirmedBy:id(7),verifiedWorkshopVehicleId:id(8)}),`${id(1)}:${id(6)}`]);
  await enqueue(event(6,'2026-10-14T08:03:00Z')); const q=await claim(6); assert.equal(q.status,'waiting_for_customer'); assert.equal(q.identifiers.waitingConfirmedBy,id(7));
  await finish(q,{status:'waiting_for_customer',identifiers:{...q.identifiers,amountDueCents:0},last_error_code:null}); assert.equal((await row(6)).status,'waiting_for_customer');
  await db.query("update vault_import_queue set status='ignored' where id=$1",[q.id]); assert.equal(await enqueue(event(6,'2026-10-14T08:04:00Z')),0); assert.equal(await claim(6),undefined);
});
test('owner action during sync wins over stale completion', async () => {
  await enqueue(event(9)); const q=await claim(9); await db.query("update vault_import_queue set status='waiting_for_customer',reason='Owner decision' where id=$1",[q.id]);
  assert.equal(await finish(q,{status:'imported',reason:'stale'}),false); assert.equal((await row(9)).reason,'Owner decision');
});
test('failed imported refresh retains the record and can retry', async () => {
  await enqueue(event(2,'2026-10-14T08:05:00Z')); const q=await claim(2); await finish(q,{status:'imported',last_error_code:'xero_temporarily_unavailable'});
  const r=await row(2); assert.equal(r.record_id,id(4)); assert.ok(r.xero_sync_revision>r.xero_sync_processed_revision); assert.ok(await claim(2));
});
test('RPC access is restricted to the backend', async () => {
  const { rows }=await db.query("select has_function_privilege('anon','enqueue_xero_invoice_events(jsonb)','execute') as anon,has_function_privilege('authenticated','claim_xero_invoice_sync(integer,uuid)','execute') as customer,has_function_privilege('service_role','finish_xero_invoice_sync(uuid,uuid,bigint,jsonb)','execute') as backend");
  assert.deepEqual(rows,[{anon:false,customer:false,backend:true}]);
});

test('expired lease resumes without allowing the stale worker to finish', async () => {
  await enqueue(event(10)); const stale = await claim(10);
  await db.query("update vault_import_queue set xero_sync_lease_until=now()-interval '1 second' where id=$1",[stale.id]);
  const resumed = await claim(10); assert.ok(resumed); assert.notEqual(resumed.xero_sync_lease,stale.xero_sync_lease);
  assert.equal(await finish(stale,{status:'imported'}),false);
  assert.equal(await finish(resumed,{status:'needs_review',last_error_code:null}),true);
});

test('owner target changes at the same status are never overwritten', async () => {
  await enqueue(event(11));
  await db.query("update vault_import_queue set status='waiting_for_customer',identifiers=identifiers||$1::jsonb where id=$2",[JSON.stringify({verifiedWorkshopVehicleId:id(12)}),(await row(11)).id]);
  const q=await claim(11);
  await db.query("update vault_import_queue set identifiers=identifiers||$1::jsonb where id=$2",[JSON.stringify({verifiedWorkshopVehicleId:id(13)}),q.id]);
  assert.equal(await finish(q,{status:'imported',identifiers:q.identifiers}),false);
  assert.equal((await row(11)).identifiers.verifiedWorkshopVehicleId,id(13));
});

test('first repeated delivery after migration does not revisit a completed legacy row', async () => {
  await db.query("insert into vault_import_queue(source,source_key,status,identifiers,record_id,completed_at) values ('xero',$1,'imported',$2,$3,now())",[`${id(1)}:${id(14)}`,JSON.stringify(event(14)),id(15)]);
  assert.equal(await enqueue(event(14)),0);
  assert.equal(await enqueue(event(14,'2026-10-13T08:00:00Z')),0);
  assert.equal((await row(14)).xero_sync_revision,0);
  assert.equal(await claim(14),undefined);
});
test('background retry dispatches eligible expired work and stays quiet on held or empty queues', async () => {
  await db.exec(`create schema private; create schema vault; create schema net; create schema cron;
    create table vault.decrypted_secrets(name text,decrypted_secret text);
    insert into vault.decrypted_secrets values ('psi_service_reminder_project_url','https://fixture.supabase.co/'),('psi_service_reminder_anon_jwt','fixture-jwt'),('psi_service_reminder_cron_token','fixture-cron');
    create table public.fixture_requests(url text,headers jsonb,body jsonb);
    create function net.http_post(url text,headers jsonb,body jsonb) returns bigint language plpgsql as $$ begin insert into public.fixture_requests values(url,headers,body); return 42; end $$;
    create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;`);
  await db.exec(await readFile(new URL('../migrations/20261014081946_retry_interrupted_xero_invoice_sync.sql',import.meta.url),'utf8'));
  await db.query("update vault_import_queue set status='ignored',xero_sync_lease=null,xero_sync_lease_until=null");
  assert.equal((await db.query('select private.dispatch_xero_invoice_sync() as request')).rows[0].request,null);
  await enqueue(event(16)); const q=await claim(16);
  assert.equal((await db.query('select private.dispatch_xero_invoice_sync() as request')).rows[0].request,null);
  await db.query("update vault_import_queue set xero_sync_lease_until=now()-interval '1 second' where id=$1",[q.id]);
  assert.equal((await db.query('select private.dispatch_xero_invoice_sync() as request')).rows[0].request,42);
  const request=(await db.query('select * from fixture_requests')).rows[0];
  assert.equal(request.url,'https://fixture.supabase.co/functions/v1/process-xero-imports');
  assert.deepEqual(request.body,{action:'process_queue',limit:5,cronToken:'fixture-cron'});
  assert.equal((await db.query("select has_function_privilege('authenticated','private.dispatch_xero_invoice_sync()','execute') as customer")).rows[0].customer,false);
});

test.after(async()=>db.close());


