import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import { StaffRecordPublisher, type StaffRecordType } from '@/components/staff-record-publisher';
import { StaffVaultPublisher } from '@/components/staff-vault-publisher';
import { colors, spacing } from '@/constants/brand';
import type { VaultKind } from '@/lib/performance-plus';
import type { StaffPortalSnapshot } from '@/lib/staff-portal';

type Category = 'service' | 'recommendation' | 'dyno' | 'invoice' | 'media' | 'document' | 'modification';
type Destination = { legacy: StaffRecordType; vault?: never } | { vault: VaultKind; legacy?: never };
const categories: { id: Category; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'service', title: 'Service & repairs', icon: 'construct-outline' },
  { id: 'recommendation', title: 'Recommended work', icon: 'alert-circle-outline' },
  { id: 'invoice', title: 'Invoice', icon: 'receipt-outline' },
  { id: 'media', title: 'Workshop photos', icon: 'images-outline' },
  { id: 'dyno', title: 'Dyno result', icon: 'speedometer-outline' },
  { id: 'document', title: 'Documents', icon: 'documents-outline' },
  { id: 'modification', title: 'Build history', icon: 'hammer-outline' },
];
const formats: Partial<Record<Category, { title: string; description: string; destination: Destination }[]>> = {
  service: [
    { title: 'Service details', description: 'Service, repair or inspection notes and kilometres.', destination: { legacy: 'repair' } },
    { title: 'Service files', description: 'Job documents in the Performance+ service vault.', destination: { vault: 'service' } },
  ],
  invoice: [
    { title: 'Invoice details & PDF', description: 'Invoice number, AUD amount and a PDF.', destination: { legacy: 'invoice' } },
    { title: 'Job invoice files', description: 'A batch of PDFs linked to one workshop job.', destination: { vault: 'invoice' } },
  ],
  dyno: [
    { title: 'Verified dyno result', description: 'Power, torque and a PDF in the vehicle’s dyno record.', destination: { legacy: 'dyno' } },
    { title: 'Job dyno reports', description: 'Before, baseline or after PDFs in the Performance+ vault.', destination: { vault: 'dyno' } },
  ],
};

export function StaffRecordWorkflow({ snapshot, customerId, vehicleId, onDirtyChange, onBusyChange }: {
  snapshot: StaffPortalSnapshot;
  customerId?: string;
  vehicleId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const dirtyChanged = useCallback((value: boolean) => { setDirty(value); onDirtyChange?.(value); }, [onDirtyChange]);
  const busyChanged = useCallback((value: boolean) => { setBusy(value); onBusyChange?.(value); }, [onBusyChange]);
  const chooseCategory = (value: Category) => {
    setCategory(value);
    if (value === 'recommendation') setDestination({ legacy: 'recommendation' });
    else if (value === 'media' || value === 'document' || value === 'modification') setDestination({ vault: value });
  };
  const goBack = () => {
    if (busy) return;
    if (destination && category && formats[category]) setDestination(null);
    else { setDestination(null); setCategory(null); }
    dirtyChanged(false);
    setDiscardOpen(false);
  };
  const selectedTitle = destination && category
    ? formats[category]?.find(option => option.destination.legacy === destination.legacy && option.destination.vault === destination.vault)?.title ?? categories.find(option => option.id === category)?.title
    : categories.find(option => option.id === category)?.title;

  return <View style={styles.stack}>
    {category ? <View style={styles.heading}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to record choices" disabled={busy} onPress={() => dirty ? setDiscardOpen(true) : goBack()} style={styles.back}>
        <Ionicons color={colors.accent} name="arrow-back" size={20} />
        <Text style={styles.backText}>{destination && formats[category] ? 'Options' : 'Record types'}</Text>
      </Pressable>
      <Text style={styles.title}>{selectedTitle}</Text>
    </View> : <Text style={styles.muted}>What would you like to add?</Text>}
    {!category ? categories.map(option => <Row key={option.id} icon={option.icon} title={option.title} onPress={() => chooseCategory(option.id)} />) : null}
    {category && !destination ? formats[category]?.map(option => <Row key={option.title} title={option.title} description={option.description} icon="document-text-outline" onPress={() => setDestination(option.destination)} />) : null}
    {destination?.legacy ? <StaffRecordPublisher key={`legacy:${destination.legacy}`} fixedType={destination.legacy} initialCustomerId={customerId} initialVehicleId={vehicleId} onBusyChange={busyChanged} onDirtyChange={dirtyChanged} snapshot={snapshot} /> : null}
    {destination?.vault ? <StaffVaultPublisher key={`vault:${destination.vault}`} fixedKind={destination.vault} initialCustomerId={customerId} initialVehicleId={vehicleId} onBusyChange={busyChanged} onDirtyChange={dirtyChanged} snapshot={snapshot} /> : null}
    <Modal animationType="fade" transparent visible={discardOpen} onRequestClose={() => setDiscardOpen(false)}>
      <View style={styles.backdrop}><ScrollView contentContainerStyle={styles.modalScroll}><View accessibilityViewIsModal style={styles.modalCard}>
        <Text style={styles.title}>Discard this draft?</Text>
        <Text style={styles.muted}>Your entered details and selected files have not been published.</Text>
        <PrimaryButton label="Keep editing" onPress={() => setDiscardOpen(false)} />
        <PrimaryButton label="Discard changes" variant="outline" onPress={goBack} />
      </View></ScrollView></View>
    </Modal>
  </View>;
}

function Row({ title, description, icon, onPress }: { title: string; description?: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={styles.icon}><Ionicons color={colors.accent} name={icon} size={22} /></View>
    <View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text>{description ? <Text style={styles.muted}>{description}</Text> : null}</View>
    <Ionicons color={colors.accent} name="chevron-forward" size={19} />
  </Pressable>;
}
const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  heading: { gap: spacing.sm },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.sm, minHeight: 44 },
  backText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  title: { color: colors.white, fontSize: 20, fontWeight: '800', flexShrink: 1 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  row: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 66 },
  pressed: { backgroundColor: colors.panelRaised },
  icon: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: colors.white, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center' },
  modalScroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: colors.panel, borderRadius: 14, padding: spacing.lg, gap: spacing.md },
});
