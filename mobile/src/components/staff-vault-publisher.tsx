import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { CalendarDateField } from '@/components/calendar-date-field';
import { StaffScrollSelect } from '@/components/staff-scroll-select';
import { colors, spacing } from '@/constants/brand';
import { australianDateToIso, todayAustralianDate } from '@/lib/australian-date';
import type { StaffPortalSnapshot } from '@/lib/staff-portal';
import { createOrFindWorkshopJob, publishVaultRecord } from '@/lib/staff-vault';
import { xeroImportFailureMessage } from '@/lib/xero-import-feedback';
import { xeroWorkshopJobReference } from '@/lib/xero-workshop-reference';
import { aud, PUBLISHABLE_VAULT_KINDS, VAULT_LABELS, vaultClient, type VaultKind } from '@/lib/performance-plus';
import { getSupabaseClient, SUPABASE_CONNECTION } from '@/lib/supabase';

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
        <CalendarDateField disabled={busy} label="Job date" maximumDate={australianDateToIso(initialDate) ?? undefined} onChange={value => { setDate(value); setConfirmed(false); }} value={date} />
        {!fixedKind ? <View style={styles.choices}>{PUBLISHABLE_VAULT_KINDS.map(value => <Choice disabled={busy} key={value} label={VAULT_LABELS[value]} selected={kind === value} onPress={() => { setKind(value); setFiles([]); setConfirmed(false); }} />)}</View> : null}
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

type VaultImportReview = {
  id: string;
  reason: string;
  source: string;
  source_key: string;
  status: string;
  identifiers: Record<string, unknown>;
  attempt_count: number;
  last_error_code: string | null;
};

export function StaffVaultReview({ snapshot, owner, previewMode = false }: { snapshot: StaffPortalSnapshot; owner: boolean; previewMode?: boolean }) {
  const [imports, setImports] = useState<VaultImportReview[]>([]);
  const [drafts, setDrafts] = useState<{ id: string; title: string; created_at: string }[]>([]);
  const [busy, setBusy] = useState(!previewMode);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(previewMode);
  const [activeTab, setActiveTab] = useState<'review' | 'waiting'>('review');
  const waitingImports = imports.filter(item => item.status === 'waiting_for_customer');
  const review = useCallback(async () => {
    if (previewMode) return;
    setBusy(true); setError('');
    try {
      const [queue, records] = await Promise.all([
        vaultClient().from('vault_import_queue').select('id,reason,source,source_key,status,identifiers,attempt_count,last_error_code').in('status', ['pending', 'processing', 'needs_review', 'waiting_for_customer', 'matched', 'failed']).order('created_at', { ascending: false }).limit(50),
        vaultClient().from('vault_records').select('id,title,created_at').is('published_at', null).not('title', 'like', 'ARCHIVED DUPLICATE%').order('created_at', { ascending: false }).limit(50),
      ]);
      if (queue.error || records.error) throw queue.error ?? records.error;
      setImports(queue.data ?? []);
      setDrafts((records.data ?? []).filter(record => !record.title.toUpperCase().startsWith('ARCHIVED DUPLICATE')));
      setLoaded(true);
    } catch { setError('Imports and drafts could not be loaded. Check your staff session and try again.'); }
    finally { setBusy(false); }
  }, [previewMode]);
  const processXero = async () => {
    if (previewMode || busy || !owner) return;
    setBusy(true); setError('');
    try {
      const { error: processError } = await getSupabaseClient().functions.invoke('process-xero-imports', { body: { limit: 10 } });
      if (processError) throw processError;
      await review();
    } catch { setError('Xero invoices could not be checked. Re-open owner security if required, then check the Xero connection.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (previewMode) return; const task = setTimeout(() => void review(), 0); return () => clearTimeout(task); }, [review, previewMode]);
  return <View style={styles.stack}>
    <Text style={styles.muted}>{previewMode ? 'Preview only · This example shows an empty imports and drafts queue.' : 'Private imports and drafts. Reviewing this list does not publish records.'}</Text>
    {owner ? <PrimaryButton disabled={previewMode || busy} loading={busy} label="Check Xero invoice queue" onPress={() => void processXero()} /> : null}
    <PrimaryButton disabled={previewMode || busy} loading={busy} label={loaded ? 'Refresh' : 'Load records'} variant="outline" onPress={() => void review()} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {loaded && !error ? <>
      <View accessibilityRole="tablist" style={styles.reviewTabs}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'review' }} onPress={() => setActiveTab('review')} style={[styles.reviewTab, activeTab === 'review' && styles.selected]}>
          <Text style={[styles.copy, activeTab === 'review' && styles.selectedText]}>Review & drafts</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'waiting' }} onPress={() => setActiveTab('waiting')} style={[styles.reviewTab, activeTab === 'waiting' && styles.selected]}>
          <Text style={[styles.copy, activeTab === 'waiting' && styles.selectedText]}>Waiting for account{waitingImports.length ? ` (${waitingImports.length})` : ''}</Text>
        </Pressable>
      </View>
      {activeTab === 'review' ? <>
      {imports.filter(item => item.status !== 'waiting_for_customer').length ? <View accessibilityRole="alert" style={styles.reviewAlert}>
        <Ionicons color={colors.danger} name="alert-circle" size={24} />
        <View style={styles.reviewAlertCopy}><Text style={styles.reviewAlertTitle}>Action needed · {imports.filter(item => item.status !== 'waiting_for_customer').length} invoice exception{imports.filter(item => item.status !== 'waiting_for_customer').length === 1 ? '' : 's'}</Text><Text style={styles.muted}>These could not be matched automatically. Check the customer and vehicle before publishing, or keep the invoice in Xero only.</Text></View>
      </View> : null}
      <Text style={styles.title}>Imports needing review</Text>
      {!imports.some(item => item.status !== 'waiting_for_customer') ? <Text style={styles.muted}>No imports need review.</Text> : imports.filter(item => item.status !== 'waiting_for_customer').map(item => item.source === 'xero'
        ? <XeroImportReviewCard disabled={busy} item={item} key={item.id} onDone={review} owner={owner} snapshot={snapshot} />
        : <View key={item.id} style={styles.card}><Text style={styles.copy}>{item.source} · {item.source_key}</Text><Text style={styles.muted}>{item.reason}</Text></View>)}
      {imports.length === 50 ? <Text style={styles.muted}>Showing the latest 50 imports.</Text> : null}
      <Text style={styles.title}>Unpublished drafts</Text>
      {!drafts.length ? <Text style={styles.muted}>No unfinished vault drafts.</Text> : <><Text style={styles.muted}>Check the original upload before retrying to avoid duplicates.</Text>{drafts.map(item => <View key={item.id} style={styles.card}><Text style={styles.copy}>{item.title}</Text><Text selectable style={styles.muted}>Draft reference: {item.id}</Text></View>)}</>}
      {drafts.length === 50 ? <Text style={styles.muted}>Showing the latest 50 drafts.</Text> : null}
      </> : <>
        <Text style={styles.title}>Waiting for a customer account</Text>
        <Text style={styles.muted}>These files are saved privately for customers whose PSI account and vehicle have not been matched yet. Once they create an account and the details are securely matched, syncing continues automatically.</Text>
        <Text style={styles.message}>No action needed here. These files do not send owner alerts. Do not upload them again.</Text>
        {!waitingImports.length ? <Text style={styles.muted}>No files are waiting for a customer account.</Text> : waitingImports.map(item => <WaitingAccountCard item={item} key={item.id} />)}
      </>}
    </> : null}
  </View>;
}

