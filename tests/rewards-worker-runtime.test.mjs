import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { rewardsInvoiceSnapshot } from '../supabase/functions/_shared/rewards-policy.ts';
import { rewardsPaymentFacts } from '../supabase/functions/_shared/rewards-payments.ts';
const require=createRequire(new URL('../mobile/package.json',import.meta.url)),ts=require('typescript');
const compile=async p=>ts.transpileModule(await readFile(new URL(p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const source=await compile('../supabase/functions/process-rewards-invoices/index.ts'),accessSource=await compile('../supabase/functions/_shared/rewards-xero.ts');
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture({enabled=true,active=true,migration=true,auth=true,pending=null,paymentFailure=false,providerFailure=false,contact=true}={}){
  let handler;const calls=[],updates=[];
  const invoice={InvoiceID:id(1),Contact:contact?{ContactID:id(2)}:{},Type:'ACCREC',Status:'PAID',CurrencyCode:'AUD',Total:1000,AmountDue:0,AmountPaid:1000,AmountCredited:0,
    FullyPaidOnDate:'2026-10-20',UpdatedDateUTC:'2026-10-20T10:00:00Z',Payments:[{PaymentID:id(3),Amount:1000}]};
  const client={rpc:async(name,args)=>{calls.push({name,args});return{data:name==='verify_service_reminder_cron_token'?auth:
    name==='rewards_bonus_runtime_config'?{implemented:migration,has_activated:active}:name==='rewards_provider_retry_customers'?(providerFailure?[id(4)]:[]):
    name==='claim_rewards_invoices'?[{tenant_id:id(9),invoice_id:id(1),revision:1,lease_token:id(8),attempts:1}]:name==='apply_rewards_invoice_v2'?{pending}:null,error:null};},
    from(table){const q={select(){return q;},eq(){return q;},single:async()=>({data:{enabled,starts_on:'2026-10-01',tenant_id:id(9)}}),
      update(value){updates.push(value);return q;},then(resolve){resolve({data:[{invoice_id:id(1)}],error:null});}};return q;}};
  const env={SUPABASE_SERVICE_ROLE_KEY:'fixture-service',SUPABASE_URL:'https://example.invalid'};
  vm.runInNewContext(source,{exports:{},Deno:{serve:h=>{handler=h;}},Request,Response,Date,
    require:name=>name.includes('supabase-js')?{createClient:()=>client}:name.endsWith('xero-runtime.ts')?{cors:{},env:n=>env[n]??'',json:(b,s=200)=>Response.json(b,{status:s}),uuid:v=>typeof v==='string'&&/^[a-f0-9-]{36}$/u.test(v)}:
    name.endsWith('rewards-xero.ts')?{rewardsXeroAccess:async()=>{calls.push({access:true});return'fixture';}}:
    name.endsWith('xero-invoice-fetch.ts')?{xeroInvoiceReader:()=>({invoice:async()=>invoice})}:
    name.endsWith('rewards-policy.ts')?{rewardsInvoiceSnapshot}:name.endsWith('performance-subscription.ts')?{syncSubscription:async()=>{if(providerFailure)throw new Error('offline');}}:
    {rewardsPaymentFacts,rewardsPaymentReader:()=>async()=>{if(paymentFailure)throw new Error('rewards_payment_fetch_retry');return{PaymentID:id(3),Status:'AUTHORISED',Amount:1000,Date:'2026-10-20',Invoice:{InvoiceID:id(1)}};}}});
  return{calls,updates,run:(token='fixture-service',body={})=>handler(new Request('https://example.invalid/process-rewards-invoices',{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json'},body:JSON.stringify(body)}))};
}
test('financial worker rejects anonymous and customer invocation, never trusting supplied multiplier',async()=>{
  const f=fixture({auth:false});assert.equal((await f.run('',{multiplier:999})).status,401);assert.equal((await f.run('customer',{cronToken:'wrong',multiplier:999})).status,403);
  assert.equal(f.calls.some(c=>c.name==='apply_rewards_invoice_v2'),false);
});
test('disabled standard Rewards and missing migration cannot start a partial financial worker',async()=>{
  const disabled=fixture({enabled:false});assert.equal((await disabled.run()).status,200);assert.equal(disabled.calls.length,0);
  const missing=fixture({migration:false});assert.equal((await missing.run()).status,503);assert.equal(missing.calls.some(c=>c.access),false);
});
test('worker passes verified original Xero payment facts, never a caller calculated award',async()=>{
  const f=fixture();assert.equal((await f.run('fixture-service',{multiplier:999,customerId:id(99),points:999999})).status,200);
  const applied=f.calls.find(c=>c.name==='apply_rewards_invoice_v2').args;
  assert.equal(applied.p_contact_id,id(2));assert.equal(applied.p_eligible_cents,100000);assert.equal(applied.p_facts[0].accounting_date,'2026-10-20');
  assert.equal(applied.p_multiplier,undefined);assert.equal(applied.p_earned_points,undefined);assert.equal(applied.p_bonus_points,undefined);
  assert.equal(f.updates.at(-1).processed_revision,1);
});
test('missing payment facts and date boundary review retain standard commit and bounded bonus retry',async()=>{
  for(const options of [{paymentFailure:true,pending:'rewards_payment_fetch_retry'},{pending:'rewards_date_boundary_review'}]){
    const f=fixture(options),result=await(await f.run()).json();assert.equal(result.results[0].status,'held');
    assert.equal(f.updates.at(-1).last_error,options.pending);assert.equal(f.updates.at(-1).processed_revision,undefined);
  }
});
test('unverified customer is held without guessing an identity or awarding points',async()=>{
  const f=fixture({contact:false}),result=await(await f.run()).json();assert.equal(result.results[0].error,'verified_rewards_customer_required');
  assert.equal(f.calls.some(c=>c.name==='apply_rewards_invoice_v2'),false);
});
test('provider retry outage is deferred without blocking ordinary Rewards invoice processing',async()=>{
  const f=fixture({providerFailure:true});await f.run();assert.ok(f.calls.some(c=>c.name==='defer_rewards_provider_events'));
  assert.ok(f.calls.some(c=>c.name==='apply_rewards_invoice_v2'));
});
function xeroAccess({busy=0,error=false,commitError=false}={}){
  const calls=[];let attempts=0;
  const admin={rpc:async(name)=>{calls.push(name);return name==='claim_xero_refresh'?(error?{error:{message:'permission denied'}}:attempts++<busy?{error:{message:'xero_refresh_busy'}}:
    {data:{lock_token:id(1),revision:1,sealed_tokens:'fixture-sealed'},error:null}):{error:commitError&&name==='commit_xero_refresh'?{message:'conflict'}:null};}};
  const api={};vm.runInNewContext(accessSource,{exports:api,setTimeout:fn=>fn(),Date,require:name=>name.endsWith('xero-runtime.ts')?{env:n=>n==='XERO_TENANT_ID'?id(9):'fixture',uuid:v=>v===id(1)}:
    name.endsWith('xero-token-crypto.ts')?{openXeroTokens:async()=>({refresh_token:'fixture'}),sealXeroTokens:async()=> 'fixture-sealed'}:
    {parseXeroTokenSet:v=>v,requestXeroTokenRefresh:async()=>({access_token:'fixture-access',refresh_token:'fixture-refreshed'})}});
  return{calls,run:()=>api.rewardsXeroAccess(admin,id(9))};
}
test('Xero token contention retries briefly, commits once and releases a failed refresh',async()=>{
  const retry=xeroAccess({busy:2});assert.equal(await retry.run(),'fixture-access');assert.equal(retry.calls.filter(c=>c==='claim_xero_refresh').length,3);assert.equal(retry.calls.filter(c=>c==='commit_xero_refresh').length,1);
  const busy=xeroAccess({busy:99});await assert.rejects(busy.run(),/xero_refresh_busy/);assert.equal(busy.calls.length,5);
  const denied=xeroAccess({error:true});await assert.rejects(denied.run(),/xero_refresh_claim_failed/);assert.equal(denied.calls.length,1);
  const failed=xeroAccess({commitError:true});await assert.rejects(failed.run(),/xero_refresh_conflict/);assert.equal(failed.calls.at(-1),'release_xero_refresh');
});
