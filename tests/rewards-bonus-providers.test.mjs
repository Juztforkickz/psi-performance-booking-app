import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyRewardsPaidEvent, rewardsProviderEvent, reconcileRewardsPaidSnapshot } from '../supabase/functions/_shared/rewards-paid-periods.ts';
import { rewardsPaymentFacts, rewardsPaymentReader } from '../supabase/functions/_shared/rewards-payments.ts';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const customer=id(1), product='fixture.monthly', start='2026-10-01T00:00:00Z', end='2026-11-01T00:00:00Z';
const products={appStore:[product,'fixture.annual'],playStore:['fixture:monthly','fixture:annual']};
const event=()=>({id:'event-fixture',type:'RENEWAL',app_user_id:customer,original_app_user_id:customer,environment:'PRODUCTION',
 store:'APP_STORE',product_id:product,transaction_id:'tx-1',original_transaction_id:'original-1',period_type:'NORMAL',
 purchased_at_ms:Date.parse(start),expiration_at_ms:Date.parse(end),event_timestamp_ms:Date.parse(start),
 is_family_share:false,price_in_purchased_currency:10,currency:'AUD',entitlement_ids:['performance_plus']});
const subscriber=()=>({original_app_user_id:customer,subscriptions:{[product]:{store:'app_store',is_sandbox:false,ownership_type:'PURCHASED',
 purchase_date:start,expires_date:end,store_transaction_id:'tx-1',original_transaction_id:'original-1'}}});
test('verified server purchase and cancellation within its paid term retain the same paid period',()=>{
  for(const cancelled of [false,true]){const sub=subscriber();if(cancelled)sub.subscriptions[product].unsubscribe_detected_at=start;
    const result=verifyRewardsPaidEvent(event(),sub,customer,products);assert.equal(result.state,'verified');assert.equal(Date.parse(result.period.ends_at),Date.parse(end));}
});
test('Apple and Google paid monthly or annual products use the configured store allowlist',()=>{
  for(const [store,rc,ids] of [['app_store','APP_STORE',products.appStore],['play_store','PLAY_STORE',products.playStore]])for(const product_id of ids){
    const e={...event(),store:rc,product_id},sub={original_app_user_id:customer,subscriptions:{[product_id]:{...subscriber().subscriptions[product],store}}};
    assert.equal(verifyRewardsPaidEvent(e,sub,customer,products).state,'verified');}
});
test('trial, free, historical import, zero price, sandbox and family sharing cannot create paid proof',()=>{
  for(const override of [{period_type:'TRIAL'},{price_in_purchased_currency:0},{price_in_purchased_currency:-1},{environment:'SANDBOX'},
    {is_family_share:true},{product_id:'historical_import'},{entitlement_ids:['historical_import']},{type:'BILLING_ISSUE'},
    {type:'SUBSCRIPTION_EXTENDED'},{type:'CANCELLATION'}])assert.notEqual(verifyRewardsPaidEvent({...event(),...override},subscriber(),customer,products).state,'verified');
});
test('wrong owner, unknown store, unverified intervals and refunded purchases fail closed',()=>{
  for(const change of [s=>{s.original_app_user_id=id(2);},s=>{s.subscriptions[product].ownership_type='FAMILY_SHARED';},
    s=>{s.subscriptions[product].is_sandbox=true;},s=>{s.subscriptions[product].store_transaction_id='another';},
    s=>{s.subscriptions[product].refunded_at=start;}]){const s=subscriber();change(s);assert.notEqual(verifyRewardsPaidEvent(event(),s,customer,products).state,'verified');}
});
test('older provider event requires verified original transaction lineage and never fabricates dates',()=>{
  const s=subscriber();s.subscriptions[product].purchase_date=end;s.subscriptions[product].expires_date='2026-12-01T00:00:00Z';s.subscriptions[product].store_transaction_id='tx-2';
  const lineage=[{store:'app_store',product_id:product,original_transaction_id:'original-1'}];
  assert.equal(verifyRewardsPaidEvent(event(),s,customer,products,Date.now(),lineage).state,'verified');
  assert.equal(verifyRewardsPaidEvent(event(),s,customer,products).state,'pending');
});
test('event persistence strips subscriber attributes, credentials and customer controlled flags',()=>{
  const safe=rewardsProviderEvent({...event(),subscriber_attributes:{email:'private@example.invalid'},multiplier:999,secret:'never'});
  assert.equal(safe.multiplier,undefined);assert.equal(safe.subscriber_attributes,undefined);assert.equal(safe.secret,undefined);
  assert.throws(()=>rewardsProviderEvent({...event(),id:null}));
});
test('sync retries pending evidence and records prospective refunds, without point writes',async()=>{
  const calls=[];const s=subscriber();s.subscriptions[product].refunded_at='2026-10-02T00:00:00Z';
  const admin={rpc:async(name,args)=>{calls.push({name,args});return{name,data:name==='rewards_pending_provider_events'?[{id:id(9),event:event()}]:null,error:null};}};
  await reconcileRewardsPaidSnapshot(admin,s,customer,products);
  assert.equal(calls[2].args.p_state,'excluded');assert.equal(calls[3].name,'record_rewards_paid_revocations');
  assert.ok(calls.every(call=>!call.name.includes('apply_rewards')));
});
test('refund reversal requires fresh provider restoration, no second charge or invented price',()=>{
  const e={...event(),type:'REFUND_REVERSED'};delete e.price_in_purchased_currency;delete e.currency;
  assert.equal(verifyRewardsPaidEvent(e,subscriber(),customer,products).restore,true);
  const pending=subscriber();pending.subscriptions[product].refunded_at=start;
  assert.equal(verifyRewardsPaidEvent(e,pending,customer,products).state,'pending');
});
const invoice=()=>({InvoiceID:id(10),Contact:{ContactID:id(2)},Status:'PAID',Payments:[{PaymentID:id(20),Amount:900}],Prepayments:[{PrepaymentID:id(21),AppliedAmount:100}]});
const read=async(kind,key)=>kind==='Payments'?{PaymentID:key,Status:'AUTHORISED',Amount:900,Date:'/Date(1792454400000+0000)/',Invoice:{InvoiceID:id(10)}}
  :{PrepaymentID:key,Status:'AUTHORISED',Type:'RECEIVE-PREPAYMENT',Contact:{ContactID:id(2)},CurrencyCode:'AUD',Total:100,Date:'2026-09-01',Allocations:[{Invoice:{InvoiceID:id(10)},Amount:100,Date:'2026-10-20'}]};
