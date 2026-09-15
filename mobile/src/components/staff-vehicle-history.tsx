import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { CustomerVehicleNotes } from '@/components/customer-vehicle-notes';
import { colors } from '@/constants/brand';
import { loadVaultAssets, loadVaultRecords, REPORT_KINDS, REPORT_LABELS, type ReportKind, type VaultRecord } from '@/lib/performance-plus';
import { getSupabaseClient } from '@/lib/supabase';

// Only mounted inside the MFA-protected staff portal. RLS independently checks staff access.
export function StaffVehicleHistory({ vehicleId, previewMode = false }: { vehicleId: string; previewMode?: boolean }) {
  const [section, setSection] = useState<ReportKind | 'notes' | null>(null);
  const [records, setRecords] = useState<VaultRecord[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [files, setFiles] = useState<Awaited<ReturnType<typeof loadVaultAssets>>>([]);
  useEffect(() => {
    if (previewMode || !section || section === 'notes') return;
    let active = true;
    loadVaultRecords(vehicleId).then(value => { if (active) { setRecords(value); setError(''); } })
      .catch(() => { if (active) setError('Vehicle history could not be loaded. Check your staff session and refresh.'); });
    return () => { active = false; };
  }, [vehicleId, previewMode, section, revision]);
  useEffect(() => {
    if (!image) return;
    const timer = setTimeout(() => setImage(null), 60000);
    return () => clearTimeout(timer);
  }, [image]);
  const copy = { color: colors.silver, fontSize: 15, lineHeight: 23 };
  return <View style={{ gap: 14 }}>
    <Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>View vehicle history</Text>
    <Text style={copy}>PSI can read workshop records regardless of the customer’s subscription. Customer notes are separately labelled and unverified.</Text>
    {!section ? <>
      <PrimaryButton label="Customer notes · unverified" variant="outline" onPress={() => setSection('notes')} />
      {REPORT_KINDS.map(kind => <PrimaryButton key={kind} label={REPORT_LABELS[kind]} variant="outline" onPress={() => setSection(kind)} />)}
    </> : <>
      <PrimaryButton label="Back to history categories" variant="outline" onPress={() => { setSection(null); setFiles([]); setImage(null); setError(''); }} />
      {section === 'notes' ? <CustomerVehicleNotes key={vehicleId} vehicleId={vehicleId} readOnly previewMode={previewMode} /> : <>
        <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{REPORT_LABELS[section]}</Text>
        {previewMode ? <Text style={copy}>Open the signed-in portal to view saved customer records.</Text> : !records && !error ? <ActivityIndicator color={colors.accent} /> : null}
        {records?.filter(record => record.kind === section).map(record => <View key={record.id} style={{ borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 }}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>{record.source === 'customer_entry' ? 'CUSTOMER-SUPPLIED · UNVERIFIED' : 'PSI WORKSHOP RECORD · READ-ONLY'}</Text>
          <Text style={{ color: colors.white, fontWeight: '800', fontSize: 17 }}>{record.title}</Text>
          <Text style={copy}>{record.occurred_on.slice(0, 10)}</Text><Text selectable style={copy}>{record.notes}</Text>
          {record.power_kw != null ? <Text style={copy}>{Math.round(record.power_kw * 1.34102209)} HP at hubs · {record.torque_nm ?? '—'} Nm</Text> : null}
          <PrimaryButton label="View attached files" variant="outline" onPress={() => {
            void loadVaultAssets(record.id).then(value => { setFiles(value); setError(value.length ? '' : 'No files attached to this record.'); }).catch(() => setError('Files could not be loaded.'));
          }} />
        </View>)}
        {records && !records.some(record => record.kind === section) ? <Text style={copy}>No records in this category yet.</Text> : null}
        {files.map(file => <PrimaryButton key={file.id} label={file.caption || 'Open attachment'} onPress={() => {
          void (async () => {
            const { data, error: accessError } = await getSupabaseClient().functions.invoke('open-vault-file', {
              body: file.id.startsWith('legacy:') ? { legacyFileId: file.id.slice(7) } : { assetId: file.id },
            });
            if (accessError || !data?.url) throw new Error('access');
            if (file.mime_type === 'application/pdf') await Linking.openURL(data.url);
            else setImage(data.url);
          })().catch(() => setError('This attachment could not be opened. Check your staff session.'));
        }} />)}
        <PrimaryButton label="Refresh history" variant="outline" onPress={() => setRevision(value => value + 1)} />
      </>}
    </>}
    {error ? <Text accessibilityRole="alert" style={copy}>{error}</Text> : null}
    <Modal visible={!!image} onRequestClose={() => setImage(null)}>
      <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: colors.ink }}>
        <PrimaryButton label="Back to vehicle history" onPress={() => setImage(null)} />
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{image ? <Image source={{ uri: image }} resizeMode="contain" style={{ flex: 1, minHeight: 400 }} /> : null}</ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}
