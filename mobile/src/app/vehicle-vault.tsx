import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { PrivateVaultThumbnail } from '@/components/private-vault-thumbnail';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { loadVaultAssets, loadVaultOverview, loadVaultRecords, REPORT_KINDS, REPORT_LABELS, type VaultAsset, type ReportKind, type VaultRecord } from '@/lib/performance-plus';
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

type VaultEntry = { key: string; primary: VaultRecord; records: VaultRecord[] };

function groupVaultEntries(records: VaultRecord[], filter: ReportKind | null): VaultEntry[] {
  const entries: VaultEntry[] = [];
  const mediaGroups = new Map<string, VaultEntry>();
  for (const record of records) {
    if (filter && record.kind !== filter) continue;
    if (record.kind !== 'media') {
      entries.push({ key: record.id, primary: record, records: [record] });
      continue;
    }
    const groupKey = `media:${record.job_id || record.occurred_on || record.id}`;
    const existing = mediaGroups.get(groupKey);
    if (existing) existing.records.push(record);
    else {
      const entry = { key: groupKey, primary: record, records: [record] };
      mediaGroups.set(groupKey, entry);
      entries.push(entry);
    }
  }
  return entries;
}

export default function VehicleVault() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useCustomerAuth();
  const { vehicleId = '', kind } = useLocalSearchParams<{ vehicleId?: string; kind?: string }>();
  const filter = REPORT_KINDS.includes(kind as ReportKind) ? kind as ReportKind : null;
  const demo = !CUSTOMER_AUTH.enabled;
  const key = `${auth.user?.id}:${vehicleId}`;
  const [loaded, setLoaded] = useState<{ key: string; records: VaultRecord[]; locked: boolean; expiresAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [opened, setOpened] = useState<{ key: string; assets: VaultAsset[] } | null>(null);
  const [loadingEntry, setLoadingEntry] = useState('');
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
  const openEntry = async (entry: VaultEntry) => {
    if (demo) { setError('This is a sample record. Actual PDFs and workshop photos appear here when PSI publishes them to your vehicle.'); return; }
    if (opened?.key === entry.key) { setOpened(null); return; }
    setLoadingEntry(entry.key);
    try {
      const batches = await Promise.all(entry.records.map(record => loadVaultAssets(record.id)));
      const assets = batches.flat();
      setOpened({ key: entry.key, assets });
      if (!assets.length) setError('No files are attached to this record yet.'); else setError('');
    } catch { setError('Files could not be loaded. Refresh your subscription status and try again.'); }
    finally { setLoadingEntry(''); }
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
  const entries = groupVaultEntries(records, filter);
  return <SafeAreaView style={s.screen}><ScrollView contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={s.link}>‹ Back to reports</Text></Pressable>
    <Text style={s.eyebrow}>PSI PERFORMANCE+</Text><Text style={s.title}>{filter ? REPORT_LABELS[filter] : 'Your vehicle history'}</Text>
    <Text style={s.copy}>{demo ? 'Sample history · fictional records for exploring Performance+.' : 'Your PSI workshop record, organised by date. Private to your account.'}</Text>
    {locked ? <View style={s.pricing}><Text style={s.pricingEyebrow}>CURRENT PLAN · PSI FREE</Text><Text style={s.section}>Performance+ records locked</Text><Text style={s.copy}>Repair history, recommendations, dyno results, invoices, photos and files require Performance+. Your vehicle details, service dates, kilometres, bookings, reminders and customer notes stay free. Original invoices are still emailed normally.</Text><PrimaryButton label="Explore Performance+" onPress={() => router.replace({ pathname: '/performance-plus', params: { vehicleId } })} /></View> : null}
    {!demo && !loaded && !error && auth.status === 'signed_in' ? <ActivityIndicator /> : null}
    {!demo && auth.status !== 'signed_in' ? <PrimaryButton label="Sign in to your account" onPress={() => router.push('/account')} /> : null}
    {entries.map(entry => {
      const record = entry.primary;
      const isGallery = record.kind === 'media';
      const expanded = opened?.key === entry.key;
      const photoCount = expanded ? opened.assets.filter(asset => asset.mime_type.startsWith('image/')).length : entry.records.length;
      return <View key={entry.key} style={[isGallery ? galleryStyles.group : s.pricing, { borderLeftWidth: 3, borderLeftColor: '#65CFF8' }]}>
      <Text style={s.eyebrow}>{new Date(`${record.occurred_on.slice(0, 10)}T12:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</Text>
      <Text style={s.muted}>{record.source === 'customer_entry' ? 'Customer-supplied · unverified' : 'PSI workshop record · read-only'}</Text>
      <Text style={s.section}>{isGallery ? 'Workshop photos' : record.title}</Text>
      {isGallery ? <Text style={s.copy}>{photoCount} {photoCount === 1 ? 'photo' : 'photos'} from this workshop visit</Text> : <Text style={s.copy}>{record.notes}</Text>}
      {record.power_kw ? <Text style={s.copy}>{Math.round(record.power_kw * 1.34102209)} HP at hubs{record.torque_nm ? ` · ${record.torque_nm} Nm at hubs` : ''}</Text> : null}
      {!record.id.startsWith('repair:') && !record.id.startsWith('recommendation:') ? isGallery
        ? <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Close' : 'Open'} workshop gallery with ${photoCount} photos`} onPress={() => void openEntry(entry)} style={({ pressed }) => [galleryStyles.toggle, pressed && { opacity: .78 }]}>
          <View style={galleryStyles.toggleCopy}><Ionicons name="images-outline" color="#65CFF8" size={21} /><Text style={galleryStyles.toggleText}>{expanded ? 'Hide photos' : `View all ${photoCount} photos`}</Text></View>
          {loadingEntry === entry.key ? <ActivityIndicator color="#65CFF8" /> : <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} color="#65CFF8" size={20} />}
        </Pressable>
        : <PrimaryButton label={record.kind === 'dyno' ? 'Open dyno files' : 'View attached files'} variant="outline" onPress={() => void openEntry(entry)} /> : null}
      {expanded ? <View style={galleryStyles.thumbnails}>{opened.assets.map(asset => asset.mime_type.startsWith('image/') ? <PrivateVaultThumbnail compact key={asset.id} asset={asset} onOpen={() => void openAsset(asset)} /> : <PrimaryButton key={asset.id} label={`PDF · ${asset.caption || 'Workshop file'}`} onPress={() => void openAsset(asset)} variant="outline" />)}</View> : null}
    </View>})}
    {!locked && loaded?.key === key && !records.length ? <Text style={s.copy}>Your archive is ready. Records appear here when PSI publishes workshop work for this vehicle.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={s.notice}>{error}</Text> : null}
    <PrimaryButton label="Refresh records" variant="outline" onPress={() => { setError(''); setRevision(v => v + 1); }} />
  </ScrollView><Modal animationType="fade" presentationStyle="overFullScreen" visible={!locked && image?.key === key && (!CUSTOMER_AUTH.enabled || auth.status === 'signed_in')} onRequestClose={() => setImage(null)}><View accessibilityViewIsModal style={[viewerStyles.screen, { paddingTop: Math.max(insets.top + 10, Platform.OS === 'ios' ? 54 : 18), paddingBottom: Math.max(insets.bottom, 16) }]}><Pressable accessibilityLabel="Back to vehicle record" accessibilityRole="button" onPress={() => setImage(null)} style={viewerStyles.back}><Text style={viewerStyles.backText}>‹ Back to vehicle record</Text></Pressable>{image?.key === key ? <Image accessibilityLabel="Private vehicle record attachment" source={{ uri: image.url }} resizeMode="contain" style={viewerStyles.image} /> : null}<PrimaryButton label="Close photo" onPress={() => setImage(null)} /></View></Modal></SafeAreaView>;
}

const viewerStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050505', paddingHorizontal: 16, gap: 10 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#65CFF8', backgroundColor: '#050505', paddingHorizontal: 14 },
  backText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  image: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: '#050505' },
});

const galleryStyles = StyleSheet.create({
  group: { backgroundColor: '#111111', borderColor: '#30343A', borderWidth: 1, borderRadius: 8, padding: 16, gap: 10 },
  toggle: { minHeight: 52, borderTopWidth: 1, borderTopColor: '#30343A', paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleText: { color: '#65CFF8', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .35 },
  thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
});
