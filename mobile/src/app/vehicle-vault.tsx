import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { PrivateVaultThumbnail } from '@/components/private-vault-thumbnail';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { loadVaultAssets, loadVaultOverview, loadVaultRecords, VAULT_KINDS, VAULT_LABELS, type VaultAsset, type VaultKind, type VaultRecord } from '@/lib/performance-plus';
import { getSupabaseClient } from '@/lib/supabase';
import { s } from './performance-plus';

const examples = [
  { id: 'example-service', kind: 'service', title: 'Major service and inspection', notes: 'Engine oil and filter renewed. Cooling system checked. Maintenance items updated.', occurred_on: '2026-08-18' },
  { id: 'example-photos', kind: 'media', title: 'Workshop gallery · before, progress and after', notes: '14 workshop photographs, organised around this visit.', occurred_on: '2026-08-18' },
  { id: 'example-invoice', kind: 'invoice', title: 'Service invoice', notes: 'The itemised workshop invoice is kept with this visit.', occurred_on: '2026-08-18' },
  { id: 'example-dyno', kind: 'dyno', title: 'Mainline hub dyno · after run', notes: 'Original PDF report and verified power and torque figures.', occurred_on: '2026-08-18', power_kw: 318, torque_nm: 684 },
  { id: 'example-build', kind: 'modification', title: 'Exhaust and intake upgrade', notes: 'PSI-installed components, workshop notes and supporting paperwork.', occurred_on: '2026-06-12' },
  { id: 'example-doc', kind: 'document', title: 'Vehicle inspection report', notes: 'Workshop documentation stored privately with the vehicle.', occurred_on: '2026-06-12' },
] as VaultRecord[];
export default function VehicleVault() {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { vehicleId = '', kind } = useLocalSearchParams<{ vehicleId?: string; kind?: string }>();
  const filter = VAULT_KINDS.includes(kind as VaultKind) ? kind as VaultKind : null;
  const demo = !CUSTOMER_AUTH.enabled;
  const key = `${auth.user?.id}:${vehicleId}`;
  const [loaded, setLoaded] = useState<{ key: string; records: VaultRecord[]; locked: boolean; expiresAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [opened, setOpened] = useState<{ key: string; assets: VaultAsset[] } | null>(null);
  const [image, setImage] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') { setNow(Date.now()); setRevision(v => v + 1); } });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!loaded?.expiresAt || loaded.locked || loaded.key !== key) return;
    const remaining = Math.max(0, Date.parse(loaded.expiresAt) - Date.now());
    const timer = setTimeout(() => {
      if (remaining > 2147483647) { setRevision(v => v + 1); return; }
      setLoaded(previous => previous?.key === key ? { ...previous, locked: true, records: [] } : previous);
      setOpened(null); setImage(null);
    }, Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [loaded, key]);
  useEffect(() => {
    if (!image) return;
    const timer = setTimeout(() => setImage(null), 60000);
    return () => clearTimeout(timer);
  }, [image]);
  useEffect(() => {
    if (demo || auth.status !== 'signed_in' || !vehicleId) return;
    let live = true;
    (async () => { const overview = await loadVaultOverview(vehicleId); const records = overview.plan === 'performance_plus' ? await loadVaultRecords(vehicleId) : []; if (live) setLoaded({ key, records, locked: overview.plan !== 'performance_plus', expiresAt: overview.expires_at }); })().catch(() => { if (live) setError('The vehicle archive could not be opened. Please try again.'); });
    return () => { live = false; };
  }, [demo, vehicleId, auth.status, key, revision]);
  const locked = !demo && loaded?.key === key && (loaded.locked || !!loaded.expiresAt && Date.parse(loaded.expiresAt) <= now);
  const records = demo ? examples : !locked && auth.status === 'signed_in' && loaded?.key === key ? loaded.records : [];
  const openRecord = async (record: VaultRecord) => {
    if (demo) { setError('This is a sample record. Actual PDFs and workshop photos appear here when PSI publishes them to your vehicle.'); return; }
    try { const assets = await loadVaultAssets(record.id); setOpened({ key, assets }); if (!assets.length) setError('No files are attached to this record yet.'); else setError(''); }
    catch { setError('Files could not be loaded. Refresh your subscription status and try again.'); }
  };
  const openAsset = async (asset: VaultAsset) => {
    try {
      // Storage RLS checks both vehicle ownership and current entitlement again.
      const { data, error: accessError } = await getSupabaseClient().functions.invoke('open-vault-file', { body: asset.id.startsWith('legacy:') ? { legacyFileId: asset.id.slice(7) } : { assetId: asset.id } });
      if (accessError || !data) throw accessError;
      if (asset.mime_type === 'application/pdf') await Linking.openURL(data.url);
      else setImage({ key, url: data.url });
    } catch { setError('This private file is unavailable. Check your subscription status and try again.'); }
  };
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={s.link}>‹ Back to your vault</Text></Pressable>
    <Text style={s.eyebrow}>PSI PERFORMANCE+</Text><Text style={s.title}>{filter ? VAULT_LABELS[filter] : 'Your vehicle history'}</Text>
    <Text style={s.copy}>{demo ? 'Sample history · fictional records for exploring Performance+.' : 'Your PSI workshop record, organised by date. Private to your account.'}</Text>
    {locked ? <View style={s.pricing}><Text style={s.pricingEyebrow}>CURRENT PLAN · PSI FREE</Text><Text style={s.section}>Performance+ archive locked</Text><Text style={s.copy}>PSI invoices, documents, workshop galleries, full dyno history, service history and modification records cannot be opened on Free. Your bookings, kilometres, current results, notifications and maintenance reminders remain available.</Text><PrimaryButton label="Compare Free and Performance+" onPress={() => router.replace({ pathname: '/performance-plus', params: { vehicleId } })} /></View> : null}
    {!demo && !loaded && !error && auth.status === 'signed_in' ? <ActivityIndicator /> : null}
    {!demo && auth.status !== 'signed_in' ? <PrimaryButton label="Sign in to your account" onPress={() => router.push('/account')} /> : null}
    {records.filter(record => !filter || record.kind === filter).map(record => <View key={record.id} style={[s.pricing, { borderLeftWidth: 3, borderLeftColor: '#65CFF8' }]}>
      <Text style={s.eyebrow}>{new Date(`${record.occurred_on}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</Text>
      <Text style={s.section}>{record.title}</Text><Text style={s.copy}>{record.notes}</Text>
      {record.power_kw ? <Text style={s.copy}>{Math.round(record.power_kw * 1.34102209)} HP at hubs{record.torque_nm ? ` · ${record.torque_nm} Nm at hubs` : ''}</Text> : null}
      <PrimaryButton label={record.kind === 'media' ? 'Open workshop gallery' : record.kind === 'dyno' ? 'Open dyno PDF' : 'View attached files'} variant="outline" onPress={() => void openRecord(record)} />
    </View>)}
    {!locked && loaded?.key === key && !records.length ? <Text style={s.copy}>Your archive is ready. Records appear here when PSI publishes workshop work for this vehicle.</Text> : null}
    {!locked && auth.status === 'signed_in' && opened?.key === key ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>{opened.assets.map(asset => asset.mime_type.startsWith('image/') ? <PrivateVaultThumbnail key={asset.id} asset={asset} onOpen={() => void openAsset(asset)} /> : <PrimaryButton key={asset.id} label={`PDF · ${asset.caption || 'Workshop file'}`} onPress={() => void openAsset(asset)} variant="outline" />)}</View> : null}
    {error ? <Text accessibilityRole="alert" style={s.notice}>{error}</Text> : null}
    <PrimaryButton label="Refresh records" variant="outline" onPress={() => { setError(''); setRevision(v => v + 1); }} />
  </ScrollView><Modal animationType="fade" presentationStyle="overFullScreen" visible={!locked && image?.key === key && (!CUSTOMER_AUTH.enabled || auth.status === 'signed_in')} onRequestClose={() => setImage(null)}><SafeAreaView accessibilityViewIsModal style={[s.screen, { backgroundColor: '#050505', padding: 16, gap: 14 }]}><Pressable accessibilityLabel="Back to vehicle record" accessibilityRole="button" onPress={() => setImage(null)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#65CFF8', backgroundColor: '#050505', paddingHorizontal: 16 }}><Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' }}>‹ Back to vehicle record</Text></Pressable>{image?.key === key ? <Image accessibilityLabel="Private vehicle record attachment" source={{ uri: image.url }} resizeMode="contain" style={{ flex: 1, width: '100%', backgroundColor: '#050505' }} /> : null}<PrimaryButton label="Close photo" onPress={() => setImage(null)} /></SafeAreaView></Modal></SafeAreaView>;
}
