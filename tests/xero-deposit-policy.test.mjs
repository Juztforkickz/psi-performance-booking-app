import test from 'node:test';
import assert from 'node:assert/strict';
import { allowFinancialWrite, cents, requireDepositScopes, selectBookingInvoice, verifyDepositInvoice, verifyStripeDeposit } from '../supabase/functions/_shared/xero-deposit-policy.ts';
const attempt = {id:'attempt',provider_payment_id:'pi_test',booking_request_id:'booking',amount_cents:10000};
const intent = () => ({id:'pi_test',status:'succeeded',livemode:true,currency:'aud',amount_received:10000,
  metadata:{payment_attempt_id:'attempt',booking_request_id:'booking'},latest_charge:{paid:true,disputed:false,amount_refunded:0,amount:10000,currency:'aud',created:1791417600,balance_transaction:{amount:10000,currency:'aud',fee:195,net:9805}}});
test('accepts live confirmed booking payment and actual provider fee',()=>{
  const result=verifyStripeDeposit(intent(),attempt);
  assert.equal(result.fee,195); assert.equal(result.net,9805); assert.match(result.paidDate,/^2026-10-\d\d$/);
});
test('rejects wrong booking, amount, mode and currency',()=>{
  for (const change of [{livemode:false},{currency:'usd'},{amount_received:9999},{metadata:{payment_attempt_id:'other',booking_request_id:'booking'}}]) {
    assert.throws(()=>verifyStripeDeposit({...intent(),...change},attempt));
  }
});
test('refunded or disputed deposits never cause an automatic accounting write',()=>{
  for(const change of [{disputed:true},{amount_refunded:10000}]) {
    const p=intent(); Object.assign(p.latest_charge,change); assert.throws(()=>verifyStripeDeposit(p,attempt));
  }
});
test('fee and net must agree in AUD',()=>{
  const p=intent(); p.latest_charge.balance_transaction.net=10000; assert.throws(()=>verifyStripeDeposit(p,attempt));
});
test('insufficient permissions cannot enable financial writes',()=>{
  assert.throws(()=>requireDepositScopes('offline_access accounting.invoices.read'));
  requireDepositScopes('accounting.payments accounting.banktransactions accounting.settings.read');
});
test('invoice must match contact, currency, approved status and remaining balance',()=>{
  const invoice={Type:'ACCREC',CurrencyCode:'AUD',Contact:{ContactID:'contact'},Status:'AUTHORISED',AmountDue:100};
  verifyDepositInvoice(invoice,'contact',10000);
  for(const change of [{CurrencyCode:'USD'},{Status:'DRAFT'},{AmountDue:0},{Contact:{ContactID:'other'}}]) {
    assert.throws(()=>verifyDepositInvoice({...invoice,...change},'contact',10000));
  }
});
test('uncertain write cannot be repeated even after provider key expires',()=>{
  allowFinancialWrite(undefined);
  assert.throws(()=>allowFinancialWrite({started_at:'2000-01-01'}));
});
test('money rejects missing, negative or nonfinite values',()=>{
  for(const value of [undefined,null,'100',-1,Infinity,NaN]) assert.throws(()=>cents(value));
  assert.equal(cents(1.95),195);
});
const invoiceId='4423c0ca-073f-4e14-a418-307244b271d5';
const context={tenantId:'tenant',jobId:'job',customerId:'customer',vehicleId:'vehicle'};
const link={source:'xero',status:'imported',source_key:`tenant:${invoiceId}`,job_id:'job',record_id:'record'};
const record={id:'record',job_id:'job',customer_id:'customer',vehicle_id:'vehicle',kind:'invoice',published_at:'2026-10-14T00:00:00Z',source:'staff'};
test('reuses the exact Xero identity when duplicate protection kept a workshop PC invoice',()=>{
  assert.equal(selectBookingInvoice([link],record,context),invoiceId);
});
test('unverified, ambiguous or mismatched invoice links cannot receive a deposit',()=>{
  assert.equal(selectBookingInvoice([],null,context),null);
  assert.throws(()=>selectBookingInvoice([link,link],record,context));
  for(const change of [{status:'needs_review'},{source_key:`other:${invoiceId}`},{record_id:'other'},{source_key:`tenant:${invoiceId}:extra`}])
    assert.throws(()=>selectBookingInvoice([{...link,...change}],record,context));
  for(const change of [{customer_id:'other'},{vehicle_id:'other'},{job_id:'other'},{published_at:null},{kind:'photo'}])
    assert.throws(()=>selectBookingInvoice([link],{...record,...change},context));
});
