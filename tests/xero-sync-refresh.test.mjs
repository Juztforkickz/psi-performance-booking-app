import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { matchXeroInvoice } from '../supabase/functions/_shared/xero-invoice-match.ts';
import { xeroDescriptionRegistration, xeroInvoiceMatchesVehicle } from '../supabase/functions/_shared/xero-invoice-registration.ts';
import { xeroInvoiceDate } from '../supabase/functions/_shared/xero-invoice-date.ts';
import { waitingInvoiceRefreshReason, reviewNotificationRequired } from '../supabase/functions/_shared/xero-sync-decision.ts';
import { xeroInvoiceOdometerKm, xeroWorkshopOdometer } from '../supabase/functions/_shared/xero-invoice-odometer.ts';

const ts = createRequire(import.meta.url)('../mobile/node_modules/typescript');
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const invoiceBase = { InvoiceID:id(3), Type:'ACCREC', Status:'AUTHORISED', CurrencyCode:'AUD', SentToContact:true,
  InvoiceNumber:'INV-FIXTURE', DateString:'2026-10-14', Reference:'SERVICE TEST42', Total:1000, AmountPaid:100, AmountDue:900,
  Contact:{ContactID:id(4),Name:'Fixture'}, LineItems:[{Description:'Registration: TEST42'}] };

