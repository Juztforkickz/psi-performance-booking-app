// Isolated issuer fixtures only. No provider network requests or production keys.
import assert from 'node:assert/strict';
import forge from 'npm:node-forge@1.4.0';
import { inflateRawSync } from 'node:zlib';
import { Buffer } from 'node:buffer';
import { applePass, issueGoogleCard, scanUrl } from '../functions/_shared/rewards-wallet-providers.ts';

const keys = forge.pki.rsa.generateKeyPair(2048);
const root = forge.pki.createCertificate();
root.publicKey=keys.publicKey; root.serialNumber='01';
root.validity.notBefore=new Date(Date.now()-86400000); root.validity.notAfter=new Date(Date.now()+86400000);
root.setSubject([{name:'commonName',value:'FICTIONAL TEST CA'}]); root.setIssuer(root.subject.attributes);
root.setExtensions([{name:'basicConstraints',cA:true}]); root.sign(keys.privateKey,forge.md.sha256.create());
const cert=forge.pki.createCertificate(); cert.publicKey=keys.publicKey; cert.serialNumber='02';
cert.validity.notBefore=root.validity.notBefore; cert.validity.notAfter=root.validity.notAfter;
cert.setSubject([{name:'commonName',value:'FICTIONAL PSI WALLET TEST'},{name:'organizationalUnitName',value:'FIXTURE1234'}]);
cert.setIssuer(root.subject.attributes); cert.sign(keys.privateKey,forge.md.sha256.create());
const keyPem=forge.pki.privateKeyToPem(keys.privateKey);
const card={customer_id:'10000000-0000-4000-8000-000000000001',card_id:'10000000-0000-4000-8000-000000000010',points_balance:1000,revision:1,updated_at:'2026-10-22T00:00:00Z',name:'SAMPLE MEMBER'};
const originalFetch=globalThis.fetch;
const originalEnv=new Map();
function set(name,value) { if(!originalEnv.has(name))originalEnv.set(name,Deno.env.get(name)); Deno.env.set(name,value); }
function restore() { globalThis.fetch=originalFetch; for(const [name,value]of originalEnv) { if(value===undefined)Deno.env.delete(name); else Deno.env.set(name,value); } originalEnv.clear(); }
function unzip(bytes) {
  const files={}; let at=0;
  while(bytes.readUInt32LE(at)===0x04034b50) {
    const method=bytes.readUInt16LE(at+8),size=bytes.readUInt32LE(at+18),nameLength=bytes.readUInt16LE(at+26),extraLength=bytes.readUInt16LE(at+28);
    const name=bytes.subarray(at+30,at+30+nameLength).toString('utf8');
    const start=at+30+nameLength+extraLength,raw=bytes.subarray(start,start+size);
    files[name]=method===0?raw:inflateRawSync(raw); at=start+size;
  }
  return files;
}
Deno.test('Apple package contains the correct live fields, membership QR and signed manifest',async()=>{
  try {
    set('SUPABASE_URL','https://fixture.supabase.co');set('REWARDS_APPLE_PASS_TYPE_ID','pass.example.fixture');set('REWARDS_APPLE_TEAM_ID','FIXTURE1234');
    set('REWARDS_APPLE_CERT_PEM',forge.pki.certificateToPem(cert));set('REWARDS_APPLE_KEY_PEM',keyPem);set('REWARDS_APPLE_WWDR_PEM',forge.pki.certificateToPem(root));set('REWARDS_APPLE_KEY_PASSWORD','');
    globalThis.fetch=async url=>{
      assert.ok(String(url).startsWith('https://juztforkickz.github.io/psi-performance-booking-app/rewards-assets/'));
      const name=String(url).endsWith('/logo.png')?'psi-logo.png':'psi-app-icon-1024.png';
      const bytes=await Deno.readFile(new URL(`../../mobile/assets/images/${name}`,import.meta.url));
      return new Response(bytes,{headers:{'Content-Type':'image/png'}});
    };
    const files=unzip(await applePass(card,'f'.repeat(64)));
    const pass=JSON.parse(files['pass.json'].toString());
    assert.equal(pass.passTypeIdentifier,'pass.example.fixture');assert.equal(pass.serialNumber,card.card_id);
    assert.equal(pass.storeCard.primaryFields[0].value,'AUD 10.00');assert.equal(pass.storeCard.secondaryFields[0].value,1000);
    assert.equal(pass.barcodes[0].message,scanUrl(card));
    assert.equal(pass.authenticationToken,'f'.repeat(64));assert.ok(files.signature.length>100);
    const manifest=JSON.parse(files['manifest.json'].toString());
    for(const [name,digest]of Object.entries(manifest)) {
      const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',files[name])),b=>b.toString(16).padStart(2,'0')).join('');
      assert.equal(actual,digest);
    }
  } finally { restore(); }
});

function googleFixture(reviewStatus='approved') {
  const privateInfo=forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keys.privateKey));
  set('REWARDS_GOOGLE_ISSUER_ID','123456789012345');set('REWARDS_GOOGLE_PUBLISHING_ENABLED','true');
  set('REWARDS_GOOGLE_SERVICE_ACCOUNT',JSON.stringify({client_email:'fixture@fixture-project.iam.gserviceaccount.com',private_key:forge.pki.privateKeyInfoToPem(privateInfo)}));
  const requests=[];
  globalThis.fetch=async(url,options)=>{
    const target=String(url);requests.push({url:target,options});
    if(target==='https://oauth2.googleapis.com/token')return Response.json({access_token:'FIXTURE_ACCESS_TOKEN'});
    if(target.endsWith('/loyaltyClass/123456789012345.psi_rewards_v1'))return Response.json({reviewStatus});
    if(target==='https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject')return Response.json({}, {status:201});
    throw new Error('Unexpected network request in fixture');
  };
  return requests;
}
Deno.test('Google card uses the correct points and credit and an RSA signed save link',async()=>{
  try {
    const requests=googleFixture();const result=await issueGoogleCard(card);
    const object=JSON.parse(requests.find(r=>r.url.endsWith('/loyaltyObject')).options.body);
    assert.equal(object.loyaltyPoints.balance.int,1000);assert.equal(object.secondaryLoyaltyPoints.balance.string,'AUD 10.00');
    assert.equal(object.barcode.value,scanUrl(card));assert.equal(object.accountName,'SAMPLE MEMBER');
    const jwt=result.url.split('/save/')[1],parts=jwt.split('.');
    const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());
    assert.equal(payload.aud,'google');assert.equal(payload.typ,'savetowallet');assert.equal(payload.payload.loyaltyObjects[0].id,object.id);
    const digest=forge.md.sha256.create();digest.update(parts[0]+'.'+parts[1],'utf8');
    assert.equal(keys.publicKey.verify(digest.digest().bytes(),Buffer.from(parts[2],'base64url').toString('binary')),true);
  } finally { restore(); }
});
Deno.test('Google publishing review cannot be bypassed by issuing a test card to customers',async()=>{
  try {
    for (const status of ['UNDER_REVIEW','underReview','DRAFT','',null]) {
      const requests=googleFixture(status);await assert.rejects(issueGoogleCard(card),/publishing_approval_required/);
      assert.equal(requests.some(r=>r.url.endsWith('/loyaltyObject')),false);
    }
  } finally { restore(); }
});