function WaitingAccountCard({ item }: { item: VaultImportReview }) {
  const details = item.identifiers;
  const name = typeof details.contactName === 'string' && details.contactName.trim() ? details.contactName.trim() : 'Customer details not yet available';
  const invoice = typeof details.invoiceNumber === 'string' && details.invoiceNumber.trim() ? details.invoiceNumber.trim() : null;
  const reference = typeof details.reference === 'string' && details.reference.trim() ? details.reference.trim() : null;
  return <View style={styles.card}>
    <Text style={styles.title}>{name}</Text>
    <Text style={styles.copy}>{item.source === 'xero' ? `Xero invoice${invoice ? ` ${invoice}` : ''}` : 'Workshop file'}</Text>
    {reference ? <Text style={styles.muted}>Vehicle / job: {reference}</Text> : null}
    {typeof details.totalCents === 'number' && details.currency === 'AUD' ? <Text style={styles.muted}>{aud(details.totalCents)}{details.invoiceStatus === 'PAID' ? ' · Paid in Xero' : ''}</Text> : null}
    <Text style={styles.importStatus}>Waiting for account match</Text>
  </View>;
}

function XeroImportReviewCard({ disabled, item, onDone, owner, snapshot }: { disabled: boolean; item: VaultImportReview; onDone: () => Promise<void>; owner: boolean; snapshot: StaffPortalSnapshot }) {
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [importType, setImportType] = useState<'workshop_job' | 'parts_only'>('workshop_job');
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const identifiers = item.identifiers;
  const reference = typeof identifiers.reference === 'string' ? identifiers.reference : '';
  const invoiceNumber = typeof identifiers.invoiceNumber === 'string' ? identifiers.invoiceNumber : 'Awaiting inspection';
  const invoiceDate = typeof identifiers.invoiceDate === 'string' ? identifiers.invoiceDate : '';
  const totalCents = typeof identifiers.totalCents === 'number' ? identifiers.totalCents : null;
  const invoiceStatus = identifiers.invoiceStatus === 'PAID' ? 'PAID' : identifiers.invoiceStatus === 'AUTHORISED' ? 'ISSUED' : '';
  const amountDueCents = typeof identifiers.amountDueCents === 'number' ? identifiers.amountDueCents : null;
  const contactName = typeof identifiers.contactName === 'string' ? identifiers.contactName : 'Xero contact not loaded';
  const vehicles = snapshot.vehicles.filter(vehicle => vehicle.customer_id === customerId && !vehicle.archived_at);
  const canMatch = owner && item.status === 'needs_review' && Boolean(invoiceDate && customerId && vehicleId && confirmed && (importType === 'parts_only' || reference));

  const keepInXeroOnly = async () => {
    if (!owner || disabled || working || !['needs_review', 'failed'].includes(item.status)) return;
    setWorking(true); setMessage('');
    try {
      const result = await vaultClient().rpc('ignore_xero_import', { p_queue_id: item.id });
      if (result.error) throw result.error;
      setMessage('Kept in Xero only. It will not appear in an app customer’s vault.');
      await onDone();
    } catch {
      setMessage('The invoice was not changed. Re-open owner security and try again.');
    } finally { setWorking(false); }
  };

  const matchAndImport = async () => {
    if (!canMatch || disabled || working) return;
    setWorking(true); setMessage('');
    let matchSaved = false;
    try {
      const selectedVehicle = snapshot.vehicles.find(vehicle => vehicle.id === vehicleId && vehicle.customer_id === customerId && !vehicle.archived_at);
      if (!selectedVehicle) throw new Error('Choose the verified customer vehicle again.');
      const confirmedMatch = importType === 'parts_only'
        ? await vaultClient().rpc('confirm_xero_parts_only_import', { p_queue_id: item.id, p_customer_id: customerId, p_vehicle_id: vehicleId })
        : await (async () => {
          const jobReference = xeroWorkshopJobReference(invoiceNumber, selectedVehicle.registration);
          const job = await createOrFindWorkshopJob({ customerId, vehicleId, reference: jobReference, title: `Xero invoice ${invoiceNumber}`, date: invoiceDate, reuseExistingVehicleDate: true });
          return vaultClient().rpc('confirm_xero_import_match', { p_queue_id: item.id, p_customer_id: customerId, p_job_id: job.id });
        })();
      if (confirmedMatch.error) throw confirmedMatch.error;
      matchSaved = true;
      const processed = await getSupabaseClient().functions.invoke('process-xero-imports', { body: { queueId: item.id, limit: 1 } });
      if (processed.error) throw processed.error;
      const outcome = processed.data?.results?.[0];
      setConfirmed(false);
      setMessage(outcome?.status === 'imported'
        ? importType === 'parts_only'
          ? 'Parts-only invoice published to the verified vehicle. No workshop job or folder was created.'
          : 'Invoice imported and published to the verified vehicle.'
        : 'Match saved. The secure importer will retry this invoice.');
      await onDone();
    } catch (error) { setMessage(xeroImportFailureMessage(error, matchSaved)); }
    finally { setWorking(false); }
  };

  return <View style={styles.card}>
    <View style={styles.importHeading}><Text style={styles.copy}>Xero invoice · {invoiceNumber}</Text><Text style={styles.importStatus}>{item.status.replaceAll('_', ' ')}</Text></View>
    <Text style={styles.muted}>{contactName}{invoiceDate ? ` · ${invoiceDate}` : ''}{totalCents !== null ? ` · ${aud(totalCents)}` : ''}</Text>
    {invoiceStatus ? <Text style={styles.importStatus}>Xero · {invoiceStatus}{amountDueCents !== null ? ` · ${aud(amountDueCents)} due` : ''}</Text> : null}
    {reference ? <Text selectable style={styles.copy}>PSI job reference · {reference}</Text> : null}
    <Text style={styles.muted}>{reviewReason(item.reason)}{item.last_error_code ? ` · ${item.last_error_code.replaceAll('_', ' ')}` : ''}</Text>
    {item.status === 'pending' || item.status === 'matched' || item.status === 'processing' ? <Text style={styles.message}>Secure inspection is queued.</Text> : null}
    {item.status === 'needs_review' && owner ? <>
      <StaffScrollSelect label="Customer" value={customerId} options={customerOptions(snapshot)} searchable onChange={value => { setCustomerId(value); setVehicleId(''); setConfirmed(false); setMessage(''); }} />
      <StaffScrollSelect label="Vehicle" value={vehicleId} options={vehicles.map(vehicle => ({ value: vehicle.id, label: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, sublabel: vehicle.registration }))} searchable onChange={value => { setVehicleId(value); setConfirmed(false); setMessage(''); }} />
      <View accessibilityRole="radiogroup" style={styles.choices}>
        <Choice disabled={disabled || working} label="Workshop job" selected={importType === 'workshop_job'} onPress={() => { setImportType('workshop_job'); setConfirmed(false); setMessage(''); }} />
        <Choice disabled={disabled || working} label="Parts only" selected={importType === 'parts_only'} onPress={() => { setImportType('parts_only'); setConfirmed(false); setMessage(''); }} />
      </View>
      {importType === 'parts_only' ? <Text style={styles.muted}>Use this for a parts sale with no PSI workshop job. It adds the invoice to this vehicle’s app and portal history without creating a booking, workshop job or desktop folder.</Text> : null}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} disabled={disabled || working || !vehicleId} onPress={() => setConfirmed(value => !value)} style={styles.confirm}>
        <Ionicons color={colors.accent} name={confirmed ? 'checkbox' : 'square-outline'} size={25} />
        <Text style={styles.confirmText}>{importType === 'parts_only'
          ? 'I checked the Xero contact, customer and registration. This is a parts-only sale with no PSI workshop job. Import this invoice to that vehicle.'
          : 'I checked the Xero contact, customer, registration and exact PSI job reference. Import this invoice to that vehicle.'}</Text>
      </Pressable>
      <PrimaryButton disabled={!canMatch || disabled || working} loading={working} label={importType === 'parts_only' ? 'Import as parts only' : 'Match and import invoice'} onPress={() => void matchAndImport()} />
      <PrimaryButton disabled={disabled || working} label="Keep in Xero only" variant="outline" onPress={() => void keepInXeroOnly()} />
    </> : null}
    {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
  </View>;
}

