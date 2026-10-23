import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { generateKeyPairSync, webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import vm from 'node:vm';
import test from 'node:test';
const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = require('typescript');
const source = ts.transpileModule(await readFile(new URL('../supabase/functions/_shared/rewards-wallet-providers.ts',import.meta.url),'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const card = { customer_id:'10000000-0000-4000-8000-000000000001',card_id:'10000000-0000-4000-8000-000000000010',
  points_balance:1234,revision:1,updated_at:new Date().toISOString(),name:'Fictional Test Member' };
const earning = { multiplier:2,state:'double',subscriptionStatus:'active',bonusEnabled:true,
  validUntil:new Date(Date.now()+86400_000).toISOString(),subscriptionExpiresAt:new Date(Date.now()+86400_000).toISOString() };
function harness({published=true,review='approved',conflict=false}={}) {
  const requests=[]; let pass;
  const config={REWARDS_GOOGLE_ISSUER_ID:'3388000000000000000',REWARDS_GOOGLE_PUBLISHING_ENABLED:String(published),
    REWARDS_GOOGLE_SERVICE_ACCOUNT:JSON.stringify({client_email:'fixture@fixture.iam.gserviceaccount.com',private_key:privateKey}),
    REWARDS_APPLE_PASS_TYPE_ID:'pass.example.fixture',REWARDS_APPLE_TEAM_ID:'TESTTEAM',REWARDS_APPLE_CERT_PEM:'fixture',
    REWARDS_APPLE_KEY_PEM:'fixture',REWARDS_APPLE_WWDR_PEM:'fixture',SUPABASE_URL:'https://fixture.supabase.co'};
  const api={};
  vm.runInNewContext(source,{exports:api,Date,URLSearchParams,Uint8Array,TextEncoder,Buffer,atob,crypto:webcrypto,AbortSignal,
    fetch:async(url,options={})=>{
      requests.push({url:String(url),...options});
      if(String(url).includes('oauth2'))return Response.json({access_token:'fixture-access'});
      if(String(url).includes('/loyaltyClass/'))return Response.json({reviewStatus:review});
      if(String(url).endsWith('.png'))return new Response(Uint8Array.of(137,80,78,71),{headers:{'content-type':'image/png'}});
      return new Response(null,{status:options.method==='POST'&&conflict?409:200});
    },
    require(name){
      if(name==='node:buffer')return{Buffer};
      if(name.includes('passkit-generator'))return{PKPass:class{
        constructor(_files,_certs,options){pass={...options,headerFields:[],primaryFields:[],secondaryFields:[],auxiliaryFields:[],backFields:[]};Object.assign(this,pass);}
        setBarcodes(value){pass.barcode=value;}getAsBuffer(){return Buffer.from(JSON.stringify(pass));}
      }};
      if(name.endsWith('xero-runtime.ts'))return{env:key=>config[key]??''};
      throw new Error(name);
    }});
  return {api,requests,get pass(){return pass;}};
}
test('Apple card preserves membership, real point conversion and QR while changing earning status',async()=>{
  const h=harness();
  await h.api.applePass(card,'fixture-auth-token');
  assert.equal(h.pass.serialNumber,card.card_id);
  assert.equal(h.pass.primaryFields[0].value,'AUD 12.34');
  assert.equal(h.pass.headerFields[0].value,'1× POINTS');
  const barcode=h.pass.barcode.message;
  await h.api.applePass({...card,points_balance:2468,earning},'fixture-auth-token');
  assert.equal(h.pass.primaryFields[0].value,'AUD 24.68');
  assert.equal(h.pass.secondaryFields[0].value,2468);
  assert.equal(h.pass.headerFields[0].value,'2× POINTS ACTIVE');
  assert.equal(h.pass.serialNumber,card.card_id);
  assert.equal(h.pass.barcode.message,barcode);
  assert.equal('expirationDate' in h.pass,false); // The free membership never expires with paid benefits.
  await h.api.applePass({...card,points_balance:2468,earning:{...earning,validUntil:new Date(0).toISOString()}},'fixture-auth-token');
  assert.equal(h.pass.headerFields[0].value,'1× POINTS');
  assert.equal(h.pass.secondaryFields[0].value,2468);
});
test('Google save retries update the same object and keep actual credit and QR',async()=>{
  const h=harness({conflict:true});
  const first=await h.api.issueGoogleCard({...card,earning});
  const writes=h.requests.filter(value=>value.url.includes('/loyaltyObject')&&value.body);
  assert.equal(writes.length,2);
  const [insert,patch]=writes.map(value=>JSON.parse(value.body));
  assert.equal(insert.id,patch.id);
  assert.equal(insert.loyaltyPoints.balance.int,1234);
  assert.equal(insert.secondaryLoyaltyPoints.balance.string,'AUD 12.34');
  assert.equal(insert.textModulesData[0].header,'2× POINTS ACTIVE');
  await h.api.updateGoogleCard({...card,points_balance:2468,earning:{...earning,validUntil:new Date(0).toISOString()}},first.objectId);
  const updated=JSON.parse(h.requests.at(-1).body);
  assert.equal(updated.id,insert.id);
  assert.equal(updated.state,'ACTIVE');
  assert.equal(updated.textModulesData[0].header,'1× POINTS');
  assert.equal(updated.loyaltyPoints.balance.int,2468);
  assert.equal(updated.barcode.value,insert.barcode.value);
  assert.equal(updated.secondaryLoyaltyPoints.balance.string,'AUD 24.68');
  await assert.rejects(()=>h.api.updateGoogleCard(card,'another-membership'),/wallet_identity_requires_review/);
});
test('Google publishing and class review remain mandatory, even with signing configured',async()=>{
  const disabled=harness({published:false});
  await assert.rejects(()=>disabled.api.issueGoogleCard(card),/google_wallet_setup_required/);
  assert.equal(disabled.requests.length,0);
  const pending=harness({review:'UNDER_REVIEW'});
  await assert.rejects(()=>pending.api.issueGoogleCard(card),/google_wallet_publishing_approval_required/);
  assert.equal(pending.requests.some(value=>value.url.includes('/loyaltyObject')),false);
});
