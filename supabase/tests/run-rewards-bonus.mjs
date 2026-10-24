import test from 'node:test';
import { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PSI_PGLITE_MODULE ?? '@electric-sql/pglite');
const db = new PGlite();
after(() => db.close());
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant = id(999), day = 86400000;
const clock = Date.now(), today = new Date(clock).toISOString().slice(0,10);
const past = n => new Date(Date.now()-n*day).toISOString();
const receiptDate = n => past(n).slice(0,10);
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema private; create schema auth; create schema cron; create schema vault; create schema net;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to authenticated;
create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
create table customer_profiles(user_id uuid primary key,account_state text);
create table private.xero_customer_links(tenant_id uuid,contact_id uuid,customer_id uuid,verified_by uuid,verified_at timestamptz,primary key(tenant_id,contact_id));
create table performance_subscriptions(id uuid primary key default gen_random_uuid(),customer_id uuid,provider text,provider_reference text,
 environment text default 'production',status text,expires_at timestamptz,is_permanent boolean default false,verified_at timestamptz default now());
create table vault.decrypted_secrets(name text,decrypted_secret text);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
grant select on public.customer_profiles,public.performance_subscriptions,private.xero_customer_links to service_role;`);
await db.exec(await readFile(new URL('../migrations/20261021232804_psi_rewards_ledger.sql',import.meta.url),'utf8'));
await db.query('update rewards_config set enabled=true,starts_on=$1,tenant_id=$2',[receiptDate(30),tenant]);
await db.exec(await readFile(new URL('../migrations/20261023120145_rewards_earning_status_wallet_refresh.sql',import.meta.url),'utf8'));
const migration = await readFile(new URL('../migrations/20261023234403_rewards_verified_paid_bonus.sql',import.meta.url),'utf8');
await db.exec(migration);
await db.exec(migration); // Same migration replay is safe before and after data.
let sequence=1;
const customer = async (permanent=false) => {
  const n=sequence++, customer=id(n), contact=id(100+n);
  await db.query('insert into customer_profiles values($1,$2)',[customer,'active']);
  await db.query('insert into private.xero_customer_links values($1,$2,$3,$4,now())',[tenant,contact,customer,id(990)]);
  if(permanent) await db.query("insert into performance_subscriptions(customer_id,provider,provider_reference,status,is_permanent) values($1,'complimentary',$2,'active',true)",[customer,`permanent:${customer}`]);
  return {customer,contact,n};
};
const period = async (c,start=past(8),end=past(-2)) => {
  const event=id(1000+sequence++);
  await db.query("insert into private.performance_rewards_events(id,provider_event_id,customer_id,event_at,source_sha256,verification_state,verified_at) values($1,$2,$3,now(),$4,'verified',now())",[event,event,c.customer,'a'.repeat(64)]);
  return (await db.query(`insert into private.performance_paid_periods(customer_id,source_event_id,store,product_id,transaction_id,environment,ownership_type,
 period_type,starts_at,ends_at,paid_amount,paid_currency,verified_at,evidence_sha256) values($1,$2,'app_store','psi_performance_plus_monthly',$2::uuid::text,'production','PURCHASED','NORMAL',$3,$4,10,'AUD',now(),$5) returning id`,[c.customer,event,start,end,'b'.repeat(64)])).rows[0].id;
};
const fact = (key,cents=100000,date=receiptDate(3),extra={}) => ({ source_kind:'payment',source_id:id(key),original_receipt_id:`payment:${id(key)}`,
 allocation_id:id(key+10000),amount_cents:cents,capacity_cents:cents,accounting_date:date,date_precision:'date',occurred_at:null,...extra });
const apply = async (c,key=200,cents=100000,facts=[fact(key,cents)],version=1,redeem=0,error=null) =>
  (await db.query('select apply_rewards_invoice_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result',
    [tenant,id(key+10000),c.contact,`INV-FICTIONAL-${key}`,new Date(clock-day+version*1000).toISOString(),today,cents,redeem,JSON.stringify(facts),error])).rows[0].result;
const balance=async c => Number((await db.query('select points_balance from rewards_accounts where customer_id=$1',[c.customer])).rows[0]?.points_balance ?? 0);
const enable=()=>db.query(`update private.rewards_bonus_policy set enabled=true,activated_at=$1,approved_at=now(),approval_reference='isolated approved test fixture',policy_sha256=$2`,[past(10),'c'.repeat(64)]);

test('installation is disabled, stable replay preserves standard earning',async()=>{
  assert.equal((await db.query('select enabled from private.rewards_bonus_policy')).rows[0].enabled,false);
  const c=await customer();await period(c);const a=await apply(c,201,100000,[fact(201)]);
  assert.equal(a.standard_points,1000);assert.equal(a.bonus_points,0);assert.equal(await balance(c),1000);
  await db.exec(migration);assert.equal(await balance(c),1000);await enable();
});
test('free, trial and permanent accounts keep standard rewards and credit',async()=>{
  const free=await customer(),trial=await customer(),permanent=await customer(true);
  await db.query("insert into performance_subscriptions(customer_id,provider,provider_reference,status,expires_at) values($1,'complimentary',$2,'active',now()+interval '14 days')",[trial.customer,`trial:${trial.customer}`]);
  await period(permanent);
  for(const [i,c] of [free,trial,permanent].entries()){const a=await apply(c,210+i,100000,[fact(210+i)]);assert.equal(a.bonus_points,0);assert.equal(await balance(c),1000);}
});
test('verified paid period earns double once, webhook replay and version bump do not duplicate',async()=>{
  const c=await customer();await period(c);const a=await apply(c,220,100000,[fact(220)]);assert.equal(a.bonus_points,1000);assert.equal(await balance(c),2000);
  const same=await apply(c,220,100000,[fact(220)]);assert.equal(same.changed,false);
  await apply(c,220,100000,[fact(220)],2);assert.equal(await balance(c),2000);
  assert.equal(Number((await db.query('select count(*) n from rewards_bonus_ledger where customer_id=$1',[c.customer])).rows[0].n),1);
});
test('each instalment original date determines bonus, fully paid invoice trigger unchanged',async()=>{
  const c=await customer();await period(c);
  const facts=[fact(230,10000,receiptDate(12)),fact(231,90000,receiptDate(3),{allocation_id:id(10230)})];
  const a=await apply(c,230,100000,facts);assert.equal(a.standard_points,1000);assert.equal(a.bonus_points,900);assert.equal(await balance(c),1900);
});
test('expiry and cancelled renewal preserve prior points; renewal restores new payment bonus',async()=>{
  const c=await customer();await period(c,past(12),past(5));
  assert.equal((await apply(c,240,100000,[fact(240,100000,receiptDate(7))])).bonus_points,1000);
  assert.equal((await apply(c,241,100000,[fact(241,100000,receiptDate(3))])).bonus_points,0);
  const before=await balance(c);await period(c,past(2),past(-30));assert.equal(await balance(c),before);
  const renewal=await apply(c,242,100000,[fact(242,100000,receiptDate(0))]);
  assert.equal(renewal.bonus_points,1000);
});
test('billing grace cannot extend earning past settled paid interval',async()=>{
  const c=await customer();await period(c,past(12),past(5));
  await db.query("insert into performance_subscriptions(customer_id,provider,status,expires_at) values($1,'revenuecat','grace_period',now()+interval '3 days')",[c.customer]);
  assert.equal((await apply(c,250,100000,[fact(250)])).bonus_points,0);
});
test('date only boundary is held, precise evidence and adjacent interval union qualify',async()=>{
  const c=await customer();const date=receiptDate(3);await period(c,`${date}T01:00:00Z`,past(-2));
  const boundary=await apply(c,260,100000,[fact(260,100000,date)]);assert.equal(boundary.bonus_points,0);assert.equal(boundary.pending,'rewards_date_boundary_review');
  const precise=fact(261,100000,date,{date_precision:'timestamp',occurred_at:`${date}T04:00:00Z`});
  assert.equal((await apply(c,261,100000,[precise])).bonus_points,1000);
  await period(c,`${date}T00:00:00+11:00`,`${date}T01:00:00Z`);
  assert.equal((await apply(c,262,100000,[fact(262,100000,date)])).bonus_points,1000);
});
test('unallocated workshop refunds proportionately reverse original bonus and preserve ledger',async()=>{
  const c=await customer();await period(c);
  const facts=[fact(270,50000,receiptDate(12)),fact(271,50000,receiptDate(3),{allocation_id:id(10270)})];
  await apply(c,270,100000,facts);assert.equal(await balance(c),1500);
  const refunded=await apply(c,270,50000,facts,2);assert.equal(refunded.bonus_points,250);assert.equal(await balance(c),750);
  await apply(c,270,0,[],3);assert.equal(await balance(c),0);
  assert.equal(Number((await db.query('select count(*) n from rewards_bonus_ledger where customer_id=$1',[c.customer])).rows[0].n),3);
});
test('refund after spending can produce negative balance; own invoice cannot fund redemption',async()=>{
  const c=await customer();await period(c);await apply(c,280,100000,[fact(280)]);
  await apply(c,281,0,[],1,2000);assert.equal(await balance(c),0);
  await apply(c,280,0,[],2);assert.equal(await balance(c),-2000);
  const fresh=await customer();await period(fresh);await assert.rejects(apply(fresh,282,100000,[fact(282)],1,1),/rewards_credit_exceeds_balance/);assert.equal(await balance(fresh),0);
});
test('late verification adds one bonus on unchanged Xero version, expiry does not remove it',async()=>{
  const c=await customer();await apply(c,290,100000,[fact(290)]);assert.equal(await balance(c),1000);
  await period(c);await apply(c,290,100000,[fact(290)]);assert.equal(await balance(c),2000);
  await apply(c,290,100000,[fact(290)]);assert.equal(await balance(c),2000);
});
test('stale invoices, same version contradictions and customer reassignment cannot change balance',async()=>{
  const c=await customer(),other=await customer();await period(c);await apply(c,300,100000,[fact(300)],2);
  assert.equal((await apply(c,300,200000,[fact(300,200000)],1)).stale,true);
  await assert.rejects(apply(c,300,90000,[fact(300,90000)],2),/rewards_version_conflict/);
  await assert.rejects(apply(other,300,100000,[fact(300)],3),/rewards_invoice_identity_changed/);assert.equal(await balance(c),2000);
});
test('missing payment evidence awards standard, preserves legitimate old bonus, clears after retry',async()=>{
  const c=await customer();await period(c);await apply(c,310,100000,[fact(310)]);
  const held=await apply(c,310,100000,[],1,0,'rewards_payment_fetch_retry');assert.equal(held.bonus_points,1000);assert.equal(await balance(c),2000);
  await apply(c,310,100000,[fact(310)]);assert.equal(await balance(c),2000);
});
test('duplicate receipts and cross invoice allocation over capacity never award duplicate bonus',async()=>{
  const c=await customer();await period(c);const f=fact(320);
  await assert.rejects(apply(c,320,100000,[f,f]),/rewards_payment_facts_review/);
  await apply(c,320,100000,[f]);
  const reused={...f,allocation_id:id(10321)};const held=await apply(c,321,100000,[reused]);assert.equal(held.bonus_points,0);assert.equal(held.pending,'rewards_receipt_capacity_review');
});
test('membership refund revokes prospectively and retains legitimate earlier spending',async()=>{
  const c=await customer();await period(c);await apply(c,330,100000,[fact(330,100000,receiptDate(6))]);
  await db.query('select record_rewards_paid_revocations($1,$2)',[c.customer,JSON.stringify([{product_id:'psi_performance_plus_monthly',store:'app_store',effective_at:past(5),reason:'refunded'}])]);
  await apply(c,330,100000,[fact(330,100000,receiptDate(6))]);assert.equal(await balance(c),2000);
  assert.equal((await apply(c,331,100000,[fact(331)])).bonus_points,0);
});
test('failed bonus ledger write rolls back base, facts, bonus and balance atomically',async()=>{
  const c=await customer();await period(c);
  await db.exec("create function private.fixture_fail() returns trigger language plpgsql as $$begin raise exception 'fixture_failure'; end$$; create trigger fixture_fail before insert on rewards_bonus_ledger for each row execute function private.fixture_fail()");
  await assert.rejects(apply(c,340,100000,[fact(340)]),/fixture_failure/);
  assert.equal(await balance(c),0);assert.equal(Number((await db.query('select count(*) n from rewards_invoice_states where customer_id=$1',[c.customer])).rows[0].n),0);
  await db.exec('drop trigger fixture_fail on rewards_bonus_ledger');await apply(c,340,100000,[fact(340)]);assert.equal(await balance(c),2000);
});
test('customers cannot award, change policy or read another bonus history',async()=>{
  const c=await customer();await period(c);await apply(c,350,100000,[fact(350)]);
  const rows=(await db.query("select has_function_privilege('authenticated','apply_rewards_invoice_v2(uuid,uuid,uuid,text,timestamptz,date,bigint,bigint,jsonb,text)','execute') award,has_table_privilege('authenticated','private.rewards_bonus_policy','update') policy,has_function_privilege('anon','record_rewards_paid_evidence(uuid,uuid,text,jsonb,text)','execute') proof")).rows[0];
  assert.deepEqual(rows,{award:false,policy:false,proof:false});
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${c.customer}',false)`);
  assert.deepEqual((await db.query('select distinct customer_id from rewards_bonus_ledger')).rows,[{customer_id:c.customer}]);
  await assert.rejects(db.exec('update rewards_accounts set points_balance=999999'),/permission denied/);await db.exec('reset role');
});
test('legacy worker is fenced, reporting reconciles standard plus bonus minus credit with balances',async()=>{
  await assert.rejects(db.query('select apply_rewards_invoice_snapshot($1,$2,$3,$4,now(),current_date,0,0,0)',[tenant,id(50000),id(101),'FICTIONAL']),/rewards_v2_worker_required/);
  const report=(await db.query('select rewards_bonus_financial_report() r')).rows[0].r;
  assert.equal(Number(report.standardNetPoints)+Number(report.bonusIssuedPoints)-Number(report.bonusReversedPoints)-Number(report.creditUsedNetPoints),Number(report.combinedBalancePoints));
});
test('migration replay preserves balances, memberships, financial ledgers and activation',async()=>{
  const before=(await db.query('select sum(points_balance)::text balance,(select count(*) from rewards_ledger)::text base,(select count(*) from rewards_bonus_ledger)::text bonus from rewards_accounts')).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query('select sum(points_balance)::text balance,(select count(*) from rewards_ledger)::text base,(select count(*) from rewards_bonus_ledger)::text bonus from rewards_accounts')).rows,before);
});

