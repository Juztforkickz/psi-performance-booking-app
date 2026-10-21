import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PSI_PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant = 'e0ed54cc-662b-4e45-9fdd-7de6b2d333cf';
await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema private; create schema auth; create schema cron; create schema vault; create schema net;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated;
 create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
 create table customer_profiles(user_id uuid primary key,account_state text);
 create table private.xero_customer_links(tenant_id uuid,contact_id uuid,customer_id uuid,verified_by uuid,verified_at timestamptz,primary key(tenant_id,contact_id));
 create table vault.decrypted_secrets(name text,decrypted_secret text);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
 insert into customer_profiles values('${id(1)}','active'),('${id(2)}','active');
 insert into private.xero_customer_links values('${tenant}','${id(11)}','${id(1)}','${id(99)}',now()),('${tenant}','${id(12)}','${id(2)}','${id(99)}',now());`);
await db.exec(await readFile(new URL('../migrations/20261021232804_psi_rewards_ledger.sql', import.meta.url), 'utf8'));
await db.exec("update rewards_config set enabled=true, starts_on=current_date-1");
const apply = async (invoice, version, points, redeemed=0, contact=11) => (await db.query(`select apply_rewards_invoice_snapshot($1,$2,$3,$4,$5,current_date,$6,$7,$8) as result`,
  [tenant,id(invoice),id(contact),`INV-FIXTURE-${invoice}`,`2026-10-22T${String(version).padStart(2,'0')}:00:00Z`,points*100,points,redeemed])).rows[0].result;
const balance = async (customer=1) => Number((await db.query('select points_balance from rewards_accounts where customer_id=$1',[id(customer)])).rows[0]?.points_balance ?? 0);

test('one paid invoice awards points exactly once, including duplicate deliveries', async () => {
  await apply(101,1,1000); assert.equal(await balance(),1000);
  await apply(101,1,1000); await apply(101,2,1000); assert.equal(await balance(),1000);
  assert.equal((await db.query('select count(*)::int as n from rewards_ledger where invoice_id=$1',[id(101)])).rows[0].n,1);
});
test('out of order invoice snapshots never restore stale higher points', async () => {
  await apply(102,2,1000); await apply(102,3,900); const expected=await balance();
  assert.equal((await apply(102,1,1200)).stale,true); assert.equal(await balance(),expected);
});
test('refund reversals preserve the full ledger and can produce an honest negative balance', async () => {
  await apply(103,1,1000); const before=await balance();
  await apply(104,1,0,before); assert.equal(await balance(),0);
  await apply(103,2,0); assert.equal(await balance(),-1000);
  await apply(104,2,0,0); assert.equal(await balance(),before-1000);
});
test('credit cannot be funded by points earned on that same invoice', async () => {
  const before=await balance();
  await assert.rejects(apply(105,1,100000,before+1),/rewards_credit_exceeds_balance/);
  assert.equal(await balance(),before);
  assert.equal((await db.query('select count(*)::int n from rewards_invoice_states where invoice_id=$1',[id(105)])).rows[0].n,0);
});
test('voided credit use restores points once', async () => {
  const before=await balance(); await apply(106,1,0,500); assert.equal(await balance(),before-500);
  await apply(106,2,0,0); await apply(106,2,0,0); assert.equal(await balance(),before);
});
test('invoice ownership cannot be reassigned through a refreshed contact link', async () => {
  await apply(107,1,200); const before=await balance();
  await assert.rejects(apply(107,2,200,0,12),/rewards_invoice_identity_changed/);
  assert.equal(await balance(),before); assert.equal(await balance(2),0);
});
test('an unverified customer link never awards points', async () => {
  await assert.rejects(apply(108,1,500,0,88),/verified_rewards_customer_required/);
});
test('all financial writes and Wallet secrets are denied to customers and anonymous users', async () => {
  const rows=(await db.query(`select has_function_privilege('anon','apply_rewards_invoice_snapshot(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,bigint)','execute') as anon,
   has_function_privilege('authenticated','apply_rewards_invoice_snapshot(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,bigint)','execute') as customer,
   has_table_privilege('authenticated','rewards_accounts','update') as balance_write,
   has_table_privilege('authenticated','rewards_wallet_members','select') as wallet_secrets,
   has_table_privilege('authenticated','rewards_invoice_queue','select') as queue_read`)).rows;
  assert.deepEqual(rows,[{anon:false,customer:false,balance_write:false,wallet_secrets:false,queue_read:false}]);
});
test('row security shows only the signed-in customer’s own balance and history', async () => {
  await apply(109,1,300,0,12);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(2)}',false);`);
  const accounts=(await db.query('select customer_id from rewards_accounts')).rows;
  const ledger=(await db.query('select distinct customer_id from rewards_ledger')).rows;
  assert.deepEqual(accounts,[{customer_id:id(2)}]); assert.deepEqual(ledger,[{customer_id:id(2)}]);
  await assert.rejects(db.exec('update rewards_accounts set points_balance=999999'),/permission denied/);
  await db.exec('reset role');
});
test('replayed Xero events retain a new revision received during a processing lease', async () => {
  const event=JSON.stringify([{tenantId:tenant,invoiceId:id(110)}]);
  await db.query('select enqueue_rewards_invoices($1)',[event]);
  const claim=(await db.query('select * from claim_rewards_invoices(1)')).rows[0];
  await db.query('select enqueue_rewards_invoices($1)',[event]);
  await db.query('update rewards_invoice_queue set processed_revision=$1,lease_token=null,lease_until=null where invoice_id=$2 and lease_token=$3',[claim.revision,claim.invoice_id,claim.lease_token]);
  const next=(await db.query('select * from claim_rewards_invoices(1)')).rows[0];
  assert.equal(Number(next.revision),2); assert.equal(Number(next.processed_revision),1);
});
