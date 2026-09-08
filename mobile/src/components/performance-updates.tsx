import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { vaultClient } from '@/lib/performance-plus';
import { s } from '@/app/performance-plus';
export function PerformanceUpdates() {
 const auth=useCustomerAuth();const router=useRouter();const userId=auth.user?.id;
 const [state,setState]=useState<{userId:string;rows:{job_id:string;vehicle_id:string;record_count:number;updated_at:string}[]}|null>(null);
 useEffect(()=>{if(!CUSTOMER_AUTH.enabled||auth.status!=='signed_in'||!userId)return;let live=true;vaultClient().from('vault_updates').select('*').eq('customer_id',userId).order('updated_at',{ascending:false}).limit(10).then(({data,error})=>{if(live&&!error)setState({userId,rows:data??[]});});return()=>{live=false;};},[userId,auth.status,auth.sessionRevision]);
 if(state?.userId!==auth.user?.id||!state?.rows.length)return null;
 return <View style={s.pricing}><Text style={s.section}>Your vehicle record</Text>{state.rows.map(row=><Pressable accessibilityRole="button" key={row.job_id} onPress={()=>router.push({pathname:'/performance-plus',params:{vehicleId:row.vehicle_id}})}><Text style={s.copy}>Your PSI vehicle record has been updated.</Text><Text style={s.link}>{row.record_count} records available · {new Date(row.updated_at).toLocaleDateString('en-AU')}</Text></Pressable>)}</View>;
}
