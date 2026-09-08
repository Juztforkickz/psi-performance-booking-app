import { useEffect, useState, useSyncExternalStore } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/brand';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { vaultClient } from '@/lib/performance-plus';

export const GARAGE_ART = [
 { id: 'porsche', label: 'Porsche 911', source: require('../../assets/images/garage-vehicles/porsche.jpg') },
 { id: 'hsv-gts', label: 'HSV GTS', source: require('../../assets/images/garage-vehicles/hsv-gts.jpg') },
 { id: 'ford-fpv', label: 'Ford FPV', source: require('../../assets/images/garage-vehicles/ford-fpv.jpg') },
 { id: 'toyota-supra', label: 'Toyota Supra', source: require('../../assets/images/garage-vehicles/toyota-supra.jpg') },
 { id: 'mclaren', label: 'McLaren', source: require('../../assets/images/garage-vehicles/mclaren.jpg') },
 { id: 'nissan-skyline', label: 'Nissan Skyline', source: require('../../assets/images/garage-vehicles/nissan-skyline.jpg') },
 { id: 'ford-escort', label: 'Ford Escort', source: require('../../assets/images/garage-vehicles/ford-escort.jpg') },
 { id: 'holden-torana', label: 'Holden Torana', source: require('../../assets/images/garage-vehicles/holden-torana.jpg') },
 { id: 'honda-nsx', label: 'Honda NSX', source: require('../../assets/images/garage-vehicles/honda-nsx.jpg') },
 { id: 'subaru-wrx', label: 'Subaru WRX', source: require('../../assets/images/garage-vehicles/subaru-wrx.jpg') },
 { id: 'chevrolet-impala', label: 'Chevrolet Impala', source: require('../../assets/images/garage-vehicles/chevrolet-impala.jpg') },
 { id: 'corvette', label: 'Corvette', source: require('../../assets/images/garage-vehicles/corvette.jpg') },
 { id: 'ford-mustang', label: 'Ford Mustang', source: require('../../assets/images/garage-vehicles/ford-mustang.jpg') },
 { id: 'chevrolet-camaro', label: 'Chevrolet Camaro', source: require('../../assets/images/garage-vehicles/chevrolet-camaro.jpg') },
 { id: 'bmw-m3', label: 'BMW M3', source: require('../../assets/images/garage-vehicles/bmw-m3.jpg') },
 { id: 'mercedes-amg', label: 'Mercedes-AMG', source: require('../../assets/images/garage-vehicles/mercedes-amg.jpg') },
 { id: 'audi-rs', label: 'Audi RS', source: require('../../assets/images/garage-vehicles/audi-rs.jpg') },
 { id: 'mitsubishi-evo', label: 'Mitsubishi Evo', source: require('../../assets/images/garage-vehicles/mitsubishi-evo.jpg') },
 { id: 'mazda-rx7', label: 'Mazda RX-7', source: require('../../assets/images/garage-vehicles/mazda-rx7.jpg') },
 { id: 'holden-monaro', label: 'Holden Monaro', source: require('../../assets/images/garage-vehicles/holden-monaro.jpg') },
];
const previewChoices: Record<string,string> = {};
let artworkRevision = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useGarageArtwork(vehicleId: string) {
 const revision = useSyncExternalStore(subscribe, () => artworkRevision, () => 0);
 const auth = useCustomerAuth();
 const key = `${auth.user?.id ?? 'demo'}:${vehicleId}`;
 const [choice, setChoice] = useState<{key:string; id:string} | null>(null);
 const [error, setError] = useState('');
 useEffect(() => {
  if (!CUSTOMER_AUTH.enabled) return;
  if (auth.status !== 'signed_in') return;
  let live=true;
  vaultClient().from('vehicle_display_preferences').select('*').eq('vehicle_id',vehicleId).maybeSingle().then(({data,error})=>{if(live && !error) setChoice({key,id:data?.illustration_id ?? 'porsche'});});
  return ()=>{live=false;};
 },[key,vehicleId,auth.status,revision]);
 const id = !CUSTOMER_AUTH.enabled ? previewChoices[vehicleId] ?? 'porsche' : choice?.key===key ? choice.id : 'porsche';
 const select = async (id: string) => {
  if (!GARAGE_ART.some(a=>a.id===id)) return;
  setError('');
  if (CUSTOMER_AUTH.enabled) {
   if (!auth.user) return;
   const {error} = await vaultClient().from('vehicle_display_preferences').upsert({vehicle_id:vehicleId,customer_id:auth.user.id,illustration_id:id});
   if (error) {setError('The illustration could not be saved. Please try again.');return;}
  } else previewChoices[vehicleId]=id;
  setChoice({key,id});
  artworkRevision += 1; listeners.forEach(listener => listener());
 };
 return { art: GARAGE_ART.find(a=>a.id===id) ?? GARAGE_ART[0], select, error };
}
export function GarageArtworkPicker({ selectedId, onSelect }: { selectedId:string; onSelect:(id:string)=>Promise<void> }) {
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 return <><PrimaryButton label="Choose vehicle illustration" variant="outline" onPress={()=>setOpen(true)} />
 <Modal visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}><SafeAreaView style={st.screen}><ScrollView contentContainerStyle={st.content}>
 <Text style={st.title}>Choose your garage car</Text><Text style={st.copy}>One consistent silver finish. Your vehicle details stay the same. Remove your uploaded photo to display the illustration.</Text>
 <PrimaryButton label="Done" onPress={()=>setOpen(false)} />
 <View style={st.grid}>{GARAGE_ART.map(art=><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={art.label} accessibilityState={{selected:selectedId===art.id}} key={art.id} style={[st.card,selectedId===art.id&&st.selected]} onPress={async()=>{setBusy(true);try{await onSelect(art.id);}finally{setBusy(false);}}}><View style={st.frame}><Image source={art.source} resizeMode="cover" style={st.image}/></View><Text style={st.label}>{selectedId===art.id?'✓ ':''}{art.label}</Text></Pressable>)}</View>
 </ScrollView></SafeAreaView></Modal></>;
}
const st=StyleSheet.create({screen:{flex:1,backgroundColor:colors.ink},content:{padding:20,gap:16,maxWidth:1000,alignSelf:'center',width:'100%'},title:{color:colors.white,fontSize:26,fontWeight:'800'},copy:{color:colors.silver,fontSize:15,lineHeight:22},grid:{flexDirection:'row',flexWrap:'wrap',gap:12},card:{flexBasis:'46%',flexGrow:1,borderWidth:1,borderColor:colors.line,borderRadius:6,overflow:'hidden',backgroundColor:'#101010'},selected:{borderColor:colors.accent,borderWidth:2},frame:{aspectRatio:16/9,overflow:'hidden'},image:{width:'100%',height:'222%',position:'absolute',top:'-70%'},label:{color:colors.silver,padding:12,fontSize:14,fontWeight:'700'}});
