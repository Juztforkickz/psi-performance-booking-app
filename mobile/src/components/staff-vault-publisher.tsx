import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { StaffScrollSelect } from '@/components/staff-scroll-select';
import { colors, spacing } from '@/constants/brand';
import { australianDateToIso, todayAustralianDate } from '@/lib/australian-date';
import type { StaffPortalSnapshot } from '@/lib/staff-portal';
import { createOrFindWorkshopJob, publishVaultRecord } from '@/lib/staff-vault';
import { VAULT_KINDS, VAULT_LABELS, vaultClient, type VaultKind } from '@/lib/performance-plus';
import { SUPABASE_CONNECTION } from '@/lib/supabase';

type ChangeCallbacks = { onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void };

export function StaffVaultPublisher({ snapshot, fixedKind, initialCustomerId, initialVehicleId, onDirtyChange, onBusyChange, fixedIdentity = false, compact = false, previewMode = false }: {
  snapshot: StaffPortalSnapshot;
  fixedKind?: VaultKind;
  initialCustomerId?: string;
  initialVehicleId?: string;
  fixedIdentity?: boolean;
  compact?: boolean;
  previewMode?: boolean;
} & ChangeCallbacks) {
  const [customerId, setCustomerId] = useState(() => snapshot.customers.some(c => c.user_id === initialCustomerId) ? initialCustomerId! : '');
  const [vehicleId, setVehicleId] = useState(() => snapshot.vehicles.some(v => v.id === initialVehicleId && v.customer_id === customerId) ? initialVehicleId! : '');
  const [reference, setReference] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [initialDate] = useState(todayAustralianDate);
  const [date, setDate] = useState(initialDate);
  const [kind, setKind] = useState<VaultKind>(fixedKind ?? 'media');
  const [phase, setPhase] = useState<'before' | 'progress' | 'after'>('before');
  const [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [power, setPower] = useState('');
  const [torque, setTorque] = useState('');
  const vehicles = snapshot.vehicles.filter(v => v.customer_id === customerId);
  const selectedCustomer = snapshot.customers.find(c => c.user_id === customerId);
  const selectedVehicle = vehicles.find(v => v.id === vehicleId);
  const dirty = Boolean(reference || title || notes || power || torque || files.length || confirmed || date !== initialDate || phase !== 'before');
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  const validatedJob = async () => {
    if (previewMode) throw new Error('Preview only. Workshop jobs cannot be created.');
    const iso = australianDateToIso(date);
    if (!iso || !confirmed || !selectedCustomer || !selectedVehicle || !title.trim()) {
      throw new Error('Choose the customer and vehicle, enter a title and valid date, then confirm the match.');
    }
    return { iso, job: await createOrFindWorkshopJob({ customerId, vehicleId, reference, title, date: iso }) };
  };

  const downloadManifest = async () => {
    if (previewMode || Platform.OS !== 'web' || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { job } = await validatedJob();
      const blob = new Blob([JSON.stringify({ schema: 1, project_ref: SUPABASE_CONNECTION.projectRef, job_id: job.id, customer_id: customerId, vehicle_id: vehicleId, registration: selectedVehicle!.registration, reference: job.reference, job_date: job.job_date }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'psi-job.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Save psi-job.json in this job’s workshop folder. The uploader checks it against the saved vehicle.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The folder file could not be created.');
    } finally { setBusy(false); }
  };

  const selectFiles = async () => {
    if (previewMode || busy) return;
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: kind === 'dyno' || kind === 'invoice' ? 'application/pdf' : ['image/*', 'application/pdf'], multiple: true, copyToCacheDirectory: true });
      if (!result.canceled) { setFiles(result.assets); setConfirmed(false); setMessage(''); }
    } catch { setMessage('Files could not be selected. Please try again.'); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (previewMode || busy || !confirmed) return;
    setBusy(true);
    setMessage('');
    try {
      if ((power && (!Number.isFinite(Number(power)) || !(Number(power) > 0))) || (torque && (!Number.isFinite(Number(torque)) || !(Number(torque) > 0)))) throw new Error('Power and torque must be positive numbers.');
      const { iso, job } = await validatedJob();
      await publishVaultRecord(job, { kind, title, notes, date: iso, files, phase, powerKw: power ? Number(power) / 1.34102209 : undefined, torqueNm: torque ? Number(torque) : undefined, runStage: kind === 'dyno' ? phase === 'progress' ? 'baseline' : phase : undefined }, setMessage);
      setReference(''); setTitle(''); setNotes(''); setPower(''); setTorque('');
      setFiles([]); setConfirmed(false); setDate(initialDate); setPhase('before');
      onDirtyChange?.(false);
      setMessage('Published to this vehicle’s Performance+ vault.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Publication failed. Check your staff session and try again.');
    } finally { setBusy(false); }
  };

  if (fixedIdentity && (!selectedCustomer || !selectedVehicle || customerId !== initialCustomerId || vehicleId !== initialVehicleId)) {
    return <Text accessibilityRole="alert" style={styles.error}>Choose a valid customer and vehicle before adding this record.</Text>;
  }
  return (
    <View pointerEvents={busy ? 'none' : 'auto'} style={styles.stack}>
      {previewMode ? <Text style={styles.muted}>Preview only · Try entering job details. Uploads and publishing are unavailable.</Text> : null}
      {!fixedIdentity ? <><StaffScrollSelect label="Customer" value={customerId} options={customerOptions(snapshot)} searchable onChange={id => { if (busy) return; setCustomerId(id); setVehicleId(''); setFiles([]); setConfirmed(false); setMessage(''); }} />
      <StaffScrollSelect label="Vehicle" value={vehicleId} options={vehicles.map(v => ({ value: v.id, label: `${v.year} ${v.make} ${v.model}`, sublabel: v.registration }))} searchable onChange={id => { if (busy) return; setVehicleId(id); setFiles([]); setConfirmed(false); setMessage(''); }} /></> : null}
      <View style={styles.card}>
        <Field label="PSI job reference"><FormInput editable={!busy} value={reference} onChangeText={value => { setReference(value); setConfirmed(false); }} placeholder="PSI-2026-0123" /></Field>
        <Field label="Title"><FormInput editable={!busy} value={title} onChangeText={value => { setTitle(value); setConfirmed(false); }} placeholder="Major service" /></Field>
        <Field label="Job date" hint="DD/MM/YYYY"><FormInput editable={!busy} value={date} maxLength={10} keyboardType="numbers-and-punctuation" onChangeText={value => { setDate(value); setConfirmed(false); }} /></Field>
        {!fixedKind ? <View style={styles.choices}>{VAULT_KINDS.map(value => <Choice disabled={busy} key={value} label={VAULT_LABELS[value]} selected={kind === value} onPress={() => { setKind(value); setFiles([]); setConfirmed(false); }} />)}</View> : null}
        {kind === 'media' || kind === 'dyno' ? <View style={styles.choices}>{(['before', 'progress', 'after'] as const).map(value => <Choice disabled={busy} key={value} label={value === 'progress' && kind === 'dyno' ? 'Baseline' : `${value[0].toUpperCase()}${value.slice(1)}`} selected={phase === value} onPress={() => { setPhase(value); setConfirmed(false); }} />)}</View> : null}
        {kind === 'dyno' ? <><Field label="Power · HP at hubs" hint="Optional"><FormInput editable={!busy} value={power} onChangeText={value => { setPower(value); setConfirmed(false); }} keyboardType="decimal-pad" /></Field><Field label="Torque · Nm at hubs" hint="Optional"><FormInput editable={!busy} value={torque} onChangeText={value => { setTorque(value); setConfirmed(false); }} keyboardType="decimal-pad" /></Field></> : null}
        <Field label="Notes" hint="Optional"><FormInput editable={!busy} value={notes} onChangeText={value => { setNotes(value); setConfirmed(false); }} multiline style={styles.notes} textAlignVertical="top" /></Field>
        <PrimaryButton disabled={previewMode || busy} label={kind === 'dyno' || kind === 'invoice' ? 'Choose PDFs' : 'Choose files'} variant="outline" onPress={() => void selectFiles()} />
        <Text style={styles.muted}>{previewMode ? 'Preview only · File selection is unavailable.' : <>{files.length ? `${files.length} ${files.length === 1 ? 'file' : 'files'} selected` : 'No files selected'}{compact ? '' : ' · Photos resized automatically; PDFs kept intact.'}</>}</Text>
        {files.length ? <PrimaryButton disabled={busy} label="Clear files" variant="outline" onPress={() => { setFiles([]); setConfirmed(false); }} /> : null}
      </View>
      <View style={styles.review}>
        {!compact ? <Text style={styles.title}>Check and publish</Text> : null}
        {!fixedIdentity ? selectedCustomer && selectedVehicle ? <Text style={styles.copy}>{displayName(selectedCustomer)}{'\n'}{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.registration}</Text> : <Text style={styles.muted}>Select the customer and vehicle above.</Text> : null}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} disabled={busy} onPress={() => setConfirmed(value => !value)} style={styles.confirm}>
          <Ionicons color={colors.accent} name={confirmed ? 'checkbox' : 'square-outline'} size={25} />
          <Text style={styles.confirmText}>I checked the customer, registration and job. These records belong to this vehicle.</Text>
        </Pressable>
        <PrimaryButton disabled={previewMode || !confirmed || busy || !selectedVehicle} label={previewMode ? 'Preview only · Publish' : 'Publish'} loading={busy} onPress={() => void publish()} />
        {Platform.OS === 'web' ? <PrimaryButton disabled={previewMode || !confirmed || busy || !selectedVehicle} label="Download PC folder file" variant="outline" onPress={() => void downloadManifest()} /> : null}
        {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

export function StaffVaultReview({ previewMode = false }: { previewMode?: boolean } = {}) {
  const [imports, setImports] = useState<{ id: string; reason: string; source: string; source_key: string }[]>([]);
  const [drafts, setDrafts] = useState<{ id: string; title: string; created_at: string }[]>([]);
  const [busy, setBusy] = useState(!previewMode);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(previewMode);
  const review = useCallback(async () => {
    if (previewMode) return;
    setBusy(true); setError('');
    try {
      const [queue, records] = await Promise.all([
        vaultClient().from('vault_import_queue').select('id,reason,source,source_key').eq('status', 'needs_review').order('created_at', { ascending: false }).limit(50),
        vaultClient().from('vault_records').select('id,title,created_at').is('published_at', null).order('created_at', { ascending: false }).limit(50),
      ]);
      if (queue.error || records.error) throw queue.error ?? records.error;
      setImports(queue.data ?? []); setDrafts(records.data ?? []); setLoaded(true);
    } catch { setError('Imports and drafts could not be loaded. Check your staff session and try again.'); }
    finally { setBusy(false); }
  }, [previewMode]);
  useEffect(() => { if (previewMode) return; const task = setTimeout(() => void review(), 0); return () => clearTimeout(task); }, [review, previewMode]);
  return <View style={styles.stack}>
    <Text style={styles.muted}>{previewMode ? 'Preview only · This example shows an empty imports and drafts queue.' : 'Private imports and drafts. Reviewing this list does not publish records.'}</Text>
    <PrimaryButton disabled={previewMode || busy} loading={busy} label={loaded ? 'Refresh' : 'Load records'} variant="outline" onPress={() => void review()} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {loaded && !error ? <>
      <Text style={styles.title}>Imports needing review</Text>
      {!imports.length ? <Text style={styles.muted}>No imports need review.</Text> : imports.map(item => <View key={item.id} style={styles.card}><Text style={styles.copy}>{item.source} · {item.source_key}</Text><Text style={styles.muted}>{item.reason}</Text></View>)}
      {imports.length === 50 ? <Text style={styles.muted}>Showing the latest 50 imports.</Text> : null}
      <Text style={styles.title}>Unpublished drafts</Text>
      {!drafts.length ? <Text style={styles.muted}>No unfinished vault drafts.</Text> : <><Text style={styles.muted}>Check the original upload before retrying to avoid duplicates.</Text>{drafts.map(item => <View key={item.id} style={styles.card}><Text style={styles.copy}>{item.title}</Text><Text selectable style={styles.muted}>Draft reference: {item.id}</Text></View>)}</>}
      {drafts.length === 50 ? <Text style={styles.muted}>Showing the latest 50 drafts.</Text> : null}
    </> : null}
  </View>;
}

export function StaffPerformanceAccess({ snapshot, customerId: initialCustomerId, onDirtyChange, onBusyChange, previewMode = false }: {
  snapshot: StaffPortalSnapshot;
  customerId?: string;
  previewMode?: boolean;
} & ChangeCallbacks) {
  const [customerId, setCustomerId] = useState(() => snapshot.customers.some(c => c.user_id === initialCustomerId) ? initialCustomerId! : '');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { onDirtyChange?.(confirmed); }, [confirmed, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const grant = async () => {
    if (previewMode || busy || !confirmed || !snapshot.customers.some(c => c.user_id === customerId)) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await vaultClient().rpc('grant_performance_beta', { p_customer_id: customerId, p_days: 30 });
      if (error) throw error;
      setConfirmed(false);
      setMessage('30 days of complimentary Performance+ access granted. No payment taken.');
    } catch { setMessage('Access was not granted. Only the verified PSI owner can grant complimentary access; check the selected customer and your session.'); }
    finally { setBusy(false); }
  };
  return <View pointerEvents={busy ? 'none' : 'auto'} style={styles.stack}>
    <Text style={styles.muted}>{previewMode ? 'Preview only · Explore the access form. Customer access cannot be changed.' : 'Give a customer 30 days of complimentary Performance+ access.'}</Text>
    <StaffScrollSelect label="Customer" value={customerId} options={customerOptions(snapshot)} searchable onChange={id => { if (busy) return; setCustomerId(id); setConfirmed(false); setMessage(''); }} />
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} disabled={busy || !customerId} onPress={() => setConfirmed(value => !value)} style={styles.confirm}><Ionicons color={colors.accent} name={confirmed ? 'checkbox' : 'square-outline'} size={25} /><Text style={styles.confirmText}>Grant complimentary access to this customer.</Text></Pressable>
    <PrimaryButton disabled={previewMode || !confirmed || !customerId || busy} loading={busy} label={previewMode ? 'Preview only · Grant access' : 'Grant 30 days access'} onPress={() => void grant()} />
    {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
  </View>;
}

function displayName(customer: StaffPortalSnapshot['customers'][number]) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email;
}
function customerOptions(snapshot: StaffPortalSnapshot) {
  return [...snapshot.customers].sort((a, b) => displayName(a).localeCompare(displayName(b), 'en-AU')).map(c => ({ value: c.user_id, label: displayName(c), sublabel: c.email }));
}
function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.selected]}><Text style={[styles.copy, selected && styles.selectedText]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel, padding: spacing.md, gap: spacing.md },
  review: { gap: spacing.md, paddingVertical: spacing.sm },
  title: { color: colors.white, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  copy: { color: colors.white, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  message: { color: colors.accent, fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: spacing.sm, minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectedText: { color: colors.ink },
  confirm: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, minHeight: 44 },
  confirmText: { color: colors.silver, flex: 1, fontSize: 14, lineHeight: 21 },
  notes: { minHeight: 100 },
});