test('authenticated provider inbox verifies paid evidence once and rejects changed event payload',async()=>{
  const c=await customer();const event={id:'fixture-paid-event',app_user_id:c.customer,type:'RENEWAL',store:'APP_STORE',environment:'PRODUCTION',
    product_id:'psi_performance_plus_monthly',transaction_id:'fixture-transaction',original_transaction_id:'fixture-original',entitlement_ids:['performance_plus'],
    event_timestamp_ms:Date.now()-day, purchased_at_ms:Date.now()-5*day,expiration_at_ms:Date.now()+20*day,price_in_purchased_currency:10,currency:'AUD'};
  const p={store:'app_store',product_id:event.product_id,transaction_id:event.transaction_id,original_transaction_id:event.original_transaction_id,
    starts_at:new Date(event.purchased_at_ms).toISOString(),ends_at:new Date(event.expiration_at_ms).toISOString(),period_type:'NORMAL',paid_amount:10,paid_currency:'AUD'};
  await db.exec('set role service_role');
  await db.query('select ingest_rewards_provider_event($1,$2)',[c.customer,JSON.stringify(event)]);
  await db.query('select ingest_rewards_provider_event($1,$2)',[c.customer,JSON.stringify(event)]);
  await assert.rejects(db.query('select ingest_rewards_provider_event($1,$2)',[c.customer,JSON.stringify({...event,price_in_purchased_currency:20})]),/rewards_provider_event_conflict/);
  const e=(await db.query('select * from rewards_pending_provider_events($1)',[c.customer])).rows[0];
  await db.query('select record_rewards_paid_evidence($1,$2,$3,$4,null)',[c.customer,e.id,'verified',JSON.stringify(p)]);
  await db.query('select record_rewards_paid_evidence($1,$2,$3,$4,null)',[c.customer,e.id,'verified',JSON.stringify(p)]);
  const count=Number((await db.query('select count(*) n from private.performance_paid_periods where customer_id=$1',[c.customer])).rows[0].n);
  assert.equal(count,1);assert.equal(await balance(c),0);await db.exec('reset role');
});
test('cent allocation remains exact and deterministic across 100 varied instalment and refund totals',async()=>{
  for(let n=1;n<=100;n++){
    const amounts=[n*37+1,n*17+2,n*3+3],total=amounts.reduce((a,b)=>a+b,0),eligible=Math.floor(total*((n%9)+1)/10);
    const facts=amounts.map((amount,i)=>fact(400+i,amount));
    const a=(await db.query('select * from private.rewards_allocated_receipts($1,$2)',[JSON.stringify(facts),eligible])).rows;
    const b=(await db.query('select * from private.rewards_allocated_receipts($1,$2)',[JSON.stringify(facts.toReversed()),eligible])).rows;
    assert.equal(a.reduce((sum,r)=>sum+Number(r.eligible_cents),0),eligible);
    assert.deepEqual(a,b);for(const value of a)assert.ok(Number(value.eligible_cents)<=value.fact.amount_cents);
  }
});
test('history pagination includes bonus adjustments, has no duplicate or missing rows and filters owner',async()=>{
  const c=await customer();await period(c);
  for(let n=0;n<17;n++)await apply(c,500+n,1000,[fact(500+n,1000)]);
  const all=[];let at=null,key=null;
  for(let n=0;n<10;n++){
    const page=(await db.query('select rewards_history_page($1,$2,$3,7) p',[c.customer,at,key])).rows[0].p;
    all.push(...page.entries);if(!page.hasMore)break;at=page.cursor.at;key=page.cursor.id;
  }
  assert.equal(all.length,34);assert.equal(new Set(all.map(r=>r.id)).size,34);
  assert.equal(all.filter(r=>r.kind==='bonus_earned').length,17);
  assert.deepEqual((await db.query('select rewards_history_page($1) p',[id(8888)])).rows[0].p.entries,[]);
});
test('Melbourne accounting date respects 23 and 25 hour daylight saving days',async()=>{
  const rows=(await db.query(`select extract(epoch from (('2026-10-05'::date::timestamp at time zone 'Australia/Melbourne')-
    ('2026-10-04'::date::timestamp at time zone 'Australia/Melbourne')))/3600 spring,
    extract(epoch from (('2026-04-06'::date::timestamp at time zone 'Australia/Melbourne')-
    ('2026-04-05'::date::timestamp at time zone 'Australia/Melbourne')))/3600 autumn`)).rows[0];
  assert.equal(Number(rows.spring),23);assert.equal(Number(rows.autumn),25);
});
test('subscription transfer stops future bonus without deleting previous earned credit',async()=>{
  const c=await customer();await period(c);await apply(c,550,100000,[fact(550,100000,receiptDate(6))]);
  await db.query('select record_rewards_identity_review($1,$2,$3)',[c.customer,'fixture-transfer',past(5)]);
  await apply(c,550,100000,[fact(550,100000,receiptDate(6))]);assert.equal(await balance(c),2000);
  assert.equal((await apply(c,551,100000,[fact(551)])).bonus_points,0);
});
test('preexisting opening credit is preserved and measured separately from new issued rewards',async()=>{
  const c=await customer();await db.query('insert into rewards_accounts(customer_id,points_balance) values($1,1234)',[c.customer]);
  await db.exec(migration);assert.equal(await balance(c),1234);
  await period(c);await apply(c,560,100000,[fact(560)]);assert.equal(await balance(c),3234);
  const r=(await db.query('select rewards_bonus_financial_report() r')).rows[0].r;
  assert.equal(Number(r.openingPoints),1234);
  assert.equal(Number(r.openingPoints)+Number(r.standardNetPoints)+Number(r.bonusIssuedPoints)-Number(r.bonusReversedPoints)-Number(r.creditUsedNetPoints),Number(r.combinedBalancePoints));
});
test('anonymous and authenticated roles cannot read private evidence or execute signing/award functions',async()=>{
  const wrong=(await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='private' and c.relkind='r' and c.relname like '%rewards%'
    and (has_table_privilege('anon',c.oid,'select') or has_table_privilege('authenticated',c.oid,'select') or not c.relrowsecurity)`)).rows;
  assert.deepEqual(wrong,[]);
  const grants=(await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname in ('apply_rewards_invoice_v2','record_rewards_paid_evidence','record_rewards_paid_revocations',
      'ingest_rewards_provider_event','rewards_bonus_financial_report','set_rewards_bonus_activation','rewards_paid_lineages','record_rewards_identity_review')
    and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))`)).rows;
  assert.deepEqual(grants,[]);
});
test('provider shortening a paid interval blocks later bonuses without removing earlier legitimate points',async()=>{
  const c=await customer();await period(c);await apply(c,570,100000,[fact(570,100000,receiptDate(6))]);
  await db.query('select record_rewards_paid_revocations($1,$2)',[c.customer,JSON.stringify([{product_id:'psi_performance_plus_monthly',store:'app_store',effective_at:past(5),reason:'period_corrected'}])]);
  await apply(c,570,100000,[fact(570,100000,receiptDate(6))]);assert.equal(await balance(c),2000);
  assert.equal((await apply(c,571,100000,[fact(571)])).bonus_points,0);
});
test('verified membership refund reversal restores future earning and preserves the refunded gap',async()=>{
  const c=await customer();await period(c);const original=(await db.query('select * from private.performance_paid_periods where customer_id=$1',[c.customer])).rows[0];
  await db.query('select record_rewards_paid_revocations($1,$2)',[c.customer,JSON.stringify([{product_id:original.product_id,store:'app_store',effective_at:past(5),reason:'refunded'}])]);
  const event={id:'fixture-refund-reversal',app_user_id:c.customer,type:'REFUND_REVERSED',environment:'PRODUCTION',store:'APP_STORE',product_id:original.product_id,transaction_id:original.transaction_id,event_timestamp_ms:Date.now()-2*day};
  await db.query('select ingest_rewards_provider_event($1,$2)',[c.customer,JSON.stringify(event)]);
  const pending=(await db.query('select * from rewards_pending_provider_events($1)',[c.customer])).rows[0];
  await db.query('select restore_rewards_paid_evidence($1,$2)',[c.customer,pending.id]);
  await db.query('select restore_rewards_paid_evidence($1,$2)',[c.customer,pending.id]);
  assert.equal((await apply(c,580,100000,[fact(580,100000,receiptDate(3))])).bonus_points,0);
  assert.equal((await apply(c,581,100000,[fact(581,100000,receiptDate(0))])).bonus_points,1000);
});
test('activation refuses implicit backdating and schema replay rejects unexpected grants',async()=>{
  await assert.rejects(db.query('select private.set_rewards_bonus_activation($1,$2)',[past(1),'fixture release approval']),/rewards_release_approval_required/);
  await db.exec('grant update on private.rewards_bonus_policy to authenticated');
  await assert.rejects(db.exec(migration),/rewards_bonus_schema_mismatch/);await db.exec('rollback');
  await db.exec('revoke update on private.rewards_bonus_policy from authenticated');
  await db.exec(migration);
});
