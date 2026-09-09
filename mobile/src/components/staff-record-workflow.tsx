import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import { StaffRecordPublisher, type StaffRecordType } from '@/components/staff-record-publisher';
import { StaffVaultPublisher } from '@/components/staff-vault-publisher';
import { StaffScrollSelect } from '@/components/staff-scroll-select';
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

export function StaffRecordWorkflow({ snapshot, customerId: shortcutCustomerId, vehicleId: shortcutVehicleId, onDirtyChange, onBusyChange, onBackHandlerChange, previewMode = false }: {
  snapshot: StaffPortalSnapshot;
  customerId?: string;
  vehicleId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  onBackHandlerChange?: (handler: (() => void) | null) => void;
  previewMode?: boolean;
}) {
  const [customerId, setCustomerId] = useState(() => snapshot.customers.some(customer => customer.user_id === shortcutCustomerId) ? shortcutCustomerId! : '');
  const [vehicleId, setVehicleId] = useState(() => snapshot.vehicles.some(vehicle => vehicle.id === shortcutVehicleId && vehicle.customer_id === customerId) ? shortcutVehicleId! : '');
  const [identityChosen, setIdentityChosen] = useState(Boolean(customerId && vehicleId));
  const [category, setCategory] = useState<Category | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<'back' | 'identity' | null>(null);
  const customerOptions = useMemo(() => snapshot.customers
    .filter(customer => snapshot.vehicles.some(vehicle => vehicle.customer_id === customer.user_id))
    .sort((left, right) => customerName(left).localeCompare(customerName(right), 'en-AU'))
    .map(customer => ({ value: customer.user_id, label: customerName(customer), sublabel: customer.email })), [snapshot.customers, snapshot.vehicles]);
  const vehicles = snapshot.vehicles.filter(vehicle => vehicle.customer_id === customerId);
  const selectedCustomer = snapshot.customers.find(customer => customer.user_id === customerId);
  const selectedVehicle = vehicles.find(vehicle => vehicle.id === vehicleId);
  const identityReady = identityChosen && Boolean(selectedCustomer && selectedVehicle);
  const dirtyChanged = useCallback((value: boolean) => { setDirty(value); onDirtyChange?.(value); }, [onDirtyChange]);
  const busyChanged = useCallback((value: boolean) => { setBusy(value); onBusyChange?.(value); }, [onBusyChange]);
  const chooseCategory = (value: Category) => {
    if (busy || !identityReady) return;
    setCategory(value);
    if (value === 'recommendation') setDestination({ legacy: 'recommendation' });
    else if (value === 'media' || value === 'document' || value === 'modification') setDestination({ vault: value });
  };
  const applyStep = useCallback((action: 'back' | 'identity') => {
    if (busy) return;
    if (action === 'identity') { setDestination(null); setCategory(null); setIdentityChosen(false); }
    else if (destination && category && formats[category]) setDestination(null);
    else { setDestination(null); setCategory(null); }
    dirtyChanged(false);
    setPendingAction(null);
  }, [busy, destination, category, dirtyChanged]);
  const requestStep = useCallback((action: 'back' | 'identity') => {
    if (busy) return;
    if (dirty) setPendingAction(action);
    else applyStep(action);
  }, [busy, dirty, applyStep]);
  useEffect(() => {
    onBackHandlerChange?.(identityReady ? () => requestStep(category ? 'back' : 'identity') : null);
    return () => onBackHandlerChange?.(null);
  }, [onBackHandlerChange, identityReady, category, requestStep]);
  const selectedTitle = destination && category
    ? formats[category]?.find(option => option.destination.legacy === destination.legacy && option.destination.vault === destination.vault)?.title ?? categories.find(option => option.id === category)?.title
    : categories.find(option => option.id === category)?.title;

  return <View style={styles.stack}>
    {!identityReady ? <View style={styles.stack}>
      <Text style={styles.muted}>Choose the customer and vehicle.</Text>
      <StaffScrollSelect label="Customer" placeholder="Select customer" searchable value={customerId} options={customerOptions} onChange={value => { if (busy) return; setCustomerId(value); setVehicleId(''); }} />
      <StaffScrollSelect label="Vehicle" placeholder={customerId ? 'Select vehicle' : 'Choose a customer first'} searchable value={vehicleId} options={vehicles.map(vehicle => ({ value: vehicle.id, label: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, sublabel: vehicle.registration }))} onChange={value => { if (!busy) setVehicleId(value); }} />
      {!customerOptions.length ? <Text style={styles.muted}>A customer needs a saved vehicle before you can add records.</Text> : null}
      <PrimaryButton label="Continue" disabled={busy || !selectedCustomer || !selectedVehicle} onPress={() => { if (!busy && selectedCustomer && selectedVehicle) setIdentityChosen(true); }} />
    </View> : <>
      <View style={styles.identity}>
        <View style={styles.identityCopy}>
          <Text style={styles.identityName}>{customerName(selectedCustomer!)}</Text>
          <Text style={styles.identityVehicle}>{selectedVehicle!.year} {selectedVehicle!.make} {selectedVehicle!.model}</Text>
          <Text style={styles.registration}>{selectedVehicle!.registration || 'Registration not recorded'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Change customer or vehicle" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => requestStep('identity')} style={styles.change}>
          <Text style={styles.backText}>Change vehicle</Text>
        </Pressable>
      </View>
    {category ? <View style={styles.heading}>
      {!onBackHandlerChange ? <Pressable accessibilityRole="button" accessibilityLabel="Back to record choices" disabled={busy} onPress={() => requestStep('back')} style={styles.back}>
        <Ionicons color={colors.accent} name="arrow-back" size={20} />
        <Text style={styles.backText}>{destination && formats[category] ? 'Options' : 'Record types'}</Text>
      </Pressable> : null}
      <Text style={styles.title}>{selectedTitle}</Text>
    </View> : <Text style={styles.muted}>Add to this vehicle</Text>}
    {!category ? categories.map(option => <Row key={option.id} icon={option.icon} title={option.title} onPress={() => chooseCategory(option.id)} />) : null}
    {category && !destination ? formats[category]?.map(option => <Row key={option.title} title={option.title} description={option.description} icon="document-text-outline" onPress={() => setDestination(option.destination)} />) : null}
    {destination?.legacy ? <StaffRecordPublisher key={`legacy:${destination.legacy}:${customerId}:${vehicleId}`} compact fixedIdentity fixedType={destination.legacy} initialCustomerId={customerId} initialVehicleId={vehicleId} onBusyChange={busyChanged} onDirtyChange={dirtyChanged} previewMode={previewMode} snapshot={snapshot} /> : null}
    {destination?.vault ? <StaffVaultPublisher key={`vault:${destination.vault}:${customerId}:${vehicleId}`} compact fixedIdentity fixedKind={destination.vault} initialCustomerId={customerId} initialVehicleId={vehicleId} onBusyChange={busyChanged} onDirtyChange={dirtyChanged} previewMode={previewMode} snapshot={snapshot} /> : null}
    </>}
    <Modal animationType="fade" transparent visible={pendingAction !== null} onRequestClose={() => setPendingAction(null)}>
      <View style={styles.backdrop}><ScrollView contentContainerStyle={styles.modalScroll}><View accessibilityViewIsModal style={styles.modalCard}>
        <Text style={styles.title}>Discard this draft?</Text>
        <Text style={styles.muted}>Entered details and selected files will be cleared.</Text>
        <PrimaryButton label="Keep editing" onPress={() => setPendingAction(null)} />
        <PrimaryButton label="Discard changes" variant="outline" onPress={() => { if (pendingAction) applyStep(pendingAction); }} />
      </View></ScrollView></View>
    </Modal>
  </View>;
}

function customerName(customer: StaffPortalSnapshot['customers'][number]) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email;
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
  title: { color: colors.white, fontSize: 18, fontWeight: '700', flexShrink: 1 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  identity: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, gap: spacing.sm },
  identityCopy: { minWidth: 0, gap: 3 },
  identityName: { color: colors.white, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  identityVehicle: { color: colors.silver, fontSize: 14, lineHeight: 21 },
  registration: { color: colors.accent, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  change: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  row: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 66 },
  pressed: { backgroundColor: colors.panelRaised },
  icon: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: colors.white, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center' },
  modalScroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 460, alignSelf: 'center', backgroundColor: colors.panel, borderRadius: 14, padding: spacing.lg, gap: spacing.md },
});
