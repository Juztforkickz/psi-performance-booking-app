import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import type { StaffPortalSnapshot } from '@/lib/staff-portal';
import {
  publishPsiDyno,
  publishPsiInvoice,
  publishPsiRecommendation,
  publishPsiRepair,
  type StaffPublishImage,
} from '@/lib/staff-record-publishing';

type RecordType = 'dyno' | 'invoice' | 'recommendation' | 'repair';

const RECORD_TYPES: { icon: keyof typeof Ionicons.glyphMap; label: string; value: RecordType }[] = [
  { icon: 'construct', label: 'Repair history', value: 'repair' },
  { icon: 'alert-circle', label: 'Recommended work', value: 'recommendation' },
  { icon: 'speedometer', label: 'Verified dyno', value: 'dyno' },
  { icon: 'receipt', label: 'Invoice', value: 'invoice' },
];

const TODAY = new Date().toISOString().slice(0, 10);

export function StaffRecordPublisher({ snapshot }: { snapshot: StaffPortalSnapshot }) {
  const firstCustomerWithVehicle = snapshot.customers.find((customer) => snapshot.vehicles.some((vehicle) => vehicle.customer_id === customer.user_id));
  const [customerId, setCustomerId] = useState(firstCustomerWithVehicle?.user_id ?? '');
  const availableVehicles = useMemo(
    () => snapshot.vehicles.filter((vehicle) => vehicle.customer_id === customerId),
    [customerId, snapshot.vehicles],
  );
  const [vehicleId, setVehicleId] = useState(availableVehicles[0]?.id ?? '');
  const [recordType, setRecordType] = useState<RecordType>('repair');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success' | 'warning'; text: string } | null>(null);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(TODAY);
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

  const selectCustomer = (nextCustomerId: string) => {
    setCustomerId(nextCustomerId);
    setVehicleId(snapshot.vehicles.find((vehicle) => vehicle.customer_id === nextCustomerId)?.id ?? '');
    setConfirmed(false);
    setFeedback(null);
  };

  const selectRecordType = (nextType: RecordType) => {
    setRecordType(nextType);
    setConfirmed(false);
    setFeedback(null);
    setImage(null);
  };

  const chooseImage = async () => {
    setFeedback(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: false,
        base64: false,
        exif: false,
        mediaTypes: ['images'],
        quality: 0.9,
        selectionLimit: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('IMAGE_UNAVAILABLE');
      if (asset.fileSize && asset.fileSize > 6 * 1024 * 1024) throw new Error('IMAGE_TOO_LARGE');
      setImage({
        fileSize: asset.fileSize ?? null,
        height: asset.height,
        mimeType: asset.mimeType ?? null,
        uri: asset.uri,
        width: asset.width,
      });
      setConfirmed(false);
    } catch (error) {
      setFeedback({ kind: 'error', text: publishingErrorMessage(error) });
    }
  };

  const publish = async () => {
    if (!customerId || !vehicleId || !confirmed || busy) return;
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
        const result = await publishPsiDyno({ customerId, date, fuel, image, notes, powerKw: power, torqueNm: torque, vehicleId });
        setFeedback(result.attachmentWarning
          ? { kind: 'warning', text: result.attachmentWarning }
          : { kind: 'success', text: `PSI verified dyno result published${result.attachmentStored ? ' with a private graph image' : ''}.` });
      } else {
        const result = await publishPsiInvoice({ amountAud, customerId, date, image, invoiceNumber, summary: notes, vehicleId });
        setFeedback(result.attachmentWarning
          ? { kind: 'warning', text: result.attachmentWarning }
          : { kind: 'success', text: `Invoice published in AUD${result.attachmentStored ? ' with a private image attachment' : ''}.` });
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
    <View style={styles.publisher}>
      <View style={styles.notice}>
        <Ionicons color={colors.gold} name="shield-checkmark" size={22} />
        <View style={styles.flex}>
          <Text style={styles.noticeTitle}>Controlled PSI publishing</Text>
          <Text style={styles.muted}>Every publish is an authenticated AAL2 workshop write. Customers can read PSI records but cannot mark their own entries as PSI verified.</Text>
        </View>
      </View>

      <Text style={styles.label}>1 · Customer</Text>
      <View style={styles.choiceGrid}>
        {snapshot.customers.filter((customer) => snapshot.vehicles.some((vehicle) => vehicle.customer_id === customer.user_id)).map((customer) => (
          <ChoiceButton
            key={customer.user_id}
            label={customerName(customer)}
            onPress={() => selectCustomer(customer.user_id)}
            selected={customer.user_id === customerId}
            sublabel={customer.email}
          />
        ))}
      </View>

      <Text style={styles.label}>2 · Vehicle</Text>
      <View style={styles.choiceGrid}>
        {availableVehicles.map((vehicle) => (
          <ChoiceButton
            key={vehicle.id}
            label={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            onPress={() => {
              setVehicleId(vehicle.id);
              setConfirmed(false);
              setFeedback(null);
            }}
            selected={vehicle.id === vehicleId}
            sublabel={vehicle.registration}
          />
        ))}
      </View>

      <Text style={styles.label}>3 · PSI record type</Text>
      <View style={styles.recordGrid}>
        {RECORD_TYPES.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: recordType === option.value }}
            key={option.value}
            onPress={() => selectRecordType(option.value)}
            style={[styles.recordChoice, recordType === option.value && styles.selectedChoice]}
          >
            <Ionicons color={recordType === option.value ? colors.ink : colors.gold} name={option.icon} size={21} />
            <Text style={[styles.recordChoiceText, recordType === option.value && styles.selectedChoiceText]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.form}>
        {recordType === 'repair' ? (
          <>
            <Field label="Repair / service title"><FormInput onChangeText={setTitle} placeholder="Service & workshop inspection" value={title} /></Field>
            <Field hint="YYYY-MM-DD" label="Completed date"><FormInput keyboardType="numbers-and-punctuation" onChangeText={setDate} value={date} /></Field>
            <Field hint="Optional" label="Odometer (km)"><FormInput keyboardType="number-pad" onChangeText={(value) => setOdometer(value.replace(/\D/gu, ''))} placeholder="84210" value={odometer} /></Field>
            <Text style={styles.smallLabel}>Record category</Text>
            <View style={styles.inlineChoices}>{(['service', 'repair', 'inspection'] as const).map((value) => <SmallChoice key={value} label={capitalize(value)} onPress={() => setRepairKind(value)} selected={repairKind === value} />)}</View>
            <NotesField label="Completed work / notes" onChangeText={setNotes} value={notes} />
          </>
        ) : null}

        {recordType === 'recommendation' ? (
          <>
            <Field label="Recommended work"><FormInput onChangeText={setTitle} placeholder="Front brake pads" value={title} /></Field>
            <Field hint="Optional" label="Timing"><FormInput onChangeText={setTiming} placeholder="Before the next performance stage" value={timing} /></Field>
            <Text style={styles.smallLabel}>Status</Text>
            <View style={styles.inlineChoices}>{(['monitor', 'recommended', 'due_soon', 'priority'] as const).map((value) => <SmallChoice key={value} label={statusLabel(value)} onPress={() => setRecommendationStatus(value)} selected={recommendationStatus === value} />)}</View>
            <NotesField label="Recommendation notes" onChangeText={setNotes} value={notes} />
          </>
        ) : null}

        {recordType === 'dyno' ? (
          <>
            <Field hint="YYYY-MM-DD" label="Dyno date"><FormInput keyboardType="numbers-and-punctuation" onChangeText={setDate} value={date} /></Field>
            <View style={styles.twoColumn}>
              <View style={styles.column}><Field label="Peak power · kW at hubs"><FormInput keyboardType="decimal-pad" onChangeText={setPower} placeholder="312.5" value={power} /></Field></View>
              <View style={styles.column}><Field hint="Optional" label="Peak torque · Nm at hubs"><FormInput keyboardType="decimal-pad" onChangeText={setTorque} placeholder="684" value={torque} /></Field></View>
            </View>
            <Field hint="Optional" label="Fuel"><FormInput onChangeText={setFuel} placeholder="98 RON" value={fuel} /></Field>
            <NotesField label="Setup / run notes" onChangeText={setNotes} value={notes} />
            <PrivateImagePicker image={image} label="Dyno graph image" onChoose={() => void chooseImage()} onRemove={() => setImage(null)} />
          </>
        ) : null}

        {recordType === 'invoice' ? (
          <>
            <Field label="Invoice number"><FormInput autoCapitalize="characters" onChangeText={setInvoiceNumber} placeholder="PSI-INV-2026-0514" value={invoiceNumber} /></Field>
            <Field hint="YYYY-MM-DD" label="Invoice date"><FormInput keyboardType="numbers-and-punctuation" onChangeText={setDate} value={date} /></Field>
            <Field hint="Optional · AUD" label="Amount"><FormInput keyboardType="decimal-pad" onChangeText={setAmountAud} placeholder="423.50" value={amountAud} /></Field>
            <NotesField label="Completed work summary" onChangeText={setNotes} value={notes} />
            <PrivateImagePicker image={image} label="Invoice image" onChoose={() => void chooseImage()} onRemove={() => setImage(null)} />
            <Text style={styles.pdfNote}>PDF publishing will be added after a reviewed private document-picker workflow. This stage accepts JPG, PNG or WebP images only.</Text>
          </>
        ) : null}
      </View>

      <View style={styles.review}>
        <Text style={styles.reviewTitle}>Publish to customer record</Text>
        <Text style={styles.muted}>{customerName(selectedCustomer)} · {selectedVehicle ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} · ${selectedVehicle.registration}` : 'Select a vehicle'}</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed((value) => !value)} style={styles.confirmRow}>
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>{confirmed ? <Ionicons color={colors.ink} name="checkmark" size={16} /> : null}</View>
          <Text style={styles.confirmText}>I checked the customer, vehicle and record details. Publish this as a PSI-controlled, customer-visible record.</Text>
        </Pressable>
        {feedback ? <Text accessibilityRole="alert" style={[styles.feedback, feedback.kind === 'error' && styles.feedbackError, feedback.kind === 'warning' && styles.feedbackWarning]}>{feedback.text}</Text> : null}
        <PrimaryButton disabled={!confirmed || !vehicleId} label="Publish PSI record" loading={busy} onPress={() => void publish()} />
      </View>
    </View>
  );
}

function ChoiceButton({ label, onPress, selected, sublabel }: { label: string; onPress: () => void; selected: boolean; sublabel: string }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choice, selected && styles.selectedChoice]}>
      <Text style={[styles.choiceTitle, selected && styles.selectedChoiceText]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.choiceSub, selected && styles.selectedChoiceSub]}>{sublabel}</Text>
    </Pressable>
  );
}

function SmallChoice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.smallChoice, selected && styles.selectedChoice]}><Text style={[styles.smallChoiceText, selected && styles.selectedChoiceText]}>{label}</Text></Pressable>;
}

function NotesField({ label, onChangeText, value }: { label: string; onChangeText: (value: string) => void; value: string }) {
  return <Field hint="Optional" label={label}><FormInput multiline numberOfLines={4} onChangeText={onChangeText} placeholder="Add workshop notes" style={styles.notesInput} textAlignVertical="top" value={value} /></Field>;
}

function PrivateImagePicker({ image, label, onChoose, onRemove }: { image: StaffPublishImage | null; label: string; onChoose: () => void; onRemove: () => void }) {
  return (
    <View style={styles.imageSection}>
      <Text style={styles.smallLabel}>{label}</Text>
      {image ? <Image accessibilityLabel={`Selected ${label.toLowerCase()}`} resizeMode="contain" source={{ uri: image.uri }} style={styles.imagePreview} /> : null}
      <View style={styles.inlineChoices}>
        <PrimaryButton label={image ? 'Replace image' : 'Choose image'} onPress={onChoose} variant="outline" />
        {image ? <PrimaryButton label="Remove" onPress={onRemove} variant="outline" /> : null}
      </View>
      <Text style={styles.pdfNote}>Private upload only after Publish is pressed · maximum 6 MB · never placed in the public bucket.</Text>
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
  if (code.includes('IMAGE_TOO_LARGE')) return 'Choose an image smaller than 6 MB for this reliable private upload.';
  if (code.includes('IMAGE_TYPE_UNSUPPORTED')) return 'Choose a JPG, PNG or WebP image.';
  if (code.includes('UPLOAD_CLEANUP_REQUIRED')) return 'The record was not published and the unused private image could not be removed automatically. Stop and review private Storage before retrying.';
  if (code.includes('DATE_INVALID')) return 'Enter a real date in YYYY-MM-DD format.';
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
  label: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: spacing.sm, textTransform: 'uppercase' },
  smallLabel: { color: colors.cream, fontSize: 13, fontWeight: '800' },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { ...mobileFrame, backgroundColor: colors.inkSoft, flexGrow: 1, minWidth: 210, padding: spacing.md },
  choiceTitle: { color: colors.white, fontSize: 14, fontWeight: '900' },
  choiceSub: { color: colors.muted, fontSize: 11, marginTop: 3 },
  selectedChoice: { backgroundColor: colors.gold, borderColor: colors.gold },
  selectedChoiceText: { color: colors.ink },
  selectedChoiceSub: { color: '#4A360A' },
  recordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recordChoice: { ...mobileFrame, alignItems: 'center', backgroundColor: colors.inkSoft, flexDirection: 'row', flexGrow: 1, gap: spacing.sm, minHeight: 54, minWidth: 180, padding: spacing.sm },
  recordChoiceText: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  form: { ...mobileFrame, backgroundColor: colors.panel, gap: spacing.md, padding: spacing.md },
  inlineChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  smallChoice: { ...mobileFrame, backgroundColor: colors.inkSoft, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  smallChoiceText: { color: colors.white, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flex: 1, minWidth: 220 },
  notesInput: { minHeight: 112 },
  imageSection: { gap: spacing.sm },
  imagePreview: { ...mobileFrame, backgroundColor: colors.ink, height: 220, width: '100%' },
  pdfNote: { color: colors.mutedDark, fontSize: 11, lineHeight: 17 },
  review: { ...mobileFrame, backgroundColor: colors.inkSoft, gap: spacing.md, padding: spacing.md },
  reviewTitle: { color: colors.white, fontSize: 18, fontWeight: '900' },
  confirmRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', borderColor: colors.gold, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.gold },
  confirmText: { color: colors.cream, flex: 1, fontSize: 12, lineHeight: 18 },
  feedback: { color: colors.success, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  feedbackError: { color: colors.danger },
  feedbackWarning: { color: colors.gold },
  empty: { ...mobileFrame, backgroundColor: colors.panel, gap: spacing.sm, padding: spacing.lg },
  emptyTitle: { color: colors.white, fontSize: 16, fontWeight: '900' },
});