test('deposits retain original receipt date, current allocation date cannot grant double points',async()=>{
  const facts=await rewardsPaymentFacts(invoice(),read);const advance=facts.find(f=>f.source_kind==='prepayment');
  assert.equal(advance.accounting_date,'2026-09-01');assert.equal(advance.amount_cents,10000);assert.equal(advance.date_precision,'date');
  assert.equal(facts.reduce((sum,f)=>sum+f.amount_cents,0),100000);
});
test('wrong invoice, wrong contact, reused receipt and overallocated deposits are rejected',async()=>{
  for(const change of [v=>{v.Payments.push(v.Payments[0]);},v=>{v.InvoiceID=id(99);},v=>{v.Contact.ContactID=id(99);},v=>{v.Prepayments[0].AppliedAmount=200;}]){
    const v=invoice();change(v);await assert.rejects(rewardsPaymentFacts(v,read));}
  await assert.rejects(rewardsPaymentFacts(invoice(),async(kind,key)=>{const r=await read(kind,key);if(kind==='Prepayments')r.Total=90;return r;}));
});
test('part paid, voided and cancelled invoices generate no paid contributions',async()=>{
  for(const Status of ['AUTHORISED','VOIDED','DELETED'])assert.deepEqual(await rewardsPaymentFacts({...invoice(),Status},()=>assert.fail('must not fetch')),[]);
});
test('payment adapter is GET only, rejects injected paths and omits provider body on failure',async()=>{
  const calls=[];const reader=rewardsPaymentReader('fixture-token',id(99),async(url,options)=>{calls.push({url,options});return Response.json({Payments:[{PaymentID:id(20)}]});});
  await reader('Payments',id(20));assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.method,undefined);
  await assert.rejects(reader('../Contacts',id(20)));await assert.rejects(reader('Payments','bad'));
  const failed=rewardsPaymentReader('fixture-token',id(99),async()=>new Response('secret-provider-data',{status:401}));
  await assert.rejects(failed('Payments',id(20)),error=>!error.message.includes('secret-provider-data'));
});
