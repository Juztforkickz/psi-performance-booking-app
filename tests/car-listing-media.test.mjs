import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
const require=createRequire(import.meta.url), ts=require('../mobile/node_modules/typescript');
function load(name,modules) {
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../mobile/src/lib/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports:mod.exports,module:mod,require(id){assert(id in modules,'Unexpected dependency '+id);return modules[id];},URL,AbortController,ArrayBuffer,Uint8Array,setTimeout,clearTimeout});return mod.exports;
}
function uploader(fetcher,saved=null) {
 let stored=saved; const calls=[];
 const deps={fetch:async(url,init)=>{calls.push({url,...init});return fetcher(url,init);},storage:{getItem:async()=>stored,setItem:async(k,v)=>{stored=v;},removeItem:async()=>{stored=null;}},wait:async()=>{}};
 const lib=load('car-listing-resumable-upload.ts',{'@react-native-async-storage/async-storage':{default:deps.storage},'expo/fetch':{fetch:deps.fetch}});
 const input={projectRef:'abcdefghijklmnopqrst',userId:'staff',mediaId:'media',objectPath:'listing/media.mp4',mime:'video/mp4',bytes:new ArrayBuffer(7*1024*1024),token:async()=>'test-token',progress:()=>{}};
 return {run:()=>lib.uploadCarListingBytes(input,deps),calls,input,stored:()=>stored};
}
const endpoint='https://abcdefghijklmnopqrst.storage.supabase.co/storage/v1/upload/resumable';
const response=(status,headers={})=>new Response(null,{status,headers});
test('TUS uses immutable six MB chunks and clears its account scoped resume record',async()=>{
 let offset=0;const u=uploader(async(url,init)=>{
 if(init.method==='POST'){assert.equal(init.headers['x-upsert'],undefined);assert.match(init.headers['Upload-Metadata'],/bucketName Y2FyLWxpc3RpbmctbWVkaWE=/);return response(201,{location:endpoint+'/upload-a'});}
 assert.equal(init.headers['Upload-Offset'],String(offset)); assert(init.body.byteLength<=6*1024*1024);offset+=init.body.byteLength;return response(204,{'upload-offset':String(offset)});
 }); await u.run();assert.equal(offset,7*1024*1024);assert.deepEqual(u.calls.map(c=>c.method),['POST','PATCH','PATCH']);assert.equal(u.stored(),null);
});
test('TUS recovers a lost acknowledgement by asking for the server offset',async()=>{
 let offset=0,lost=false;const u=uploader(async(url,init)=>{
 if(init.method==='POST')return response(201,{location:endpoint+'/recover'});
 if(init.method==='HEAD')return response(200,{'upload-length':String(u.input.bytes.byteLength),'upload-offset':String(offset)});
 assert.equal(init.headers['Upload-Offset'],String(offset));offset+=init.body.byteLength;
 if(!lost){lost=true;throw Error('Network lost after commit');}return response(204,{'upload-offset':String(offset)});
 });await u.run();assert.deepEqual(u.calls.map(c=>c.method),['POST','PATCH','HEAD','PATCH']);assert.equal(offset,u.input.bytes.byteLength);
});
test('TUS resumes stored offsets and rejects foreign upload destinations',async()=>{
 let offset=6*1024*1024;const u=uploader(async(url,init)=>{
 assert.equal(url,endpoint+'/resume');if(init.method==='HEAD')return response(200,{'upload-length':String(u.input.bytes.byteLength),'upload-offset':String(offset)});
 offset+=init.body.byteLength;return response(204,{'upload-offset':String(offset)});
 },endpoint+'/resume');await u.run();assert.deepEqual(u.calls.map(c=>c.method),['HEAD','PATCH']);
 const bad=uploader(async()=>response(201,{location:'https://attacker.example/upload'}),'https://attacker.example/stolen');await assert.rejects(bad.run(),/URL_INVALID/);assert.equal(bad.calls.length,1);assert.equal(bad.calls[0].url,endpoint);
});
test('TUS rejects invalid offsets and ends bounded retries',async()=>{
 const bad=uploader(async(url,init)=>init.method==='POST'?response(201,{location:endpoint+'/bad'}):response(204,{'upload-offset':'999999999'}));await assert.rejects(bad.run(),/OFFSET_INVALID/);
 let n=0;const broken=uploader(async(url,init)=>{
 if(init.method==='POST')return response(201,{location:endpoint+'/broken'});
 if(init.method==='HEAD')return response(200,{'upload-length':String(broken.input.bytes.byteLength),'upload-offset':'0'});
 n++;return response(500);
 });await assert.rejects(broken.run(),/INTERRUPTED/);assert.equal(n,4);
});
function mediaHarness({preview=false,staff=true,session='staff',finishExists=false,failUpload=false}={}) {
 const calls=[],uploaded=[],objects=new Map();let counter=0;
 const client={auth:{getSession:async()=>({data:{session:{user:{id:session},access_token:'test-token'}}})},rpc:async(name,args)=>{
 calls.push({name,...args});let row;
 if(args.p_action==='reserve'){
 row=objects.get(args.p_metadata.sha256);if(!row){row={id:'media-'+(++counter),state:'pending',object_path:'listing/media-'+counter+'.jpg'};objects.set(args.p_metadata.sha256,row);}
 }else {row=[...objects.values()].find(v=>v.id===args.p_media_id);if(!finishExists && !uploaded.includes(row.id))return{error:{message:'CAR_MEDIA_UPLOAD_INCOMPLETE'}};row.state='ready';}
 return{data:{...row}};
 }};
 const lib=load('car-listing-media.ts',{
 'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA256'},digest:async(_,bytes)=>Uint8Array.from(createHash('sha256').update(new Uint8Array(bytes)).digest()).buffer},
 'expo-image-manipulator':{SaveFormat:{JPEG:'jpeg'},manipulateAsync:async()=>({uri:'resized.jpg'})},
 'react-native':{Image:{getSize:(uri,cb)=>cb(4000,3000)}},
 '@/lib/car-listing-resumable-upload':{uploadCarListingBytes:async input=>{await input.token();if(failUpload)throw Error('Network');uploaded.push(input.mediaId);}},
 '@/lib/review-environment':{REVIEW_ENVIRONMENT:{enabled:preview}},
 '@/lib/staff-portal':{loadStaffMfaSecurityAccess:async()=>staff?{kind:'ready',staff:{user_id:'staff'}}:{kind:'mfa_required'}},
 '@/lib/supabase':{getSupabaseClient:()=>client,SUPABASE_CONNECTION:{projectRef:'abcdefghijklmnopqrst'}},
 '@/lib/upload-file-bytes':{readUploadBytes:async uri=>Uint8Array.from(uri==='resized.jpg'?[255,216,255,224,7]:uri==='pdf'?[37,80,68,70,45,49]:uri==='mov'?[0,0,0,16,102,116,121,112,113,116,32,32]:uri==='mp4'?[0,0,0,16,102,116,121,112,105,115,111,109]:uri==='webm'?[26,69,223,163,1]:uri==='txt'?[86,101,104,105,99,108,101]:[60,104,116,109,108,62]).buffer},
 });return{lib,calls,uploaded,objects};
}
const photo={uri:'photo',name:'car.heic',mimeType:'image/heic',size:1024,lastModified:0};
test('Photo upload resizes, validates actual bytes and deduplicates the same content',async()=>{
 const h=mediaHarness();const result=await h.lib.uploadCarListingMedia('listing',[photo,photo],()=>{});
 assert.equal(result.uploaded,1);assert.equal(result.skipped,1);assert.equal(h.objects.size,1);assert.equal(h.uploaded.length,1);
 const reservation=h.calls.find(c=>c.p_action==='reserve');assert.equal(reservation.p_metadata.mime_type,'image/jpeg');assert.equal(reservation.p_metadata.size_bytes,5);assert.match(reservation.p_metadata.sha256,/^[a-f0-9]{64}$/);
 assert.equal(h.calls.some(c=>/notify|publish|status/.test(c.name)),false);
});
test('Completed server uploads recover without sending bytes again',async()=>{
 const h=mediaHarness({finishExists:true});const r=await h.lib.uploadCarListingMedia('listing',[photo],()=>{});assert.equal(r.uploaded,1);assert.equal(h.uploaded.length,0);
});
test('MFA, preview and account switching cannot upload',async()=>{
 const preview=mediaHarness({preview:true});await assert.rejects(preview.lib.uploadCarListingMedia('listing',[photo],()=>{}),/PREVIEW_ONLY/);assert.equal(preview.calls.length,0);
 const noStaff=mediaHarness({staff:false});await assert.rejects(noStaff.lib.uploadCarListingMedia('listing',[photo],()=>{}),/AAL2/);assert.equal(noStaff.calls.length,0);
 const changed=mediaHarness({session:'another-user'});const r=await changed.lib.uploadCarListingMedia('listing',[photo],()=>{});assert.equal(r.failed.length,1);assert.match(r.errors[0],/verify your staff session/);assert.equal(changed.uploaded.length,0);
});
test('Mixed uploads keep completed files and reject size or disguised content',async()=>{
 const h=mediaHarness();const r=await h.lib.uploadCarListingMedia('listing',[photo,{uri:'pdf',name:'sale.pdf'},{uri:'html',name:'fake.pdf'},{...photo,name:'huge.jpg',size:41*1024*1024}],()=>{});
 assert.equal(r.uploaded,2);assert.equal(r.failed.length,2);assert.equal(h.objects.size,2);
 assert.throws(()=>h.lib.carMediaFileType({name:'script.html'}),/TYPE_INVALID/);
 for(const name of ['video.mp4','video.mov','video.webm'])assert.equal(h.lib.carMediaFileType({name}),'video');
 for(const name of ['sale.pdf','history.docx','info.xlsx','info.csv','info.txt'])assert.equal(h.lib.carMediaFileType({name}),'file');
});
test('Failed upload keeps the reserved attachment available for a later retry',async()=>{
 const h=mediaHarness({failUpload:true});const r=await h.lib.uploadCarListingMedia('listing',[photo],()=>{});assert.equal(r.failed.length,1);assert.equal(h.objects.size,1);assert.equal([...h.objects.values()][0].state,'pending');
});

test('MP4, MOV, WebM and text files upload using their verified type and actual length',async()=>{
 const h=mediaHarness();const r=await h.lib.uploadCarListingMedia('listing',[{uri:'mp4',name:'walkaround.mp4'},{uri:'mov',name:'walkaround.mov',mimeType:'video/quicktime'},{uri:'webm',name:'engine.webm'},{uri:'txt',name:'details.txt'}],()=>{});
 assert.equal(r.uploaded+r.skipped,4);
 const reserved=h.calls.filter(c=>c.p_action==='reserve');assert.deepEqual(reserved.map(c=>c.p_metadata.mime_type),['video/mp4','video/quicktime','video/webm','text/plain']);
});
