import { Ionicons } from '@expo/vector-icons';

import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { StaffScrollSelect } from '@/components/staff-scroll-select';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { todayAustralianDate } from '@/lib/australian-date';
import type { StaffPortalSnapshot } from '@/lib/staff-portal';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import {
  publishPsiDyno,
  publishPsiInvoice,
  publishPsiRecommendation,
  publishPsiRepair,
  type StaffPublishImage,
} from '@/lib/staff-record-publishing';

export type StaffRecordType = 'dyno' | 'invoice' | 'recommendation' | 'repair';
type RecordType = StaffRecordType;

const RECORD_TYPES: { icon: keyof typeof Ionicons.glyphMap; label: string; value: RecordType }[] = [
  { icon: 'construct', label: 'Repair history', value: 'repair' },
  { icon: 'alert-circle', label: 'Recommended work', value: 'recommendation' },
  { icon: 'speedometer', label: 'Verified dyno', value: 'dyno' },
  { icon: 'receipt', label: 'Invoice', value: 'invoice' },
];

export function StaffRecordPublisher({ snapshot, fixedType, initialCustomerId, initialVehicleId, onDirtyChange, onBusyChange }: {
  snapshot: StaffPortalSnapshot;
  fixedType?: StaffRecordType;
  initialCustomerId?: string;
  initialVehicleId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const customersWithVehicles = useMemo(
    () => snapshot.customers
      .filter((customer) => snapshot.vehicles.some((vehicle) => vehicle.customer_id === customer.user_id))
      .sort((left, right) => customerName(left).localeCompare(customerName(right), 'en-AU')),
    [snapshot.customers, snapshot.vehicles],
  );
  const firstCustomerWithVehicle = customersWithVehicles[0];
  const [customerId, setCustomerId] = useState(() => customersWithVehicles.some(c => c.user_id === initialCustomerId) ? initialCustomerId! : '');
  const availableVehicles = useMemo(
    () => snapshot.vehicles.filter((vehicle) => vehicle.customer_id === customerId),
    [customerId, snapshot.vehicles],
  );
  const [vehicleId, setVehicleId] = useState(() => availableVehicles.some(v => v.id === initialVehicleId) ? initialVehicleId! : '');
  const [recordType, setRecordType] = useState<RecordType>(fixedType ?? 'repair');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success' | 'warning'; text: string } | null>(null);

  const [title, setTitle] = useState('');
  const [initialDate] = useState(todayAustralianDate);
  const [date, setDate] = useState(initialDate);
  const [notes, setNotes] = useState('');
  const [odometer, setOdometer] = useState('');
  const [repairKind, setRepairKind] = useState<'inspection' | 'repair' | 'service'>('service');
  const [recommendationStatus, setRecommendationStatus] = useState<'due_soon' | 'monitor' | 'priority' | 'recommended'>('recommended');
  const [timing, setTiming] = useState('');
  const [power, setPower] = useState('');
  const [torque, setTorque] = useState('');
  const [fuel, setFuel] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amountAud, setAmountAud] = useState('');
  const [image, setImage] = useState<StaffPublishImage | null>(null);
  const dirty = Boolean(title || notes || odometer || timing || power || torque || fuel || invoiceNumber || amountAud || image || confirmed || date !== initialDate || repairKind !== 'service' || recommendationStatus !== 'recommended');
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const edit = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setConfirmed(false); };
  const choosePdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
      if (!result.canceled) { const file = result.assets[0]; setImage({ uri: file.uri, fileSize: file.size ?? null, mimeType: 'application/pdf', width: 0, height: 0 }); setConfirmed(false); }
    } catch { setFeedback({ kind: 'error', text: 'The PDF could not be selected. Please try again.' }); }
    finally { setBusy(false); }
  };

  const customerOptions = useMemo(() => customersWithVehicles.map((customer) => ({
    label: customerName(customer),
    sublabel: customer.email,
    value: customer.user_id,
  })), [customersWithVehicles]);
  const vehicleOptions = useMemo(() => availableVehicles
    .slice()
    .sort((left, right) => `${left.year} ${left.make} ${left.model}`.localeCompare(`${right.year} ${right.make} ${right.model}`, 'en-AU'))
    .map((vehicle) => ({
      label: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      sublabel: vehicle.registration,
      value: vehicle.id,
    })), [availableVehicles]);

  const selectCustomer = (nextCustomerId: string) => {
    if (busy) return;
    setCustomerId(nextCustomerId);
    setVehicleId('');
    setImage(null);
    setConfirmed(false);
    setFeedback(null);
  };

  const selectRecordType = (nextType: RecordType) => {
    if (busy) return;
    setRecordType(nextType);
    setConfirmed(false);
    setFeedback(null);
    setImage(null);
  };

  const publish = async () => {
    if (!customerId || !vehicleId || !confirmed || busy || !availableVehicles.some(v => v.id === vehicleId)) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (recordType === 'repair') {
        await publishPsiRepair({ customerId, date, notes, odometerKm: odometer, recordKind: repairKind, title, vehicleId });
        setFeedback({ kind: 'success', text: 'PSI repair history published. The customer will see it as a read-only PSI record.' });
      } else if (recordType === 'recommendation') {
        await publishPsiRecommendation({ customerId, notes, status: recommendationStatus, timing, title, vehicleId });
        setFeedback({ kind: 'success', text: 'Recommended work published as a read-only PSI record.' });
      } else if (recordType === 'dyno') {
        const result = await publishPsiDyno({ customerId, date, fuel, image, notes, powerHp: power, torqueNm: torque, vehicleId });
        setFeedback(result.attachmentWarning
          ? { kind: 'warning', text: result.attachmentWarning }
          : { kind: 'success', text: `PSI verified dyno result published${result.attachmentStored ? ' with a private PDF report' : ''}.` });
      } else {
        const result = await publishPsiInvoice({ amountAud, customerId, date, image, invoiceNumber, summary: notes, vehicleId });
        setFeedback(result.attachmentWarning
          ? { kind: 'warning', text: result.attachmentWarning }
          : { kind: 'success', text: `Invoice published in AUD${result.attachmentStored ? ' with a private PDF attachment' : ''}.` });
      }
      resetPublishedFields();
    } catch (error) {
      setFeedback({ kind: 'error', text: publishingErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const resetPublishedFields = () => {
    setTitle('');
    setNotes('');
    setOdometer('');
    setTiming('');
    setPower('');
    setTorque('');
    setFuel('');
    setInvoiceNumber('');
    setAmountAud('');
    setImage(null);
    setConfirmed(false);
    setDate(initialDate);
    setRepairKind('service');
    setRecommendationStatus('recommended');
    onDirtyChange?.(false);
  };

  if (!firstCustomerWithVehicle) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Publishing waits for a customer vehicle</Text>
        <Text style={styles.muted}>No active customer with an active vehicle is available. Nothing can be published yet.</Text>
      </View>
    );
  }

  const selectedCustomer = snapshot.customers.find((customer) => customer.user_id === customerId);
  const selectedVehicle = snapshot.vehicles.find((vehicle) => vehicle.id === vehicleId);
  return (
    <View pointerEvents={busy ? 'none' : 'auto'} style={styles.publisher}>
      {REVIEW_ENVIRONMENT.enabled ? <View style={styles.notice}>
        <Ionicons color={colors.accent} name="shield-checkmark" size={22} />
        <View style={styles.flex}>
          <Text style={styles.noticeTitle}>Sandbox records</Text>
          <Text style={styles.muted}>Changes affect demonstration customers only.</Text>
        </View>
      </View> : null}

      <StaffScrollSelect label="Choose customer" onChange={selectCustomer} options={customerOptions} searchable value={customerId} />

      <StaffScrollSelect
        label="Choose vehicle"
        onChange={(nextVehicleId) => {
          if (busy) return;
          setVehicleId(nextVehicleId);
          setImage(null);
          setConfirmed(false);
          setFeedback(null);
        }}
        options={vehicleOptions}
        searchable
        value={vehicleId}
      />

      {!fixedType ? <><Text style={styles.label}>PSI record type</Text>
      <View style={styles.recordGrid}>
        {RECORD_TYPES.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: recordType === option.value }}
            disabled={busy}
            key={option.value}
            onPress={() => selectRecordType(option.value)}
            style={[styles.recordChoice, recordType === option.value && styles.selectedChoice]}
          >
            <Ionicons color={recordType === option.value ? colors.ink : colors.accent} name={option.icon} size={21} />
            <Text style={[styles.recordChoiceText, recordType === option.value && styles.selectedChoiceText]}>{option.label}</Text>
          </Pressable>
        ))}
      </View></> : null}

      <View style={styles.form}>
        {recordType === 'repair' ? (
          <>
            <Field label="Repair / service title"><FormInput editable={!busy} onChangeText={edit(setTitle)} placeholder="Service & workshop inspection" value={title} /></Field>
            <Field hint="DD/MM/YYYY" label="Completed date"><FormInput editable={!busy} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={edit(setDate)} value={date} /></Field>
            <Field hint="Optional" label="Odometer (km)"><FormInput editable={!busy} keyboardType="number-pad" onChangeText={(value) => edit(setOdometer)(value.replace(/\D/gu, ''))} placeholder="84210" value={odometer} /></Field>
            <Text style={styles.smallLabel}>Record category</Text>
            <View style={styles.inlineChoices}>{(['service', 'repair', 'inspection'] as const).map((value) => <SmallChoice disabled={busy} key={value} label={capitalize(value)} onPress={() => edit(setRepairKind)(value)} selected={repairKind === value} />)}</View>
            <NotesField disabled={busy} label="Completed work / notes" onChangeText={edit(setNotes)} value={notes} />
          </>
        ) : null}

        {recordType === 'recommendation' ? (
          <>
            <Field label="Recommended work"><FormInput editable={!busy} onChangeText={edit(setTitle)} placeholder="Front brake pads" value={title} /></Field>
            <Field hint="Optional" label="Timing"><FormInput editable={!busy} onChangeText={edit(setTiming)} placeholder="Before the next performance stage" value={timing} /></Field>
            <Text style={styles.smallLabel}>Status</Text>
            <View style={styles.inlineChoices}>{(['monitor', 'recommended', 'due_soon', 'priority'] as const).map((value) => <SmallChoice disabled={busy} key={value} label={statusLabel(value)} onPress={() => edit(setRecommendationStatus)(value)} selected={recommendationStatus === value} />)}</View>
            <NotesField disabled={busy} label="Recommendation notes" onChangeText={edit(setNotes)} value={notes} />
          </>
        ) : null}

        {recordType === 'dyno' ? (
          <>
            <Field hint="DD/MM/YYYY" label="Dyno date"><FormInput editable={!busy} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={edit(setDate)} value={date} /></Field>
            <View style={styles.twoColumn}>
              <View style={styles.column}><Field label="Peak power · HP at hubs"><FormInput editable={!busy} keyboardType="decimal-pad" onChangeText={edit(setPower)} placeholder="426" value={power} /></Field></View>
              <View style={styles.column}><Field hint="Optional" label="Peak torque · Nm at hubs"><FormInput editable={!busy} keyboardType="decimal-pad" onChangeText={edit(setTorque)} placeholder="684" value={torque} /></Field></View>
            </View>
            <Field hint="Optional" label="Fuel"><FormInput editable={!busy} onChangeText={edit(setFuel)} placeholder="98 RON" value={fuel} /></Field>
            <NotesField disabled={busy} label="Setup / run notes" onChangeText={edit(setNotes)} value={notes} />
            <PrivateImagePicker
              disabled={busy}
              image={image}
              label="Mainline dyno PDF"
              pdfOnly
              onChoose={() => void choosePdf()}
              onTakePhoto={() => void choosePdf()}
              onRemove={() => edit(setImage)(null)}
            />
          </>
        ) : null}

        {recordType === 'invoice' ? (
          <>
            <Field label="Invoice number"><FormInput editable={!busy} autoCapitalize="characters" onChangeText={edit(setInvoiceNumber)} placeholder="PSI-INV-2026-0514" value={invoiceNumber} /></Field>
            <Field hint="DD/MM/YYYY" label="Invoice date"><FormInput editable={!busy} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={edit(setDate)} value={date} /></Field>
            <Field hint="Optional · AUD" label="Amount"><FormInput editable={!busy} keyboardType="decimal-pad" onChangeText={edit(setAmountAud)} placeholder="423.50" value={amountAud} /></Field>
            <NotesField disabled={busy} label="Completed work summary" onChangeText={edit(setNotes)} value={notes} />
            <PrivateImagePicker
              disabled={busy}
              image={image}
              label="Invoice PDF"
              pdfOnly
              onChoose={() => void choosePdf()}
              onTakePhoto={() => void choosePdf()}
              onRemove={() => edit(setImage)(null)}
            />
          </>
        ) : null}
      </View>

      <View style={styles.review}>
        <Text style={styles.reviewTitle}>Publish to customer record</Text>
        <Text style={styles.muted}>{customerName(selectedCustomer)} · {selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.registration}` : 'Select a vehicle'}</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} disabled={busy} onPress={() => setConfirmed((value) => !value)} style={styles.confirmRow}>
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>{confirmed ? <Ionicons color={colors.ink} name="checkmark" size={16} /> : null}</View>
          <Text style={styles.confirmText}>I checked the customer, registration and record details.</Text>
        </Pressable>
        {feedback ? <Text accessibilityRole="alert" style={[styles.feedback, feedback.kind === 'error' && styles.feedbackError, feedback.kind === 'warning' && styles.feedbackWarning]}>{feedback.text}</Text> : null}
        <PrimaryButton disabled={!confirmed || !vehicleId || busy} label="Publish record" loading={busy} onPress={() => void publish()} />
      </View>
    </View>
  );
}

function SmallChoice({ label, onPress, selected, disabled }: { label: string; onPress: () => void; selected: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.smallChoice, selected && styles.selectedChoice]}><Text style={[styles.smallChoiceText, selected && styles.selectedChoiceText]}>{label}</Text></Pressable>;
}

function NotesField({ label, onChangeText, value, disabled }: { label: string; onChangeText: (value: string) => void; value: string; disabled?: boolean }) {
  return <Field hint="Optional" label={label}><FormInput editable={!disabled} multiline numberOfLines={4} onChangeText={onChangeText} placeholder="Add workshop notes" style={styles.notesInput} textAlignVertical="top" value={value} /></Field>;
}

function PrivateImagePicker({
  image,
  label,
  onChoose,
  onTakePhoto,
  onRemove,
  pdfOnly = false,
  disabled = false,
}: { image: StaffPublishImage | null; label: string; onChoose: () => void; onTakePhoto: () => void; onRemove: () => void; pdfOnly?: boolean; disabled?: boolean }) {
  return (
    <View style={styles.imageSection}>
      <Text style={styles.smallLabel}>{label}</Text>
      {image?.mimeType === 'application/pdf' ? <Text style={styles.muted}>PDF selected · ready to upload</Text> : image ? <Image accessibilityLabel={`Selected ${label.toLowerCase()}`} resizeMode="contain" source={{ uri: image.uri }} style={styles.imagePreview} /> : null}
      <View style={styles.inlineChoices}>
        {!pdfOnly ? <PrimaryButton disabled={disabled} label="Take photo" onPress={onTakePhoto} variant="outline" /> : null}
        <PrimaryButton disabled={disabled} label={pdfOnly ? image ? 'Replace PDF' : 'Choose PDF' : image ? 'Replace image' : 'Choose image'} onPress={onChoose} variant="outline" />
        {image ? <PrimaryButton disabled={disabled} label="Remove" onPress={onRemove} variant="outline" /> : null}
      </View>
      <Text style={styles.pdfNote}>PDF up to 6 MB. Uploaded when you publish.</Text>
    </View>
  );
}

function customerName(customer: StaffPortalSnapshot['customers'][number] | undefined) {
  if (!customer) return 'Customer unavailable';
  return [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email;
}

function statusLabel(value: 'due_soon' | 'monitor' | 'priority' | 'recommended') {
  if (value === 'due_soon') return 'Due Soon';
  return capitalize(value);
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function publishingErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code.includes('PDF')) return 'Select the original Mainline PDF report. The file must be a valid PDF smaller than 6 MB.';
  if (code.includes('CAMERA_PERMISSION_DENIED')) return 'Allow camera access and try again.';
  if (code.includes('MEDIA_PERMISSION_DENIED')) return 'Allow photos access and try again.';
  if (code.includes('IMAGE_TOO_LARGE')) return 'Choose an image smaller than 6 MB for this reliable private upload.';
  if (code.includes('IMAGE_TYPE_UNSUPPORTED')) return 'Choose a JPG, PNG or WebP image.';
  if (code.includes('UPLOAD_CLEANUP_REQUIRED')) return 'The record was not published and the unused private image could not be removed automatically. Stop and review private Storage before retrying.';
  if (code.includes('DATE_INVALID')) return 'Enter a real date in DD/MM/YYYY format.';
  if (code.includes('TITLE_REQUIRED') || code.includes('SUMMARY_REQUIRED') || code.includes('NUMBER_REQUIRED')) return 'Complete the required title, summary or invoice number.';
  if (code.includes('POWER_INVALID') || code.includes('TORQUE_INVALID')) return 'Power and torque must be positive numbers; torque may be left blank.';
  if (code.includes('ODOMETER_INVALID')) return 'Odometer must be a whole number in kilometres.';
  if (code.includes('AMOUNT_INVALID')) return 'Enter the AUD amount as dollars and cents, for example 423.50.';
  if (code.includes('AAL2') || code.includes('JWT') || code.includes('session')) return 'Your protected staff session needs authenticator verification again. Return to the staff gate and re-open this workspace.';
  if ((error as { code?: string } | null)?.code === '23505') return 'That invoice number already exists. Check the existing record before trying again.';
  return 'This PSI record could not be published. No success is being claimed; check the details and protected staff session, then try again.';
}

const styles = StyleSheet.create({
  publisher: { gap: spacing.md },
  flex: { flex: 1 },
  notice: { ...mobileFrame, alignItems: 'flex-start', backgroundColor: colors.panel, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  noticeTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: spacing.sm, textTransform: 'uppercase' },
  smallLabel: { color: colors.silver, fontSize: 13, fontWeight: '800' },
  selectedChoice: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectedChoiceText: { color: colors.ink },
  selectedChoiceSub: { color: '#0C3444' },
  recordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recordChoice: { ...mobileFrame, alignItems: 'center', backgroundColor: colors.inkSoft, flexDirection: 'row', flexGrow: 1, gap: spacing.sm, minHeight: 54, minWidth: 180, padding: spacing.sm },
  recordChoiceText: { color: colors.white, flexShrink: 1, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  form: { ...mobileFrame, backgroundColor: colors.panel, gap: spacing.md, padding: spacing.md },
  inlineChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  smallChoice: { ...mobileFrame, backgroundColor: colors.inkSoft, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  smallChoiceText: { color: colors.white, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
  notesInput: { minHeight: 112 },
  imageSection: { gap: spacing.sm },
  imagePreview: { ...mobileFrame, backgroundColor: colors.ink, height: 220, width: '100%' },
  pdfNote: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  review: { ...mobileFrame, backgroundColor: colors.inkSoft, gap: spacing.md, padding: spacing.md },
  reviewTitle: { color: colors.white, fontSize: 18, fontWeight: '900' },
  confirmRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', borderColor: colors.accent, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.accent },
  confirmText: { color: colors.silver, flex: 1, fontSize: 12, lineHeight: 18 },
  feedback: { color: colors.success, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  feedbackError: { color: colors.danger },
  feedbackWarning: { color: colors.accent },
  empty: { ...mobileFrame, backgroundColor: colors.panel, gap: spacing.sm, padding: spacing.lg },
  emptyTitle: { color: colors.white, fontSize: 16, fontWeight: '900' },
});
