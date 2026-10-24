import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { interpretPerformanceEntitlement } from '../supabase/functions/_shared/performance-entitlement.ts';
const require=createRequire(new URL('../mobile/package.json',import.meta.url));
const ts=require('typescript');
const source=ts.transpileModule(await readFile(new URL('../supabase/functions/_shared/performance-subscription.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const id='a1111111-1111-4111-8111-111111111111',product='fixture.monthly';
const future=new Date(Date.now()+86400000).toISOString(),past=new Date(Date.now()-86400000).toISOString();
const subscriber=()=>({original_app_user_id:id,entitlements:{performance_plus:{product_identifier:product,expires_date:future}},subscriptions:{[product]:{store:'app_store',ownership_type:'PURCHASED',is_sandbox:false}}});
function fixture(body=subscriber(),httpStatus=200){
  const writes=[],requests=[];
  const query={select(){return this;},eq(){return this;},async maybeSingle(){return{data:{user_id:id,account_state:'active'},error:null};}};
  const admin={from:()=>query,rpc:async(name,args)=>{writes.push({name,args});return{error:null};}};
  const env={REVENUECAT_SECRET_KEY:'server-fixture-secret',PERFORMANCE_APPLE_PRODUCT_IDS:`${product},fixture.annual`,SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'};
  const api={};vm.runInNewContext(source,{exports:api,Deno:{env:{get:name=>env[name]}},Date,Response,AbortSignal,
    fetch:async(url,options)=>{requests.push({url,options});return Response.json({subscriber:body},{status:httpStatus});},
    require:name=>name.includes('supabase-js')?{createClient:()=>admin}:name.includes('rewards-paid-periods')?{reconcileRewardsPaidSnapshot:async()=>{}}:{interpretPerformanceEntitlement}});
  return{run:()=>api.syncSubscription(id),writes,requests};
}
test('server sync verifies provider truth before recording a renewal or cancellation',async()=>{
  for(const cancelled of [false,true]){
    const body=subscriber();if(cancelled)body.subscriptions[product].unsubscribe_detected_at=past;
    const check=fixture(body);await check.run();assert.equal(check.requests[0].url,`https://api.revenuecat.com/v1/subscribers/${id}`);
    assert.equal(check.writes.length,1);assert.equal(check.writes[0].args.p_customer_id,id);assert.equal(check.writes[0].args.p_status,'active');
    assert.equal(check.writes[0].args.p_auto_renews,!cancelled);
  }
});
test('server sync preserves verified grace and records loss of entitlement',async()=>{
  const grace=subscriber();grace.entitlements.performance_plus.expires_date=past;grace.subscriptions[product].grace_period_expires_date=future;
  const check=fixture(grace);await check.run();assert.equal(check.writes[0].args.p_status,'grace_period');assert.equal(check.writes[0].args.p_expires_at,future);
  const expired=subscriber();expired.entitlements.performance_plus.expires_date=past;
  const end=fixture(expired);await end.run();assert.equal(end.writes[0].args.p_status,'expired');
});
test('provider outage, mismatched owner or sandbox response never writes a grant',async()=>{
  const wrong=subscriber();wrong.original_app_user_id='another-customer';
  const sandbox=subscriber();sandbox.subscriptions[product].is_sandbox=true;
  for(const check of [fixture(subscriber(),503),fixture(wrong),fixture(sandbox)]){
    await assert.rejects(check.run());assert.equal(check.writes.length,0);
  }
});
