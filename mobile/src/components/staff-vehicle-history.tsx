import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { CustomerVehicleNotes } from '@/components/customer-vehicle-notes';
import { colors, spacing } from '@/constants/brand';
import { loadVaultAssets, loadVaultRecords, recordMatchesReportSection, reportSectionCount, REPORT_KINDS, REPORT_LABELS, type ReportSection, type VaultRecord } from '@/lib/performance-plus';
import { getSupabaseClient } from '@/lib/supabase';

// Only mounted inside the MFA-protected staff portal. RLS independently checks staff access.
export function StaffVehicleHistory({ vehicleId, previewMode = false }: { vehicleId: string; previewMode?: boolean }) {
  const [section, setSection] = useState<ReportSection | 'notes' | null>(null);
  const [records, setRecords] = useState<VaultRecord[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [files, setFiles] = useState<Awaited<ReturnType<typeof loadVaultAssets>>>([]);
  useEffect(() => {
    if (previewMode) return;
    let active = true;
    loadVaultRecords(vehicleId).then(value => { if (active) { setRecords(value); setError(''); } })
      .catch(() => { if (active) setError('Vehicle history could not be loaded. Check your staff session and refresh.'); });
    return () => { active = false; };
  }, [vehicleId, previewMode, revision]);
  useEffect(() => {
    if (!image) return;
    const timer = setTimeout(() => setImage(null), 60000);
    return () => clearTimeout(timer);
  }, [image]);
  const copy = { color: colors.silver, fontSize: 15, lineHeight: 23 };
  return <View style={{ gap: 14 }}>
    <Text style={{ color: colors.white, fontSize: 18, fontWeight: '800' }}>View vehicle history</Text>
    <Text style={copy}>PSI can read workshop records regardless of the customer’s subscription. Customer notes are separately labelled and unverified.</Text>
    {!section ? <View style={styles.categoryList}>
      <HistoryCategory title="Customer notes" detail="Customer-supplied · unverified" icon="chatbox-ellipses-outline" attention onPress={() => setSection('notes')} />
      {REPORT_KINDS.map(kind => {
        const count = records ? reportSectionCount(records.reduce<Partial<Record<VaultRecord['kind'], number>>>((totals, record) => ({ ...totals, [record.kind]: (totals[record.kind] ?? 0) + 1 }), {}), kind) : null;
        return <HistoryCategory key={kind} title={REPORT_LABELS[kind]} detail={count == null ? 'Loading saved records…' : `${count} saved record${count === 1 ? '' : 's'}`} icon={HISTORY_ICONS[kind]} onPress={() => setSection(kind)} />;
      })}
    </View> : <>
      <PrimaryButton label="Back to history categories" variant="outline" onPress={() => { setSection(null); setFiles([]); setImage(null); setError(''); }} />
      {section === 'notes' ? <CustomerVehicleNotes key={vehicleId} vehicleId={vehicleId} readOnly previewMode={previewMode} /> : <>
        <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{REPORT_LABELS[section]}</Text>
        {previewMode ? <Text style={copy}>Open the signed-in portal to view saved customer records.</Text> : !records && !error ? <ActivityIndicator color={colors.accent} /> : null}
        {records?.filter(record => recordMatchesReportSection(record.kind, section)).map(record => <View key={record.id} style={styles.recordCard}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>{record.source === 'customer_entry' ? 'CUSTOMER-SUPPLIED · UNVERIFIED' : 'PSI WORKSHOP RECORD · READ-ONLY'}</Text>
          <Text style={{ color: colors.white, fontWeight: '800', fontSize: 17 }}>{record.title}</Text>
          <Text style={copy}>{record.occurred_on.slice(0, 10)}</Text><Text selectable style={copy}>{record.notes}</Text>
          {record.power_kw != null ? <Text style={copy}>{Math.round(record.power_kw * 1.34102209)} HP at hubs · {record.torque_nm ?? '—'} Nm</Text> : null}
          <PrimaryButton label="View attached files" variant="outline" onPress={() => {
            void loadVaultAssets(record.id).then(value => { setFiles(value); setError(value.length ? '' : 'No files attached to this record.'); }).catch(() => setError('Files could not be loaded.'));
          }} />
        </View>)}
        {records && !records.some(record => recordMatchesReportSection(record.kind, section)) ? <Text style={copy}>No records in this category yet.</Text> : null}
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

const HISTORY_ICONS: Record<ReportSection, keyof typeof Ionicons.glyphMap> = {
  service: 'construct-outline', recommendation: 'alert-circle-outline', dyno: 'speedometer-outline',
  invoice: 'receipt-outline', media: 'images-outline', document: 'documents-outline',
};

function HistoryCategory({ title, detail, icon, attention = false, onPress }: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; attention?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={({ pressed }) => [styles.category, attention && styles.categoryAttention, pressed && styles.pressed]}>
    <View style={[styles.categoryIcon, attention && styles.categoryIconAttention]}><Ionicons color={attention ? colors.danger : colors.accent} name={icon} size={23} /></View>
    <View style={styles.categoryCopy}><Text style={styles.categoryTitle}>{title}</Text><Text style={[styles.categoryDetail, attention && styles.categoryDetailAttention]}>{detail}</Text></View>
    <Ionicons color={colors.accent} name="chevron-forward" size={19} />
  </Pressable>;
}

const styles = StyleSheet.create({
  categoryList: { gap: 10 },
  category: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel, padding: spacing.md },
  categoryAttention: { borderLeftWidth: 4, borderLeftColor: colors.danger },
  categoryIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  categoryIconAttention: { backgroundColor: 'rgba(255,119,112,0.1)' },
  categoryCopy: { flex: 1, minWidth: 0, gap: 3 },
  categoryTitle: { color: colors.white, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  categoryDetail: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  categoryDetailAttention: { color: colors.danger, fontWeight: '700' },
  recordCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel, padding: spacing.md, gap: 10 },
  pressed: { backgroundColor: colors.panelRaised },
});
