import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { StaffScrollSelect } from '@/components/staff-scroll-select';
import { australianDateToIso, todayAustralianDate } from '@/lib/australian-date';
import type { StaffPortalSnapshot } from '@/lib/staff-portal';
import { createOrFindWorkshopJob, publishVaultRecord } from '@/lib/staff-vault';
import { VAULT_KINDS, VAULT_LABELS, vaultClient, type VaultKind } from '@/lib/performance-plus';
import { s } from '@/app/performance-plus';
import { SUPABASE_CONNECTION } from '@/lib/supabase';

export function StaffVaultPublisher({ snapshot }: { snapshot: StaffPortalSnapshot }) {
 const [customerId,setCustomerId]=useState(''); const [vehicleId,setVehicleId]=useState('');
 const [reference,setReference]=useState(''); const [title,setTitle]=useState(''); const [notes,setNotes]=useState('');
 const [date,setDate]=useState(todayAustralianDate()); const [kind,setKind]=useState<VaultKind>('media');
 const [phase,setPhase]=useState<'before'|'progress'|'after'>('before'); const [files,setFiles]=useState<DocumentPicker.DocumentPickerAsset[]>([]);
 const [confirmed,setConfirmed]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 const [power,setPower]=useState(''); const [torque,setTorque]=useState('');
 const [imports,setImports]=useState<{id:string;reason:string;source:string;source_key:string}[]>([]);
 const [drafts,setDrafts]=useState<{id:string;title:string;created_at:string}[]>([]);
 const vehicles=snapshot.vehicles.filter(v=>v.customer_id===customerId);
 const downloadManifest=async()=>{if(Platform.OS!=='web'||busy)return;setBusy(true);try{const iso=australianDateToIso(date);if(!iso||!confirmed||!vehicleId||!title.trim())throw new Error('Confirm the customer, vehicle, job title and date first.');const job=await createOrFindWorkshopJob({customerId,vehicleId,reference,title,date:iso});const vehicle=vehicles.find(v=>v.id===vehicleId);if(!vehicle)throw new Error('Vehicle not found.');const blob=new Blob([JSON.stringify({schema:1,project_ref:SUPABASE_CONNECTION.projectRef,job_id:job.id,customer_id:customerId,vehicle_id:vehicleId,registration:vehicle.registration,reference:job.reference,job_date:job.job_date},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='psi-job.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Save psi-job.json inside the matching workshop folder. The importer verifies it against the server.');}catch(e){setMessage(e instanceof Error?e.message:'Manifest could not be created.');}finally{setBusy(false);}};
 const selectFiles=async()=>{try{const r=await DocumentPicker.getDocumentAsync({type:kind==='dyno'||kind==='invoice'?'application/pdf':['image/*','application/pdf'],multiple:true,copyToCacheDirectory:true});if(!r.canceled){setFiles(r.assets);setConfirmed(false);}}catch{setMessage('Files could not be selected.');}};
 const publish=async()=>{if(busy||!confirmed)return;setBusy(true);try{
  const iso=australianDateToIso(date);if(!iso||!customerId||!vehicleId||!title.trim())throw new Error('Select a customer and vehicle, enter a title and use a real DD/MM/YYYY date.');
  if((power&&!(Number(power)>0))||(torque&&!(Number(torque)>0)))throw new Error('Power and torque must be positive numbers.');
  const job=await createOrFindWorkshopJob({customerId,vehicleId,reference,title,date:iso});
  await publishVaultRecord(job,{kind,title,notes,date:iso,files,phase,powerKw:power?Number(power)/1.34102209:undefined,torqueNm:torque?Number(torque):undefined,runStage:kind==='dyno'?phase==='progress'?'baseline':phase:undefined},setMessage);
  setFiles([]);setConfirmed(false);setMessage('Published to this vehicle’s private Performance+ record.');
 }catch(e){setMessage(e instanceof Error?e.message:'Publication failed. Check the staff session and try again.');}finally{setBusy(false);}};
 const review=async()=>{try{const [q,d]=await Promise.all([vaultClient().from('vault_import_queue').select('*').eq('status','needs_review').limit(50),vaultClient().from('vault_records').select('*').is('published_at',null).limit(50)]);if(q.error||d.error)throw q.error??d.error;setImports(q.data??[]);setDrafts(d.data??[]);setMessage('Review queue refreshed. No automatic matching has been approved.');}catch{setMessage('The review queue could not be loaded.');}};
 return <View style={s.pricing}><Text style={s.section}>Performance+ workshop vault</Text><Text style={s.copy}>Choose the customer, vehicle and PSI job. Files stay private until the complete batch is published.</Text>
 <StaffScrollSelect label="Customer" value={customerId} options={snapshot.customers.map(c=>({value:c.user_id,label:[c.first_name,c.last_name].filter(Boolean).join(' ')||c.email,sublabel:c.email}))} onChange={(id)=>{if(!busy){setCustomerId(id);setVehicleId('');setFiles([]);setConfirmed(false);}}} />
 <StaffScrollSelect label="Vehicle" value={vehicleId} options={vehicles.map(v=>({value:v.id,label:`${v.year} ${v.make} ${v.model}`,sublabel:v.registration}))} onChange={(id)=>{if(!busy){setVehicleId(id);setConfirmed(false);}}} />
 <Field label="PSI job reference"><FormInput editable={!busy} value={reference} onChangeText={v=>{setReference(v);setConfirmed(false);}} placeholder="PSI-2026-0123" /></Field>
 <Field label="Record title"><FormInput editable={!busy} value={title} onChangeText={v=>{setTitle(v);setConfirmed(false);}} placeholder="Major service · workshop photographs" /></Field>
 <Field label="Job date · DD/MM/YYYY"><FormInput editable={!busy} value={date} onChangeText={v=>{setDate(v);setConfirmed(false);}} /></Field>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{VAULT_KINDS.map(k=><Pressable key={k} disabled={busy} style={[s.choice,k===kind&&s.chosen]} onPress={()=>{setKind(k);setFiles([]);setConfirmed(false);}}><Text style={s.choiceText}>{VAULT_LABELS[k]}</Text></Pressable>)}</View>
 {kind==='media'||kind==='dyno'?<View style={s.row}>{(['before','progress','after'] as const).map(p=><Pressable key={p} disabled={busy} style={[s.choice,p===phase&&s.chosen]} onPress={()=>{setPhase(p);setConfirmed(false);}}><Text style={s.choiceText}>{p==='progress'&&kind==='dyno'?'Baseline':p}</Text></Pressable>)}</View>:null}
 {kind==='dyno'?<><Field label="Power · HP at hubs (optional)"><FormInput editable={!busy} value={power} onChangeText={v=>{setPower(v);setConfirmed(false);}} keyboardType="decimal-pad" /></Field><Field label="Torque · Nm at hubs (optional)"><FormInput editable={!busy} value={torque} onChangeText={v=>{setTorque(v);setConfirmed(false);}} keyboardType="decimal-pad" /></Field></>:null}
 <Field label="Workshop notes"><FormInput editable={!busy} value={notes} onChangeText={v=>{setNotes(v);setConfirmed(false);}} multiline /></Field>
 <PrimaryButton disabled={busy} label={kind==='dyno'||kind==='invoice'?'Choose PDFs':'Choose photos or documents'} variant="outline" onPress={()=>void selectFiles()} />
 <Text style={s.muted}>{files.length} files selected. Photos are compressed and thumbnails generated automatically. Original PDFs are retained.</Text>
 <Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmed}} disabled={busy} onPress={()=>setConfirmed(v=>!v)}><Text style={s.copy}>{confirmed?'☑':'☐'} I checked the customer, registration and job. These files belong to this vehicle.</Text></Pressable>
 <PrimaryButton disabled={!confirmed||busy||!vehicleId} label="Publish to vehicle vault" loading={busy} onPress={()=>void publish()} />
 {Platform.OS==='web'?<PrimaryButton disabled={!confirmed||busy||!vehicleId} label="Download verified PC folder manifest" variant="outline" onPress={()=>void downloadManifest()} />:null}
 <PrimaryButton disabled={!confirmed||busy||!customerId} label="Grant this customer 30 days of beta access" variant="outline" onPress={async()=>{setBusy(true);try{const {error}=await vaultClient().rpc('grant_performance_beta',{p_customer_id:customerId,p_days:30});setMessage(error?'Only the verified PSI owner can grant beta access.':'30 days of complimentary Performance+ access granted. No payment taken.');}finally{setBusy(false);}}} />
 <PrimaryButton label="Review imports and unfinished drafts" variant="outline" onPress={()=>void review()} />
 {imports.map(item=><View key={item.id}><Text style={s.copy}>{item.source} · {item.source_key}</Text><Text style={s.muted}>{item.reason}</Text></View>)}
 {drafts.map(item=><View key={item.id}><Text style={s.copy}>{item.title}</Text><Text style={s.muted}>Unpublished draft · {item.id}</Text></View>)}
 {message?<Text accessibilityRole="alert" style={s.notice}>{message}</Text>:null}
 </View>;
}