function host({waiting=false,legacy=false,unlinked=false,wrongRecord=false,wrongVehicle=false,changes={}}={}) {
  const invoice={...invoiceBase,...changes};
  const q={id:id(1),source_key:`${id(2)}:${id(3)}`,status:waiting?'waiting_for_customer':'imported',reason:'Saved owner decision',
    job_id:waiting?null:id(5),record_id:waiting?null:id(6),attempt_count:1,xero_sync_revision:2,xero_sync_lease:id(10),
    xero_sync_previous_status:waiting?'waiting_for_customer':'imported',identifiers:{tenantId:id(2),invoiceId:id(3),contactId:id(4),
      reference:invoiceBase.Reference,invoiceNumber:invoiceBase.InvoiceNumber,invoiceDate:'2026-10-14',currency:'AUD',invoiceStatus:'AUTHORISED',
      contactName:'Saved workshop name',amountPaidCents:10000,amountDueCents:90000,
      ...waiting&&!legacy?{verifiedWorkshopContactId:id(7),verifiedWorkshopVehicleId:id(8),waitingConfirmedBy:id(9)}:{}}};
  const writes=[]; const completions=[]; const odometerWrites=[]; let pdfReads=0;
  const admin={
    from(table){
      const data=table==='workshop_jobs'?[{id:id(5),reference:'SERVICE TEST42',customer_id:id(11),vehicle_id:id(12),booking_request_id:null,job_date:'2026-10-13'}]:
        table==='vault_records'?{}:
        table==='customer_vehicles'?[{id:id(12),customer_id:id(11),registration:'TEST42',archived_at:null}]:
        table==='customer_profiles'?[{user_id:id(11)}]:
        table==='workshop_vehicles'?{id:id(8),workshop_contact_id:wrongVehicle?id(99):id(7),registration:'TEST42',status:'active'}:undefined;
      assert.notEqual(data,undefined,`Unexpected table access: ${table}`);
      const builder={select(){return builder;},eq(){return builder;},in(){return builder;},is(){return builder;},not(){return builder;},neq(){return builder;},
        update(payload){odometerWrites.push({table,payload});return builder;},
        limit:async()=>({data}),maybeSingle:async()=>({data:table==='workshop_jobs'?data[0]:data}),then:(resolve,reject)=>Promise.resolve({data}).then(resolve,reject)};
      return builder;
    },
    async rpc(name,args){
      if(name==='xero_customer_link_context') return {data:unlinked?null:{tenant_id:id(2),contact_id:id(4),customer_id:id(11),verified_by:id(9),verified_at:'2026-10-01T00:00:00Z'}};
      assert.equal(name,'finish_xero_invoice_sync'); writes.push(args.p_values); return {data:true};
    },
  };
  const modules={
    'jsr:@supabase/functions-js/edge-runtime.d.ts':{},'npm:@supabase/supabase-js@2.112.3':{},
    '../_shared/xero-token-crypto.ts':{},'../_shared/xero-token-refresh.ts':{},'../_shared/xero-invoice-dedupe.ts':{},
    '../_shared/xero-invoice-fetch.ts':{xeroInvoiceReader:()=>({invoice:async()=>invoice,pdf:async()=>{pdfReads++;throw Error('Existing PDF must not be downloaded or replaced');}})},
    '../_shared/xero-invoice-date.ts':{xeroInvoiceDate},'../_shared/xero-invoice-match.ts':{matchXeroInvoice},
    '../_shared/xero-invoice-registration.ts':{xeroDescriptionRegistration,xeroInvoiceMatchesVehicle},
    '../_shared/xero-sync-decision.ts':{waitingInvoiceRefreshReason,reviewNotificationRequired},
    '../_shared/xero-invoice-odometer.ts':{xeroInvoiceOdometerKm,xeroWorkshopOdometer},
  };
  const context={exports:{},Request,Response,Date,URL,require:name=>{assert.ok(name in modules,name);return modules[name];},
    Deno:{env:{get:()=>''},serve(){}},
    fixturePublished:{id:id(6),job_id:id(5),customer_id:wrongRecord?id(99):id(11),vehicle_id:id(12)},
    completions,
  };
  const code=ts.transpileModule(readFileSync(new URL('../supabase/functions/process-xero-imports/index.ts',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(code+`
    refreshedAccess=async()=>({accessToken:'fixture',ownerId:'fixture'});
    findPublishedWorkshopInvoice=async()=>fixturePublished;
    findExistingVehicleInvoice=async()=>null;
    syncServiceCompletionCandidate=async(...args)=>{completions.push(args.slice(1));};
    alertOwnerForReview=async()=>{};
    exports.run=importInvoice;
  `,context);
  return {run:()=>context.exports.run(admin,q),writes,completions,odometerWrites,pdfReads:()=>pdfReads};
}

test('payment update refreshes a verified imported invoice without replacing its existing PDF',async()=>{
  const h=host({changes:{AmountPaid:1000,AmountDue:0,Status:'PAID'}}); const result=await h.run();
  assert.equal(result.status,'imported');assert.equal(result.duplicate,true);assert.equal(h.pdfReads(),0);
  assert.equal(h.writes[0].record_id,id(6));assert.equal(h.writes[0].identifiers.amountDueCents,0);assert.equal(h.completions.length,1);
});

test('refresh copies explicitly labelled invoice kilometres with the matched workshop date',async()=>{
  const h=host({changes:{LineItems:[{Description:'Registration: TEST42\nKMS : 84.210'}]}});
  assert.equal((await h.run()).status,'imported');
  assert.equal(h.pdfReads(),0);
  assert.equal(h.odometerWrites.length,1);
  assert.equal(h.odometerWrites[0].table,'vault_records');
  assert.equal(h.odometerWrites[0].payload.odometer_km,84210);
  assert.equal(h.odometerWrites[0].payload.odometer_recorded_on,'2026-10-13');
});
test('saved published PDF belonging to another customer cannot be reused',async()=>{
  const h=host({wrongRecord:true});await assert.rejects(h.run(),/xero_saved_record_target_mismatch/);assert.equal(h.writes.length,0);assert.equal(h.pdfReads(),0);
});
test('published invoice without a verified link remains reviewable',async()=>{
  const h=host({unlinked:true});assert.equal((await h.run()).status,'needs_review');assert.equal(h.writes[0].reason,'verified_customer_link_required');assert.equal(h.pdfReads(),0);
});
test('waiting payment refresh retains the owner selection and does not publish or invite',async()=>{
  const h=host({waiting:true,changes:{AmountPaid:1000,AmountDue:0,Status:'PAID'}});assert.equal((await h.run()).status,'waiting_for_customer');
  assert.equal(h.writes[0].identifiers.waitingConfirmedBy,id(9));assert.equal(h.writes[0].identifiers.contactName,'Saved workshop name');assert.equal(h.completions.length,0);assert.equal(h.pdfReads(),0);
});
test('legacy waiting entry stays held without guessing a customer or vehicle',async()=>{
  const h=host({waiting:true,legacy:true,changes:{AmountPaid:1000,AmountDue:0,Status:'PAID'}});assert.equal((await h.run()).status,'waiting_for_customer');assert.equal(h.pdfReads(),0);
});
test('waiting refresh detects a vehicle moved to a different workshop contact',async()=>{
  const h=host({waiting:true,wrongVehicle:true});assert.equal((await h.run()).reason,'vehicle_ownership_requires_review');assert.equal(h.pdfReads(),0);
});
test('waiting refresh detects changed invoice identity while preserving its saved selection',async()=>{
  const h=host({waiting:true,changes:{Reference:'SERVICE OTHER1'}});assert.equal((await h.run()).status,'needs_review');assert.equal(h.writes[0].identifiers.verifiedWorkshopVehicleId,id(8));assert.equal(h.pdfReads(),0);
});
