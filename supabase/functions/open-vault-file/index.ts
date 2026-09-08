import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { adminClient, cors, env, json, uuid } from '../_shared/performance-subscription.ts';
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
   const {data:file,error}=await client.from('vehicle_files').select('id,customer_id,bucket_id,object_path,archived_at').eq('id',body.legacyFileId).is('archived_at',null).maybeSingle();
   if(error||!file||file.customer_id!==user.user.id)return json({error:'file_unavailable'},404);
   const result=await adminClient().storage.from(file.bucket_id).createSignedUrl(file.object_path,60);
   if(result.error)throw result.error;
   return json({url:result.data.signedUrl,expiresIn:60});
  }
  if(!uuid(body.assetId))return json({error:'invalid_asset'},400);
  const {data:asset,error}=await client.from('vault_assets').select('id,customer_id,object_path,thumbnail_path,ready').eq('id',body.assetId).eq('ready',true).maybeSingle();
  // User-scoped RLS checks publication, ownership, expiry and deleted identities.
  if(error||!asset||asset.customer_id!==user.user.id)return json({error:'file_unavailable'},404);
  const path=body.thumbnail===true?asset.thumbnail_path:asset.object_path;
  if(!path)return json({error:'file_unavailable'},404);
  const signed=await adminClient().storage.from('performance-vault').createSignedUrl(path,60);
  if(signed.error)throw signed.error;
  return json({url:signed.data.signedUrl,expiresIn:60});
 }catch{return json({error:'file_unavailable'},503);}
});