export function StaffPerformanceAccess({ onDirtyChange, onBusyChange, previewMode = false }: {
  snapshot: StaffPortalSnapshot;
  customerId?: string;
  previewMode?: boolean;
} & ChangeCallbacks) {
  useEffect(() => {
    onDirtyChange?.(false);
    onBusyChange?.(false);
  }, [onBusyChange, onDirtyChange]);
  return <View style={styles.stack}>
    <Text style={styles.copy}>{previewMode ? 'Preview only · Customer account access cannot be changed here.' : 'Customers create and verify their own PSI account. Completing their account starts their one-time 14-day Performance+ trial without payment or automatic renewal.'}</Text>
    <Text style={styles.muted}>The workshop PC can prepare an account-optional job folder using the customer, vehicle and registration. It keeps the files private and waiting locally.</Text>
    <Text style={styles.muted}>When the customer completes their own account and vehicle, a matching registration plus either verified email or exact name and mobile links the prepared job automatically. The watcher then uploads the waiting files.</Text>
    <Text style={styles.muted}>Creating the workshop folder does not start the 14-day countdown.</Text>
  </View>;
}

function displayName(customer: StaffPortalSnapshot['customers'][number]) {
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email;
}

function reviewReason(reason: string) {
  if (reason === 'verified_customer_link_required') return 'Customer and vehicle confirmation required before this sales invoice can be added.';
  if (reason === 'invoice_status_requires_review') return 'This sales invoice is still a draft in Xero. It will not be published until it is issued or paid.';
  if (reason === 'job_reference_required') return 'An exact PSI job reference or vehicle registration is required.';
  return reason.replaceAll('_', ' ');
}
function customerOptions(snapshot: StaffPortalSnapshot) {
  return [...snapshot.customers].sort((a, b) => displayName(a).localeCompare(displayName(b), 'en-AU')).map(c => ({ value: c.user_id, label: displayName(c), sublabel: c.email }));
}
function Choice({ label, selected, onPress, disabled = false }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.choice, selected && styles.selected]}><Text style={[styles.copy, selected && styles.selectedText]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  reviewTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reviewTab: { flexGrow: 1, flexBasis: 140, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: spacing.sm, justifyContent: 'center' },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel, padding: spacing.md, gap: spacing.md },
  reviewAlert: { borderWidth: 1, borderColor: colors.danger, borderLeftWidth: 4, borderRadius: 12, backgroundColor: colors.panel, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  reviewAlertCopy: { flex: 1, minWidth: 0, gap: 3 },
  reviewAlertTitle: { color: colors.danger, fontSize: 15, lineHeight: 21, fontWeight: '900' },
  review: { gap: spacing.md, paddingVertical: spacing.sm },
  title: { color: colors.white, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  copy: { color: colors.white, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  message: { color: colors.accent, fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  importHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  importStatus: { color: colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: spacing.sm, minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectedText: { color: colors.ink },
  confirm: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.sm, minHeight: 44 },
  confirmText: { color: colors.silver, flex: 1, fontSize: 14, lineHeight: 21 },
  notes: { minHeight: 100 },
});
