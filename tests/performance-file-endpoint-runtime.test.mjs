import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { fileLinkLifetime } from '../supabase/functions/open-vault-file/access-deadline.ts';
const require = createRequire(new URL('../mobile/package.json', import.meta.url));
const ts = require('typescript');
const source = ts.transpileModule(await readFile(new URL('../supabase/functions/open-vault-file/index.ts', import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const id='a1111111-1111-4111-8111-111111111111';
async function request({session=true,visible=true,denied=false,legacy=false,unlimited=false}={}) {
  const calls=[];
  const row={id,vehicle_id:id,customer_id:id,object_path:'private.pdf',bucket_id:'vehicle-documents',file_kind:'invoice',record_source:'psi_record',ready:true};
  const query={select(){return this;},eq(){return this;},is(){return this;},async maybeSingle(){return {data:visible?row:null,error:null};}};
  const client={auth:{getUser:async()=>({data:{user:session?{id}:null},error:null})},from:()=>query,
    rpc:async()=>({data:denied?null:{unlimited,expires_at:new Date(Date.now()+30000).toISOString()},error:denied?{}:null})};
  const shared={cors:{},env:()=>'',json:(body,status=200)=>Response.json(body,{status}),uuid:value=>value===id,
    adminClient:()=>({storage:{from:()=>({createSignedUrl:async(path,ttl)=>{calls.push({path,ttl});return {data:{signedUrl:'https://example.invalid/private'},error:null};}})}})};
  let handler;
  vm.runInNewContext(source,{exports:{},Deno:{serve:fn=>{handler=fn;}},Response,Date,
    require:name=>name.includes('supabase-js')?{createClient:()=>client}:name.includes('access-deadline')?{fileLinkLifetime}:shared});
  const response=await handler(new Request('https://example.invalid/file',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify(legacy?{legacyFileId:id}:{assetId:id})}));
  return {status:response.status,body:await response.json(),calls};
}
test('file endpoint never signs for anonymous, hidden or expired rows',async()=>{
  for(const options of [{session:false},{visible:false},{denied:true},{legacy:true,denied:true}]){
    const r=await request(options); assert.ok(r.status>=400);assert.equal(r.calls.length,0);
  }
});
test('vault and legacy downloads recheck entitlement and cap issued links',async()=>{
  for(const legacy of [false,true]) {const r=await request({legacy});assert.equal(r.status,200);assert.ok(r.calls[0].ttl<=29 && r.calls[0].ttl>0);assert.equal(r.body.expiresIn,r.calls[0].ttl);}
});
test('permanent or independently purchased file access retains a short signed link',async()=>{
  const r=await request({unlimited:true});assert.equal(r.status,200);assert.equal(r.calls[0].ttl,60);
});
