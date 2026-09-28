import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrivateVaultThumbnail } from '@/components/private-vault-thumbnail';
import { PrimaryButton } from '@/components/ui';
import { CustomerVehicleNotes } from '@/components/customer-vehicle-notes';
import { colors, spacing } from '@/constants/brand';
import { loadVaultAssets, loadVaultRecords, recordMatchesReportSection, reportSectionCount, REPORT_KINDS, REPORT_LABELS, type ReportKind, type ReportSection, type VaultAsset, type VaultRecord } from '@/lib/performance-plus';
import { getSupabaseClient } from '@/lib/supabase';

type HistoryEntry = { key: string; primary: VaultRecord; records: VaultRecord[] };

const ATTACHMENT_KINDS = new Set<ReportKind>(['media', 'dyno', 'invoice', 'modification', 'document']);

function groupHistoryEntries(records: VaultRecord[], section: ReportSection): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const visitGroups = new Map<string, HistoryEntry>();
  for (const record of records) {
    if (!recordMatchesReportSection(record.kind, section)) continue;
    const groupByVisit = record.kind === 'media' || Boolean(record.job_id && ATTACHMENT_KINDS.has(record.kind));
    if (!groupByVisit) {
      entries.push({ key: record.id, primary: record, records: [record] });
      continue;
    }
    const key = `${record.kind}:${record.job_id || record.occurred_on || record.id}`;
    const existing = visitGroups.get(key);
    if (existing) existing.records.push(record);
    else {
      const entry = { key, primary: record, records: [record] };
      visitGroups.set(key, entry);
      entries.push(entry);
    }
  }
  return entries;
}

