import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { adminClient, cors, env, json, uuid } from '../_shared/performance-subscription.ts';
import { fileLinkLifetime } from './access-deadline.ts';
Deno.serve(async request => {
 if(request.method==='OPTIONS') return new Response('ok',{headers:cors});
 if(request.method!=='POST') return json({error:'method_not_allowed'},405);
 const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')??'';
 const client=createClient(env('SUPABASE_URL'),env('SUPABASE_ANON_KEY'),{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:user,error:authError}=await client.auth.getUser(token);
 if(authError||!user.user)return json({error:'invalid_session'},401);
 try{
  const body=await request.json();
  if(uuid(body.legacyFileId)) {
   const {data:file,error}=await client.from('vehicle_files').select('id,customer_id,vehicle_id,file_kind,record_source,bucket_id,object_path,archived_at').eq('id',body.legacyFileId).is('archived_at',null).maybeSingle();
   // User-scoped RLS permits the entitled owner or authorised PSI staff.
   if(error||!file)return json({error:'file_unavailable'},404);
   const freePhoto=file.file_kind==='vehicle_photo' && file.record_source==='customer_entry';
   const {data:access,error:accessError}=freePhoto ? {data:{unlimited:true},error:null} : await client.rpc('performance_file_access',{p_vehicle_id:file.vehicle_id});
   const expiresIn=accessError||!access ? 0 : fileLinkLifetime(access);
   if(!expiresIn)return json({error:'file_unavailable'},403);
   const result=await adminClient().storage.from(file.bucket_id).createSignedUrl(file.object_path,expiresIn);
   if(result.error)throw result.error;
   return json({url:result.data.signedUrl,expiresIn});
  }
  if(!uuid(body.assetId))return json({error:'invalid_asset'},400);
  const {data:asset,error}=await client.from('vault_assets').select('id,customer_id,vehicle_id,object_path,thumbnail_path,ready').eq('id',body.assetId).eq('ready',true).maybeSingle();
  // User-scoped RLS checks publication, ownership, expiry and deleted identities.
  if(error||!asset)return json({error:'file_unavailable'},404);
  const path=body.thumbnail===true?asset.thumbnail_path:asset.object_path;
  if(!path)return json({error:'file_unavailable'},404);
  const {data:access,error:accessError}=await client.rpc('performance_file_access',{p_vehicle_id:asset.vehicle_id});
  const expiresIn=accessError||!access ? 0 : fileLinkLifetime(access);
  if(!expiresIn)return json({error:'file_unavailable'},403);
  const signed=await adminClient().storage.from('performance-vault').createSignedUrl(path,expiresIn);
  if(signed.error)throw signed.error;
  return json({url:signed.data.signedUrl,expiresIn});
 }catch{return json({error:'file_unavailable'},503);}
});