// Only mounted inside the MFA-protected staff portal. RLS independently checks staff access.
export function StaffVehicleHistory({ vehicleId, previewMode = false }: { vehicleId: string; previewMode?: boolean }) {
  const [section, setSection] = useState<ReportSection | 'notes' | null>(null);
  const [records, setRecords] = useState<VaultRecord[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ key: string; assets: VaultAsset[] } | null>(null);
  const [galleryAssets, setGalleryAssets] = useState<{ key: string; values: Record<string, VaultAsset[]> } | null>(null);
  const [loadingEntry, setLoadingEntry] = useState('');
  const galleryKey = `${vehicleId}:${revision}`;
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
  useEffect(() => {
    if (previewMode || section !== 'media' || !records) return;
    let active = true;
    const galleries = groupHistoryEntries(records, 'media');
    void Promise.all(galleries.map(async entry => {
      const batches = await Promise.all(entry.records.map(record => loadVaultAssets(record.id)));
      return [entry.key, batches.flat()] as const;
    })).then(values => {
      if (active) setGalleryAssets({ key: galleryKey, values: Object.fromEntries(values) });
    }).catch(() => {
      if (active) setError('Photo thumbnails could not be loaded. Refresh vehicle history and try again.');
    });
    return () => { active = false; };
  }, [galleryKey, previewMode, records, section]);
  const copy = { color: colors.silver, fontSize: 15, lineHeight: 23 };
  const entries = section && section !== 'notes' && records ? groupHistoryEntries(records, section) : [];
  const openEntry = async (entry: HistoryEntry) => {
    if (opened?.key === entry.key) { setOpened(null); return; }
    setOpened(null);
    setLoadingEntry(entry.key);
    try {
      const cachedGallery = entry.primary.kind === 'media' && galleryAssets?.key === galleryKey ? galleryAssets.values[entry.key] : undefined;
      const assets = cachedGallery ?? (await Promise.all(entry.records.map(record => loadVaultAssets(record.id)))).flat();
      setOpened({ key: entry.key, assets });
      setError(assets.length ? '' : 'No files attached to this record.');
    } catch {
      setError('Files could not be loaded. Check your staff session.');
    } finally {
      setLoadingEntry('');
    }
  };
  const openAsset = async (file: VaultAsset) => {
    try {
      const { data, error: accessError } = await getSupabaseClient().functions.invoke('open-vault-file', {
        body: file.id.startsWith('legacy:') ? { legacyFileId: file.id.slice(7) } : { assetId: file.id },
      });
      if (accessError || !data?.url) throw new Error('access');
      if (file.mime_type === 'application/pdf') await Linking.openURL(data.url);
      else setImage(data.url);
    } catch {
      setError('This attachment could not be opened. Check your staff session.');
    }
  };
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
      <PrimaryButton label="Back to history categories" variant="outline" onPress={() => { setSection(null); setOpened(null); setImage(null); setError(''); }} />
      {section === 'notes' ? <CustomerVehicleNotes key={vehicleId} vehicleId={vehicleId} readOnly previewMode={previewMode} /> : <>
        <Text style={{ color: colors.white, fontSize: 18, fontWeight: '700' }}>{REPORT_LABELS[section]}</Text>
        {previewMode ? <Text style={copy}>Open the signed-in portal to view saved customer records.</Text> : !records && !error ? <ActivityIndicator color={colors.accent} /> : null}
        {entries.map(entry => {
          const record = entry.primary;
          const expanded = opened?.key === entry.key;
          const attachmentKind = ATTACHMENT_KINDS.has(record.kind);
          const isGallery = record.kind === 'media';
          const cachedGallery = isGallery && galleryAssets?.key === galleryKey ? galleryAssets.values[entry.key] : undefined;
          const fileCount = expanded ? opened?.assets.length ?? entry.records.length : cachedGallery?.length ?? entry.records.length;
          const visibleAssets = isGallery
            ? expanded ? opened?.assets ?? [] : (cachedGallery ?? []).slice(0, 3)
            : expanded ? opened?.assets ?? [] : [];
          const displayTitle = isGallery ? 'Workshop photos' : record.kind === 'document' || record.kind === 'modification' ? 'Documents & DTCs' : record.title;
          const actionLabel = isGallery
            ? expanded ? 'Hide photos' : `View all ${fileCount} ${fileCount === 1 ? 'photo' : 'photos'}`
            : expanded ? 'Hide attached files' : record.kind === 'invoice' ? 'View invoice' : record.kind === 'dyno' ? 'View dyno files' : 'View attached files';
          return <View key={entry.key} style={styles.recordCard}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '800' }}>{record.source === 'customer_entry' ? 'CUSTOMER-SUPPLIED · UNVERIFIED' : 'PSI WORKSHOP RECORD · READ-ONLY'}</Text>
          <Text style={{ color: colors.white, fontWeight: '800', fontSize: 17 }}>{displayTitle}</Text>
          <Text style={copy}>{record.occurred_on.slice(0, 10)}</Text>
          {isGallery ? <Text style={copy}>{fileCount} {fileCount === 1 ? 'photo' : 'photos'} from this workshop visit</Text> : record.notes ? <Text selectable style={copy}>{record.notes}</Text> : null}
          {record.power_kw != null ? <Text style={copy}>{Math.round(record.power_kw * 1.34102209)} HP at hubs · {record.torque_nm ?? '—'} Nm</Text> : null}
          {isGallery && !cachedGallery && !expanded ? <View style={styles.thumbnailLoading}><ActivityIndicator color={colors.accent} /><Text style={styles.thumbnailLoadingText}>Loading photo thumbnails…</Text></View> : null}
          {visibleAssets.length ? <View style={styles.attachments}>{visibleAssets.map(file => file.mime_type.startsWith('image/')
            ? <PrivateVaultThumbnail compact asset={file} key={file.id} onOpen={() => void openAsset(file)} />
            : <PrimaryButton key={file.id} label={file.caption || 'Open attachment'} onPress={() => void openAsset(file)} variant="outline" />)}</View> : null}
          {attachmentKind ? <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} accessibilityState={{ expanded }} onPress={() => void openEntry(entry)} style={({ pressed }) => [styles.attachmentToggle, pressed && styles.pressed]}>
            <View style={styles.attachmentToggleCopy}><Ionicons color={colors.accent} name={isGallery ? 'images-outline' : record.kind === 'invoice' ? 'receipt-outline' : 'documents-outline'} size={21} /><Text style={styles.attachmentToggleText}>{actionLabel}</Text></View>
            {loadingEntry === entry.key ? <ActivityIndicator color={colors.accent} /> : <Ionicons color={colors.accent} name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />}
          </Pressable> : null}
        </View>; })}
        {records && !entries.length ? <Text style={copy}>No records in this category yet.</Text> : null}
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
  attachmentToggle: { minHeight: 52, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  attachmentToggleCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  attachmentToggleText: { color: colors.accent, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .35 },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  thumbnailLoading: { minHeight: 72, borderRadius: 8, backgroundColor: colors.inkSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  thumbnailLoadingText: { color: colors.silver, fontSize: 13, fontWeight: '700' },
  pressed: { backgroundColor: colors.panelRaised },
});
