import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { australianDateToIso, formatAustralianDate } from '@/lib/australian-date';
import type { CustomerAccountSnapshot } from '@/lib/customer-account';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { useCustomerPreview } from '@/lib/customer-preview-context';
import { releaseLocalVehiclePhoto } from '@/lib/local-vehicle-photo';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getAccountDynoRecords,
  getAccountFutureRepairs,
  getAccountInvoices,
  getAccountRepairRecords,
  getAccountReportVehicles,
  loadCustomerVehicleReports,
  type CustomerVehicleReportsSnapshot,
} from '@/lib/vehicle-reports-account';
import {
  filterVehicleRecords,
  FUTURE_REPAIR_STATUS_LABELS,
  PREVIEW_DYNO_RECORDS,
  PREVIEW_FUTURE_REPAIRS,
  PREVIEW_INVOICE_RECORDS,
  PREVIEW_REPAIR_RECORDS,
  type DynoRecord,
  type FutureRepair,
  type FutureRepairStatus,
  type InvoiceRecord,
  type PreviewAttachment,
  type RepairRecord,
  type SecureVehicleAttachment,
} from '@/lib/vehicle-reports-preview';

type DynoDraft = {
  date: string;
  fuel: string;
  graphImage: PreviewAttachment | null;
  notes: string;
  power: string;
  torque: string;
};

type RepairDraft = {
  date: string;
  description: string;
  odometer: string;
  title: string;
};

type FutureRepairDraft = {
  notes: string;
  status: FutureRepairStatus;
  timing: string;
  title: string;
};

type InvoiceDraft = {
  amount: string;
  attachment: PreviewAttachment | null;
  date: string;
  invoiceNumber: string;
  summary: string;
};

const EMPTY_DYNO_DRAFT: DynoDraft = { date: '', fuel: '', graphImage: null, notes: '', power: '', torque: '' };
const EMPTY_REPAIR_DRAFT: RepairDraft = { date: '', description: '', odometer: '', title: '' };
const EMPTY_FUTURE_DRAFT: FutureRepairDraft = { notes: '', status: 'monitor', timing: '', title: '' };
const EMPTY_INVOICE_DRAFT: InvoiceDraft = { amount: '', attachment: null, date: '', invoiceNumber: '', summary: '' };

export default function VehicleReportsScreen() {
  const auth = useCustomerAuth();
  const { account, error, status } = useCustomerAccount();
  const secureAccountActive = CUSTOMER_AUTH.enabled && auth.status === 'signed_in';

  if (CUSTOMER_AUTH.enabled && auth.status === 'loading') {
    return <VehicleReportsAccountState copy="Restoring your account…" loading title="Opening vehicle reports" />;
  }
  if (secureAccountActive && status === 'loading') {
    return <VehicleReportsAccountState copy="Loading your vehicle records…" loading title="Opening vehicle reports" />;
  }
  if (secureAccountActive && (status === 'error' || !account)) {
    return <VehicleReportsAccountState copy={error || 'Your private vehicle records could not be loaded.'} title="Vehicle reports unavailable" />;
  }
  if (secureAccountActive && account?.vehicles.length === 0) {
    return <VehicleReportsAccountState actionLabel="Add your first vehicle" copy="Your account is ready. Add a vehicle to begin." title="Vehicle reports are ready" />;
  }

  if (secureAccountActive && account) {
    return <AuthenticatedVehicleReportsScreen account={account} key={account.user.id} />;
  }
  return <VehicleReportsContent secureAccount={null} secureReports={null} />;
}

type ReportsLoadState =
  | { reports: null; status: 'error' | 'loading' }
  | { reports: CustomerVehicleReportsSnapshot; status: 'ready' };

function AuthenticatedVehicleReportsScreen({ account }: { account: CustomerAccountSnapshot }) {
  const [loadState, setLoadState] = useState<ReportsLoadState>({ reports: null, status: 'loading' });

  useEffect(() => {
    let active = true;
    void loadCustomerVehicleReports()
      .then((reports) => {
        if (active) setLoadState({ reports, status: 'ready' });
      })
      .catch(() => {
        if (active) setLoadState({ reports: null, status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [account.user.id]);

  if (loadState.status === 'loading') {
    return <VehicleReportsAccountState copy="Loading your vehicle records…" loading title="Opening vehicle reports" />;
  }
  if (loadState.status === 'error') {
    return <VehicleReportsAccountState copy="Your vehicle records could not be loaded. Please try again." title="Vehicle reports unavailable" />;
  }
  return <VehicleReportsContent secureAccount={account} secureReports={loadState.reports} />;
}

function VehicleReportsAccountState({
  actionLabel,
  copy,
  loading = false,
  title,
}: {
  actionLabel?: string;
  copy: string;
  loading?: boolean;
  title: string;
}) {
  const router = useRouter();
  const { horizontalPadding } = useResponsiveLayout();
  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <View style={[styles.accountState, { paddingHorizontal: horizontalPadding }]}>
        {loading ? <ActivityIndicator color={colors.accent} size="large" /> : <Ionicons color={colors.accent} name="document-text" size={38} />}
        <Text style={styles.accountStateTitle}>{title}</Text>
        <Text style={styles.accountStateCopy}>{copy}</Text>
        {actionLabel ? <PrimaryButton label={actionLabel} onPress={() => router.push('/account/sign-up')} /> : null}
        {!loading ? <PrimaryButton label="Open account" onPress={() => router.push('/account')} variant="outline" /> : null}
      </View>
    </SafeAreaView>
  );
}

function VehicleReportsContent({
  secureAccount,
  secureReports,
}: {
  secureAccount: CustomerAccountSnapshot | null;
  secureReports: CustomerVehicleReportsSnapshot | null;
}) {
  const router = useRouter();
  const { vehicleId: requestedVehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const { compact, horizontalPadding, largeText, tablet } = useResponsiveLayout();
  const {
    selectedVehicleId: previewSelectedVehicleId,
    selectVehicle,
    vehicleMaintenance,
    vehicles: previewVehicles,
  } = useCustomerPreview();
  const secureVehicles = secureAccount ? getAccountReportVehicles(secureAccount) : null;
  const vehicles = secureVehicles ?? previewVehicles;
  const [secureSelectedVehicleId, setSecureSelectedVehicleId] = useState(() => secureVehicles?.find((vehicle) => vehicle.id === requestedVehicleId)?.id ?? secureVehicles?.find((vehicle) => vehicle.isPrimary)?.id ?? secureVehicles?.[0]?.id ?? '');
  const [vehicleSelectorOpen, setVehicleSelectorOpen] = useState(false);
  const selectedVehicleId = secureVehicles ? secureSelectedVehicleId : previewSelectedVehicleId;
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];
  const vehicleLabel = `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`;
  const localMaintenance = vehicleMaintenance[selectedVehicle.id];
  const maintenance = secureVehicles ? {
    customerLastServiceDate: localMaintenance?.customerLastServiceDate ?? null,
    customerNextCheckInDate: localMaintenance?.customerNextCheckInDate ?? null,
    odometerKm: selectedVehicle.odometerKm,
    updatedLocally: Boolean(localMaintenance?.customerLastServiceDate || localMaintenance?.customerNextCheckInDate),
  } : localMaintenance ?? {
    customerLastServiceDate: null,
    customerNextCheckInDate: null,
    odometerKm: selectedVehicle.odometerKm,
    updatedLocally: false,
  };

  const [localDynoRecords, setLocalDynoRecords] = useState<DynoRecord[]>([]);
  const [localRepairs, setLocalRepairs] = useState<RepairRecord[]>([]);
  const [localFutureRepairs, setLocalFutureRepairs] = useState<FutureRepair[]>([]);
  const [localInvoices, setLocalInvoices] = useState<InvoiceRecord[]>([]);
  const [dynoDraft, setDynoDraft] = useState<DynoDraft>(EMPTY_DYNO_DRAFT);
  const [repairDraft, setRepairDraft] = useState<RepairDraft>(EMPTY_REPAIR_DRAFT);
  const [futureDraft, setFutureDraft] = useState<FutureRepairDraft>(EMPTY_FUTURE_DRAFT);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(EMPTY_INVOICE_DRAFT);
  const [openForm, setOpenForm] = useState<'dyno' | 'future' | 'invoice' | 'repair' | null>(null);
  const [formError, setFormError] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const [secureAttachmentError, setSecureAttachmentError] = useState('');
  const [loadingSecureAttachmentId, setLoadingSecureAttachmentId] = useState<string | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<{ notice?: string; title: string; uri: string } | null>(null);
  const ownedAttachmentsRef = useRef(new Map<string, PreviewAttachment>());

  useEffect(() => () => {
    ownedAttachmentsRef.current.forEach(releaseLocalVehiclePhoto);
    ownedAttachmentsRef.current.clear();
  }, []);

  const accountConnected = Boolean(secureAccount);
  const dynoRecords = filterVehicleRecords([...(secureReports ? getAccountDynoRecords(secureReports) : PREVIEW_DYNO_RECORDS), ...localDynoRecords], selectedVehicle.id);
  const repairRecords = filterVehicleRecords([...(secureReports ? getAccountRepairRecords(secureReports) : PREVIEW_REPAIR_RECORDS), ...localRepairs], selectedVehicle.id);
  const futureRepairs = [...(secureReports ? getAccountFutureRepairs(secureReports) : PREVIEW_FUTURE_REPAIRS), ...localFutureRepairs].filter((record) => record.vehicleId === selectedVehicle.id);
  const invoices = filterVehicleRecords([...(secureReports ? getAccountInvoices(secureReports) : PREVIEW_INVOICE_RECORDS), ...localInvoices], selectedVehicle.id);

  const releaseAttachment = (attachment: PreviewAttachment | null) => {
    if (!attachment) return;
    ownedAttachmentsRef.current.delete(attachment.uri);
    releaseLocalVehiclePhoto(attachment);
  };

  const handleVehicleSelection = (vehicleId: string) => {
    releaseAttachment(dynoDraft.graphImage);
    releaseAttachment(invoiceDraft.attachment);
    setDynoDraft(EMPTY_DYNO_DRAFT);
    setRepairDraft(EMPTY_REPAIR_DRAFT);
    setFutureDraft(EMPTY_FUTURE_DRAFT);
    setInvoiceDraft(EMPTY_INVOICE_DRAFT);
    setOpenForm(null);
    setFormError('');
    setAttachmentError('');
    setSecureAttachmentError('');
    setVehicleSelectorOpen(false);
    if (secureVehicles) setSecureSelectedVehicleId(vehicleId);
    else selectVehicle(vehicleId);
  };

  const chooseImage = async (
    current: PreviewAttachment | null,
    onChange: (attachment: PreviewAttachment) => void,
  ) => {
    await chooseImageFromSource(current, onChange, 'library');
  };

  const takeImage = async (
    current: PreviewAttachment | null,
    onChange: (attachment: PreviewAttachment) => void,
  ) => {
    await chooseImageFromSource(current, onChange, 'camera');
  };

  const chooseImageFromSource = async (
    current: PreviewAttachment | null,
    onChange: (attachment: PreviewAttachment) => void,
    source: 'library' | 'camera',
  ) => {
    setAttachmentError('');
    try {
      const requestPermission = source === 'camera'
        ? ImagePicker.requestCameraPermissionsAsync
        : ImagePicker.requestMediaLibraryPermissionsAsync;
      const permission = await requestPermission();
      if (!permission.granted) {
        setAttachmentError(source === 'camera'
          ? 'Camera permission is required to take a photo for this attachment.'
          : 'Photo library permission is required to choose an attachment.');
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          mediaTypes: ['images'],
          quality: 0.9,
        })
        : await ImagePicker.launchImageLibraryAsync({
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
      if (!asset?.uri) {
        setAttachmentError('That image could not be opened. Choose a different image and try again.');
        return;
      }
      const attachment = { height: asset.height, uri: asset.uri, width: asset.width };
      if (current?.uri !== attachment.uri) releaseAttachment(current);
      ownedAttachmentsRef.current.set(attachment.uri, attachment);
      onChange(attachment);
    } catch {
      setAttachmentError(source === 'camera'
        ? 'The camera could not be opened. Please try again.'
        : 'The image picker could not be opened. Please try again.');
    }
  };

  const openSecureAttachment = async (attachment: SecureVehicleAttachment, title: string) => {
    if (!secureAccount || loadingSecureAttachmentId) return;
    setSecureAttachmentError('');
    setLoadingSecureAttachmentId(attachment.id);
    try {
      if (!attachment.objectPath.startsWith(`${secureAccount.user.id}/`)) {
        throw new Error('PRIVATE_ATTACHMENT_PATH_MISMATCH');
      }
      if (!attachment.mimeType.startsWith('image/') && attachment.mimeType !== 'application/pdf') {
        throw new Error('PRIVATE_ATTACHMENT_TYPE_UNSUPPORTED');
      }
      const { data, error: signedUrlError } = await getSupabaseClient()
        .storage
        .from(attachment.bucketId)
        .createSignedUrl(attachment.objectPath, 60);
      if (signedUrlError || !data?.signedUrl) throw signedUrlError ?? new Error('PRIVATE_ATTACHMENT_UNAVAILABLE');

      if (attachment.mimeType === 'application/pdf') {
        await Linking.openURL(data.signedUrl);
        return;
      }

      setViewingAttachment({
        notice: 'Private account attachment · read-only link expires after 60 seconds',
        title,
        uri: data.signedUrl,
      });
    } catch {
      setSecureAttachmentError('This private attachment could not be opened. Your session may have expired, or PSI may need to repair the file record.');
    } finally {
      setLoadingSecureAttachmentId(null);
    }
  };

  const startForm = (form: typeof openForm) => {
    setFormError('');
    setAttachmentError('');
    setOpenForm((current) => current === form ? null : form);
  };

  const cancelDyno = () => {
    releaseAttachment(dynoDraft.graphImage);
    setDynoDraft(EMPTY_DYNO_DRAFT);
    setOpenForm(null);
    setFormError('');
  };

  const addDynoRecord = () => {
    const power = Number(dynoDraft.power);
    const torque = Number(dynoDraft.torque);
    const recordedAt = australianDateToIso(dynoDraft.date);
    if (!Number.isFinite(power) || power <= 0 || !Number.isFinite(torque) || torque <= 0 || !recordedAt || !dynoDraft.fuel.trim()) {
      setFormError('Enter valid power, torque, date and fuel details before adding this temporary record.');
      return;
    }
    setLocalDynoRecords((records) => [{
      id: makeLocalId('dyno'),
      vehicleId: selectedVehicle.id,
      recordedAt,
      peakPowerHpAtHubs: power,
      peakTorqueNmAtHubs: torque,
      fuel: dynoDraft.fuel.trim(),
      notes: dynoDraft.notes.trim(),
      graphImage: dynoDraft.graphImage,
      createdBy: 'customer_preview',
      verification: 'customer_preview',
    }, ...records]);
    setDynoDraft(EMPTY_DYNO_DRAFT);
    setOpenForm(null);
    setFormError('');
  };

  const addRepairRecord = () => {
    const odometer = repairDraft.odometer.trim() ? Number(repairDraft.odometer) : null;
    const repairedAt = australianDateToIso(repairDraft.date);
    if (!repairDraft.title.trim() || !repairedAt || !repairDraft.description.trim() || (odometer !== null && (!Number.isFinite(odometer) || odometer < 0))) {
      setFormError('Enter a title, valid date and description. Odometer must be a valid number when provided.');
      return;
    }
    setLocalRepairs((records) => [{
      id: makeLocalId('repair'),
      vehicleId: selectedVehicle.id,
      title: repairDraft.title.trim(),
      repairedAt,
      odometerKm: odometer,
      description: repairDraft.description.trim(),
      createdBy: 'customer_preview',
    }, ...records]);
    setRepairDraft(EMPTY_REPAIR_DRAFT);
    setOpenForm(null);
    setFormError('');
  };

  const addFutureRepair = () => {
    if (!futureDraft.title.trim() || !futureDraft.timing.trim() || !futureDraft.notes.trim()) {
      setFormError('Enter a title, timing and notes before adding this temporary record.');
      return;
    }
    setLocalFutureRepairs((records) => [{
      id: makeLocalId('future'),
      vehicleId: selectedVehicle.id,
      title: futureDraft.title.trim(),
      timing: futureDraft.timing.trim(),
      notes: futureDraft.notes.trim(),
      status: futureDraft.status,
      createdBy: 'customer_preview',
    }, ...records]);
    setFutureDraft(EMPTY_FUTURE_DRAFT);
    setOpenForm(null);
    setFormError('');
  };

  const cancelInvoice = () => {
    releaseAttachment(invoiceDraft.attachment);
    setInvoiceDraft(EMPTY_INVOICE_DRAFT);
    setOpenForm(null);
    setFormError('');
  };

  const addInvoice = () => {
    const amount = invoiceDraft.amount.trim() ? Number(invoiceDraft.amount) : null;
    const invoiceDate = australianDateToIso(invoiceDraft.date);
    if (!invoiceDraft.invoiceNumber.trim() || !invoiceDate || !invoiceDraft.summary.trim() || (amount !== null && (!Number.isFinite(amount) || amount < 0))) {
      setFormError('Enter an invoice number, valid date and work summary. Amount must be valid when provided.');
      return;
    }
    setLocalInvoices((records) => [{
      id: makeLocalId('invoice'),
      vehicleId: selectedVehicle.id,
      invoiceNumber: invoiceDraft.invoiceNumber.trim().toUpperCase(),
      invoiceDate,
      amountAud: amount,
      summary: invoiceDraft.summary.trim(),
      attachment: invoiceDraft.attachment,
      attachmentStatus: invoiceDraft.attachment ? 'image_selected_locally' : 'no_attachment',
      createdBy: 'customer_preview',
    }, ...records]);
    setInvoiceDraft(EMPTY_INVOICE_DRAFT);
    setOpenForm(null);
    setFormError('');
  };

  const replaceInvoiceAttachment = async (record: InvoiceRecord) => {
    await chooseImage(record.attachment, (attachment) => {
      setLocalInvoices((records) => records.map((item) => item.id === record.id
        ? { ...item, attachment, attachmentStatus: 'image_selected_locally' }
        : item));
    });
  };

  const removeInvoiceAttachment = (record: InvoiceRecord) => {
    releaseAttachment(record.attachment);
    setLocalInvoices((records) => records.map((item) => item.id === record.id
      ? { ...item, attachment: null, attachmentStatus: 'no_attachment' }
      : item));
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons color={colors.ink} name="arrow-back" size={22} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Your vehicle history</Text>
            <Text maxFontSizeMultiplier={1.7} style={[styles.title, compact && styles.titleCompact]}>Vehicle Reports</Text>
            <Text style={styles.lead}>Your PSI vehicle history, dyno results, invoices and recommended work.</Text>
          </View>
        </View>

        <View accessibilityRole="alert" style={styles.previewNotice}>
          <Text style={styles.previewNoticeTitle}>{accountConnected ? 'Your records' : 'Demo records'}</Text>
          <Text style={styles.previewNoticeCopy}>{accountConnected ? 'PSI records and attachments are private and read-only. Entries you add here are temporary and are not saved to your account.' : 'Example records only. Anything you add clears when the demo closes.'}</Text>
        </View>
        <FormError message={secureAttachmentError} />

        <SectionHeading meta={`${vehicles.length} vehicles`} title="Vehicle selector" />
        <Pressable
          accessibilityHint={vehicles.length > 1 ? 'Opens your saved vehicle list' : 'Shows your selected vehicle'}
          accessibilityLabel={`Selected vehicle, ${vehicleLabel}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: vehicleSelectorOpen }}
          onPress={() => setVehicleSelectorOpen((current) => !current)}
          style={({ pressed }) => [styles.vehicleSelectButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.ink} name="car-sport" size={22} />
          <View style={styles.vehicleChoiceCopy}>
            <Text numberOfLines={1} style={[styles.vehicleChoiceTitle, styles.vehicleChoiceTitleSelected]}>{vehicleLabel}</Text>
            <Text numberOfLines={1} style={[styles.vehicleChoiceMeta, styles.vehicleChoiceMetaSelected]}>Registration · {selectedVehicle.registration}</Text>
          </View>
          <Ionicons color={colors.ink} name={vehicleSelectorOpen ? 'chevron-up' : 'chevron-down'} size={20} />
        </Pressable>
        {vehicleSelectorOpen ? (
          <View accessibilityRole="radiogroup" style={styles.vehicleDropdown}>
            {vehicles.map((vehicle) => {
              const selected = vehicle.id === selectedVehicle.id;
              return (
                <Pressable
                  accessibilityLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}, registration ${vehicle.registration}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={vehicle.id}
                  onPress={() => handleVehicleSelection(vehicle.id)}
                  style={({ pressed }) => [styles.vehicleDropdownChoice, selected && styles.vehicleDropdownChoiceSelected, pressed && styles.pressed]}
                >
                  <Ionicons color={selected ? colors.ink : colors.accent} name="car-sport" size={20} />
                  <View style={styles.vehicleChoiceCopy}>
                    <Text style={[styles.vehicleChoiceTitle, selected && styles.vehicleChoiceTitleSelected]}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
                    <Text style={[styles.vehicleChoiceMeta, selected && styles.vehicleChoiceMetaSelected]}>Registration · {vehicle.registration}</Text>
                  </View>
                  {selected ? <Ionicons color={colors.ink} name="checkmark-circle" size={20} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.selectedVehicleBar}>
          <Text style={styles.selectedVehicleKicker}>Viewing records for</Text>
          <Text style={styles.selectedVehicleName}>{vehicleLabel}</Text>
          <Text style={styles.selectedVehicleRegistration}>{selectedVehicle.registration}</Text>
          <Text style={styles.selectedVehicleMaintenance}>
            Customer odometer · {maintenance.odometerKm == null ? 'Not added' : `${maintenance.odometerKm.toLocaleString('en-AU')} km`} · Personal next check-in · {maintenance.customerNextCheckInDate ? formatDate(maintenance.customerNextCheckInDate) : 'Not scheduled'}
          </Text>
          {accountConnected ? <Text style={styles.selectedVehicleMaintenance}>Last PSI service · {selectedVehicle.lastVisit ? formatDate(selectedVehicle.lastVisit) : 'Not recorded'} · Next PSI check-in · {selectedVehicle.nextDue ? formatDate(selectedVehicle.nextDue) : 'Not scheduled'}</Text> : null}
          {maintenance.updatedLocally ? <Text style={styles.selectedVehicleLocal}>Personal reminder · not a PSI record</Text> : null}
        </View>

        <ReportSection
          actionLabel={openForm === 'dyno' ? 'Close Dyno Form' : 'Add Dyno Record'}
          meta={`${dynoRecords.length} shown`}
          onAction={() => startForm('dyno')}
          title="Dyno History"
        >
          {openForm === 'dyno' ? (
            <View style={styles.formCard}>
              <FormHeading title="Add dyno result" />
              <Text style={styles.formNotice}>Temporary entry · not saved to your account.</Text>
              <View style={[styles.fieldGrid, (tablet && !largeText) && styles.fieldGridWide]}>
                <View style={styles.fieldCell}><Field label="Power · HP at hubs"><FormInput keyboardType="decimal-pad" maxLength={7} onChangeText={(power) => setDynoDraft((draft) => ({ ...draft, power }))} placeholder="426" value={dynoDraft.power} /></Field></View>
                <View style={styles.fieldCell}><Field label="Torque · Nm at hubs"><FormInput keyboardType="decimal-pad" maxLength={7} onChangeText={(torque) => setDynoDraft((draft) => ({ ...draft, torque }))} placeholder="612" value={dynoDraft.torque} /></Field></View>
                <View style={styles.fieldCell}><Field hint="DD/MM/YYYY" label="Date"><FormInput autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(date) => setDynoDraft((draft) => ({ ...draft, date }))} placeholder="23/08/2026" value={dynoDraft.date} /></Field></View>
                <View style={styles.fieldCell}><Field label="Fuel"><FormInput maxLength={40} onChangeText={(fuel) => setDynoDraft((draft) => ({ ...draft, fuel }))} placeholder="98 RON" value={dynoDraft.fuel} /></Field></View>
              </View>
              <Field hint={`${dynoDraft.notes.length}/400`} label="Setup / run notes · optional"><FormInput autoCorrect maxLength={400} multiline onChangeText={(notes) => setDynoDraft((draft) => ({ ...draft, notes }))} placeholder="Notes for this result" style={styles.notesInput} value={dynoDraft.notes} /></Field>
              <AttachmentPicker
                attachment={dynoDraft.graphImage}
                label="Dyno graph image"
                notice="Temporary image · not saved to your account."
                onChoose={() => void chooseImage(dynoDraft.graphImage, (graphImage) => setDynoDraft((draft) => ({ ...draft, graphImage })))}
                onTakePhoto={() => void takeImage(dynoDraft.graphImage, (graphImage) => setDynoDraft((draft) => ({ ...draft, graphImage })))}
                onRemove={() => { releaseAttachment(dynoDraft.graphImage); setDynoDraft((draft) => ({ ...draft, graphImage: null })); }}
                onView={() => dynoDraft.graphImage && setViewingAttachment({ title: 'Dyno graph preview', uri: dynoDraft.graphImage.uri })}
              />
              <FormError message={formError || attachmentError} />
              <View style={styles.formActions}><PrimaryButton label="Add temporary result" onPress={addDynoRecord} /><PrimaryButton label="Cancel" onPress={cancelDyno} variant="outline" /></View>
            </View>
          ) : null}
          {dynoRecords.length ? dynoRecords.map((record) => <DynoCard attachmentLoading={loadingSecureAttachmentId === record.secureAttachment?.id} key={record.id} record={record} onView={() => record.graphImage ? setViewingAttachment({ title: 'Dyno graph preview', uri: record.graphImage.uri }) : record.secureAttachment ? void openSecureAttachment(record.secureAttachment, 'Private dyno graph') : undefined} />) : <EmptyState accountConnected={accountConnected} message="No dyno records for this vehicle yet." />}
        </ReportSection>

        <ReportSection
          actionLabel={openForm === 'repair' ? 'Close Repair Form' : 'Add Previous Repair'}
          meta={`${repairRecords.length} shown`}
          onAction={() => startForm('repair')}
          title="Previous Repairs"
        >
          {openForm === 'repair' ? (
            <View style={styles.formCard}>
              <FormHeading title="Add previous repair" />
              <Field label="Repair title"><FormInput autoCorrect maxLength={80} onChangeText={(title) => setRepairDraft((draft) => ({ ...draft, title }))} placeholder="Service & inspection" value={repairDraft.title} /></Field>
              <View style={[styles.fieldGrid, (tablet && !largeText) && styles.fieldGridWide]}>
                <View style={styles.fieldCell}><Field hint="DD/MM/YYYY" label="Date"><FormInput autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(date) => setRepairDraft((draft) => ({ ...draft, date }))} placeholder="23/08/2026" value={repairDraft.date} /></Field></View>
                <View style={styles.fieldCell}><Field hint="Optional" label="Odometer · km"><FormInput keyboardType="number-pad" maxLength={8} onChangeText={(odometer) => setRepairDraft((draft) => ({ ...draft, odometer: odometer.replace(/\D/g, '') }))} placeholder="84210" value={repairDraft.odometer} /></Field></View>
              </View>
              <Field hint={`${repairDraft.description.length}/400`} label="Description / notes"><FormInput autoCorrect maxLength={400} multiline onChangeText={(description) => setRepairDraft((draft) => ({ ...draft, description }))} placeholder="Work completed or inspected" style={styles.notesInput} value={repairDraft.description} /></Field>
              <Text style={styles.formNotice}>Temporary entry · not saved to your account.</Text>
              <FormError message={formError} />
              <View style={styles.formActions}><PrimaryButton label="Add temporary repair" onPress={addRepairRecord} /><PrimaryButton label="Cancel" onPress={() => { setRepairDraft(EMPTY_REPAIR_DRAFT); setOpenForm(null); setFormError(''); }} variant="outline" /></View>
            </View>
          ) : null}
          {repairRecords.length ? repairRecords.map((record) => <RepairCard key={record.id} record={record} />) : <EmptyState accountConnected={accountConnected} message="No previous repairs recorded." />}
        </ReportSection>

        <ReportSection
          actionLabel={openForm === 'future' ? 'Close Recommendation Form' : 'Add Recommended Repair'}
          meta={`${futureRepairs.length} shown`}
          onAction={() => startForm('future')}
          title="Future Repairs / Recommended Work"
        >
          {openForm === 'future' ? (
            <View style={styles.formCard}>
              <FormHeading title="Add recommended work" />
              <Field label="Repair / recommendation title"><FormInput autoCorrect maxLength={90} onChangeText={(title) => setFutureDraft((draft) => ({ ...draft, title }))} placeholder="Cooling system inspection" value={futureDraft.title} /></Field>
              <Field label="Timing"><FormInput autoCorrect maxLength={80} onChangeText={(timing) => setFutureDraft((draft) => ({ ...draft, timing }))} placeholder="At next service" value={futureDraft.timing} /></Field>
              <View style={styles.statusPicker} accessibilityRole="radiogroup">
                <Text style={styles.statusPickerLabel}>Status</Text>
                <View style={styles.statusOptions}>{(Object.keys(FUTURE_REPAIR_STATUS_LABELS) as FutureRepairStatus[]).map((status) => {
                  const selected = futureDraft.status === status;
                  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={status} onPress={() => setFutureDraft((draft) => ({ ...draft, status }))} style={({ pressed }) => [styles.statusOption, selected && styles.statusOptionSelected, pressed && styles.pressed]}><Text style={[styles.statusOptionText, selected && styles.statusOptionTextSelected]}>{FUTURE_REPAIR_STATUS_LABELS[status]}</Text></Pressable>;
                })}</View>
              </View>
              <Field hint={`${futureDraft.notes.length}/400`} label="Notes"><FormInput autoCorrect maxLength={400} multiline onChangeText={(notes) => setFutureDraft((draft) => ({ ...draft, notes }))} placeholder="What should be checked or discussed" style={styles.notesInput} value={futureDraft.notes} /></Field>
              <Text style={styles.formNotice}>Temporary entry · not saved to your account.</Text>
              <FormError message={formError} />
              <View style={styles.formActions}><PrimaryButton label="Add temporary note" onPress={addFutureRepair} /><PrimaryButton label="Cancel" onPress={() => { setFutureDraft(EMPTY_FUTURE_DRAFT); setOpenForm(null); setFormError(''); }} variant="outline" /></View>
            </View>
          ) : null}
          {futureRepairs.length ? futureRepairs.map((record) => <FutureRepairCard key={record.id} record={record} />) : <EmptyState accountConnected={accountConnected} message="No recommended work currently shown." />}
        </ReportSection>

        <ReportSection
          actionLabel={openForm === 'invoice' ? 'Close Invoice Form' : 'Add Invoice'}
          meta={`${invoices.length} shown`}
          onAction={() => startForm('invoice')}
          title="Invoice Vault"
        >
          <Text style={styles.sectionNotice}>{accountConnected ? 'PSI invoices and attachments are read-only. Temporary entries are not added to your account.' : 'Example invoices only. Temporary images are not uploaded.'}</Text>
          {openForm === 'invoice' ? (
            <View style={styles.formCard}>
              <FormHeading title="Add invoice" />
              <View style={[styles.fieldGrid, (tablet && !largeText) && styles.fieldGridWide]}>
                <View style={styles.fieldCell}><Field label="Invoice number"><FormInput autoCapitalize="characters" maxLength={40} onChangeText={(invoiceNumber) => setInvoiceDraft((draft) => ({ ...draft, invoiceNumber }))} placeholder="PSI-INV-2026-0000" value={invoiceDraft.invoiceNumber} /></Field></View>
                <View style={styles.fieldCell}><Field hint="DD/MM/YYYY" label="Invoice date"><FormInput autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(date) => setInvoiceDraft((draft) => ({ ...draft, date }))} placeholder="23/08/2026" value={invoiceDraft.date} /></Field></View>
              </View>
              <Field hint="Optional · AUD" label="Amount"><FormInput keyboardType="decimal-pad" maxLength={10} onChangeText={(amount) => setInvoiceDraft((draft) => ({ ...draft, amount }))} placeholder="423.50" value={invoiceDraft.amount} /></Field>
              <Field hint={`${invoiceDraft.summary.length}/300`} label="Completed work summary"><FormInput autoCorrect maxLength={300} multiline onChangeText={(summary) => setInvoiceDraft((draft) => ({ ...draft, summary }))} placeholder="Service & workshop inspection" style={styles.notesInput} value={invoiceDraft.summary} /></Field>
              <AttachmentPicker
                attachment={invoiceDraft.attachment}
                label="Invoice image"
                notice="Temporary image · not saved to your account."
                onChoose={() => void chooseImage(invoiceDraft.attachment, (attachment) => setInvoiceDraft((draft) => ({ ...draft, attachment })))}
                onTakePhoto={() => void takeImage(invoiceDraft.attachment, (attachment) => setInvoiceDraft((draft) => ({ ...draft, attachment })))}
                onRemove={() => { releaseAttachment(invoiceDraft.attachment); setInvoiceDraft((draft) => ({ ...draft, attachment: null })); }}
                onView={() => invoiceDraft.attachment && setViewingAttachment({ title: 'Invoice image preview', uri: invoiceDraft.attachment.uri })}
              />
              <FormError message={formError || attachmentError} />
              <View style={styles.formActions}><PrimaryButton label="Add temporary invoice" onPress={addInvoice} /><PrimaryButton label="Cancel" onPress={cancelInvoice} variant="outline" /></View>
            </View>
          ) : null}
          {invoices.length ? invoices.map((record) => (
            <InvoiceCard
              key={record.id}
              attachmentLoading={loadingSecureAttachmentId === record.secureAttachment?.id}
              onRemove={() => removeInvoiceAttachment(record)}
              onReplace={() => void replaceInvoiceAttachment(record)}
              onView={() => record.attachment ? setViewingAttachment({ title: `${record.invoiceNumber} attachment`, uri: record.attachment.uri }) : record.secureAttachment ? void openSecureAttachment(record.secureAttachment, `${record.invoiceNumber} attachment`) : undefined}
              record={record}
              vehicleLabel={vehicleLabel}
            />
          )) : <EmptyState accountConnected={accountConnected} message="No invoices available for this vehicle." />}
        </ReportSection>

      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setViewingAttachment(null)} presentationStyle="overFullScreen" transparent visible={Boolean(viewingAttachment)}>
        <SafeAreaView accessibilityViewIsModal edges={['top', 'right', 'bottom', 'left']} style={styles.attachmentModal}>
          <View style={styles.attachmentModalHeader}>
            <Text style={styles.attachmentModalTitle}>{viewingAttachment?.title}</Text>
            <Pressable accessibilityLabel="Close attachment preview" accessibilityRole="button" onPress={() => setViewingAttachment(null)} style={({ pressed }) => [styles.modalClose, pressed && styles.pressed]}><Ionicons color={colors.ink} name="close" size={22} /></Pressable>
          </View>
          {viewingAttachment ? <Image accessibilityLabel={viewingAttachment.title} resizeMode="contain" source={{ uri: viewingAttachment.uri }} style={styles.attachmentModalImage} /> : null}
          <Text style={styles.attachmentModalNotice}>{viewingAttachment?.notice ?? 'Temporary image · not saved'}</Text>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function SectionHeading({ meta, title }: { meta: string; title: string }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionMeta}>{meta}</Text></View>;
}

function ReportSection({ actionLabel, children, meta, onAction, title }: { actionLabel: string; children: React.ReactNode; meta: string; onAction: () => void; title: string }) {
  return <View style={styles.reportSection}><SectionHeading meta={meta} title={title} /><Pressable accessibilityLabel={actionLabel} accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.addAction, pressed && styles.pressed]}><Ionicons color={colors.ink} name="add" size={18} /><Text style={styles.addActionText}>{actionLabel}</Text></Pressable>{children}</View>;
}

function FormHeading({ title }: { title: string }) {
  return <View style={styles.formHeading}><Text style={styles.formKicker}>Temporary · not saved</Text><Text style={styles.formTitle}>{title}</Text></View>;
}

function FormError({ message }: { message: string }) {
  return message ? <Text accessibilityRole="alert" style={styles.formError}>{message}</Text> : null;
}

function EmptyState({ accountConnected, message }: { accountConnected: boolean; message: string }) {
  return <View style={styles.emptyState}><Ionicons color={colors.accent} name="document-text-outline" size={24} /><Text style={styles.emptyStateTitle}>{message}</Text><Text style={styles.emptyStateCopy}>{accountConnected ? 'Only this vehicle’s records appear here.' : 'Example records appear for this vehicle.'}</Text></View>;
}

function RecordLabel({ label, local }: { label: string; local: boolean }) {
  return <View style={[styles.recordLabel, local ? styles.recordLabelLocal : styles.recordLabelPsi]}><Text style={[styles.recordLabelText, local && styles.recordLabelTextLocal]}>{label}</Text></View>;
}

function DynoCard({ attachmentLoading, onView, record }: { attachmentLoading: boolean; onView: () => void; record: DynoRecord }) {
  const customerEntry = record.verification !== 'psi_verified';
  const localPreview = record.createdBy === 'customer_preview';
  const label = localPreview
    ? 'TEMPORARY CUSTOMER ENTRY'
    : record.createdBy === 'customer_account'
      ? 'CUSTOMER ENTRY'
      : record.createdBy === 'psi'
        ? 'PSI VERIFIED'
        : 'PSI EXAMPLE';
  const footer = localPreview
    ? 'Temporary · clears when the app closes · not PSI verified.'
    : record.createdBy === 'customer_account'
      ? 'Customer entry · not PSI verified.'
      : record.createdBy === 'psi'
        ? 'PSI result · read-only.'
        : 'Example result only.';
  return <View style={styles.recordCard}><View style={styles.recordHeader}><View style={styles.recordHeaderCopy}><RecordLabel label={label} local={customerEntry} /><Text style={styles.recordTitle}>Hub Dyno · {formatDate(record.recordedAt)}</Text></View>{!customerEntry ? <Ionicons color={colors.accent} name="shield-checkmark" size={24} /> : null}</View><View style={styles.resultGrid}><ResultValue label="Peak Power" unit="HP at hubs" value={record.peakPowerHpAtHubs} /><ResultValue label="Peak Torque" unit="Nm at hubs" value={record.peakTorqueNmAtHubs} /></View><View style={styles.recordMetaRow}><RecordMeta label="Fuel" value={record.fuel} /><RecordMeta label="Record control" value={customerEntry ? 'Customer entry · not PSI verified' : 'PSI-controlled · read-only'} /></View>{record.notes ? <Text style={styles.recordDescription}>{record.notes}</Text> : null}{record.graphImage || record.secureAttachment ? <Pressable accessibilityLabel="View dyno graph image" accessibilityRole="button" disabled={attachmentLoading} onPress={onView} style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}><Ionicons color={colors.accent} name={attachmentLoading ? "hourglass-outline" : "image-outline"} size={18} /><Text style={styles.inlineActionText}>{attachmentLoading ? 'Opening private graph…' : record.secureAttachment ? 'Open private dyno graph' : 'View dyno graph'}</Text></Pressable> : <Text style={styles.noAttachment}>{record.createdBy === 'psi' || record.createdBy === 'customer_account' ? 'No private graph attached' : 'No preview graph attached'}</Text>}<Text style={styles.localExpiry}>{footer}</Text></View>;
}

function ResultValue({ label, unit, value }: { label: string; unit: string; value: number | null }) {
  return <View style={styles.resultValue}><Text style={styles.resultLabel}>{label}</Text><Text adjustsFontSizeToFit maxFontSizeMultiplier={1.5} numberOfLines={1} style={styles.resultNumber}>{value ?? '—'}</Text><Text style={styles.resultUnit}>{unit}</Text></View>;
}

function RepairCard({ record }: { record: RepairRecord }) {
  const local = record.createdBy === 'customer_preview' || record.createdBy === 'customer_account';
  const label = record.createdBy === 'customer_preview' ? 'TEMPORARY ENTRY' : record.createdBy === 'customer_account' ? 'CUSTOMER ENTRY' : record.createdBy === 'psi' ? 'PSI RECORD' : 'PSI EXAMPLE';
  const footer = record.createdBy === 'customer_preview' ? 'Clears when the app closes.' : record.createdBy === 'customer_account' ? 'Customer-provided · not PSI verified.' : record.createdBy === 'psi' ? 'PSI record · read-only.' : '';
  return <View style={styles.recordCard}><View style={styles.recordHeader}><View style={styles.recordHeaderCopy}><RecordLabel label={label} local={local} /><Text style={styles.recordTitle}>{record.title}</Text></View><Ionicons color={colors.accent} name="construct-outline" size={23} /></View><View style={styles.recordMetaRow}><RecordMeta label="Date" value={formatDate(record.repairedAt)} /><RecordMeta label="Odometer" value={record.odometerKm == null ? 'Not recorded' : `${record.odometerKm.toLocaleString('en-AU')} km`} /></View><Text style={styles.recordDescription}>{record.description}</Text>{footer ? <Text style={styles.localExpiry}>{footer}</Text> : null}</View>;
}

function FutureRepairCard({ record }: { record: FutureRepair }) {
  const local = record.createdBy === 'customer_preview' || record.createdBy === 'customer_account';
  const label = record.createdBy === 'customer_preview' ? 'TEMPORARY NOTE' : record.createdBy === 'customer_account' ? 'CUSTOMER NOTE' : record.createdBy === 'psi' ? 'PSI RECOMMENDATION' : 'PSI EXAMPLE';
  const footer = record.createdBy === 'customer_preview' ? 'Temporary · not PSI advice.' : record.createdBy === 'customer_account' ? 'Customer note · not a PSI recommendation.' : record.createdBy === 'psi' ? 'PSI recommendation · read-only.' : 'Example only.';
  return <View style={styles.recordCard}><View style={styles.recordHeader}><View style={styles.recordHeaderCopy}><RecordLabel label={label} local={local} /><Text style={styles.recordTitle}>{record.title}</Text></View><StatusBadge status={record.status} /></View><RecordMeta label="Timing" value={record.timing} /><Text style={styles.recordDescription}>{record.notes}</Text><Text style={styles.localExpiry}>{footer}</Text></View>;
}

function StatusBadge({ status }: { status: FutureRepairStatus }) {
  return <View style={[styles.statusBadge, styles[`status_${status}`]]}><Text style={styles.statusBadgeText}>{FUTURE_REPAIR_STATUS_LABELS[status]}</Text></View>;
}

function InvoiceCard({ attachmentLoading, onRemove, onReplace, onView, record, vehicleLabel }: { attachmentLoading: boolean; onRemove: () => void; onReplace: () => void; onView: () => void; record: InvoiceRecord; vehicleLabel: string }) {
  const local = record.createdBy === 'customer_preview';
  const label = local ? 'TEMPORARY INVOICE' : record.createdBy === 'psi' ? 'PSI INVOICE' : 'PSI EXAMPLE';
  const attachmentStatus = record.attachment ? 'TEMPORARY IMAGE · NOT UPLOADED' : record.attachmentStatus === 'preview_reference_only' ? 'EXAMPLE · NO FILE ATTACHED' : record.attachmentStatus === 'secure_attachment_available' ? 'PRIVATE PSI ATTACHMENT · READ ONLY' : record.attachmentStatus === 'secure_file_unavailable' ? 'NO ATTACHMENT AVAILABLE' : 'NO ATTACHMENT';
  const footer = local ? 'Clears when the app closes.' : record.createdBy === 'psi' ? record.secureAttachment ? 'PSI invoice and attachment · read-only.' : 'PSI invoice · read-only.' : 'Example invoice only.';
  return <View style={styles.recordCard}><View style={styles.recordHeader}><View style={styles.recordHeaderCopy}><RecordLabel label={label} local={local} /><Text style={styles.recordTitle}>{record.invoiceNumber}</Text><Text style={styles.invoiceDate}>{formatDate(record.invoiceDate)}</Text></View><Text adjustsFontSizeToFit numberOfLines={1} style={styles.invoiceAmount}>{record.amountAud == null ? '—' : formatCurrency(record.amountAud)}</Text></View><RecordMeta label="Vehicle" value={vehicleLabel} /><Text style={styles.recordDescription}>{record.summary}</Text><Text style={styles.attachmentStatus}>{attachmentStatus}</Text>{record.attachment ? <View style={styles.attachmentActions}><SmallAction icon="eye-outline" label="View attachment" onPress={onView} /><SmallAction icon="refresh-outline" label="Replace" onPress={onReplace} /><SmallAction icon="trash-outline" label="Remove" onPress={onRemove} /></View> : record.secureAttachment ? <SmallAction icon={attachmentLoading ? "hourglass-outline" : record.secureAttachment.mimeType === 'application/pdf' ? "document-text-outline" : "eye-outline"} label={attachmentLoading ? 'Opening private attachment…' : record.secureAttachment.mimeType === 'application/pdf' ? 'Open private PDF' : 'View private attachment'} onPress={onView} /> : local ? <SmallAction icon="image-outline" label="Choose image" onPress={onReplace} /> : null}<Text style={styles.localExpiry}>{footer}</Text></View>;
}

function RecordMeta({ label, value }: { label: string; value: string }) {
  return <View style={styles.recordMeta}><Text style={styles.recordMetaLabel}>{label}</Text><Text style={styles.recordMetaValue}>{value}</Text></View>;
}

function SmallAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}><Ionicons color={colors.accent} name={icon} size={17} /><Text style={styles.smallActionText}>{label}</Text></Pressable>;
}

function AttachmentPicker({
  attachment,
  label,
  notice,
  onChoose,
  onTakePhoto,
  onRemove,
  onView,
}: {
  attachment: PreviewAttachment | null;
  label: string;
  notice: string;
  onChoose: () => void;
  onTakePhoto: () => void;
  onRemove: () => void;
  onView: () => void;
}) {
  return (
    <View style={styles.attachmentPicker}>
      <Text style={styles.attachmentLabel}>{label}</Text>
      {attachment
        ? <Image accessibilityLabel={`Selected ${label}`} resizeMode="contain" source={{ uri: attachment.uri }} style={styles.attachmentPreview} />
        : (
          <View style={styles.attachmentEmpty}>
            <Ionicons color={colors.accent} name="image-outline" size={28} />
            <Text style={styles.attachmentEmptyText}>No image selected</Text>
          </View>
        )}
      <View style={styles.attachmentActions}>
        <SmallAction icon="camera-outline" label={attachment ? 'Retake photo' : 'Take photo'} onPress={onTakePhoto} />
        <SmallAction icon="image-outline" label={attachment ? 'Replace' : 'Choose image'} onPress={onChoose} />
        {attachment ? (
          <>
            <SmallAction icon="eye-outline" label="View attachment" onPress={onView} />
            <SmallAction icon="trash-outline" label="Remove" onPress={onRemove} />
          </>
        ) : null}
      </View>
      <Text style={styles.attachmentNotice}>{notice}</Text>
    </View>
  );
}

function formatDate(value: string) {
  return formatAustralianDate(value, value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AU', { currency: 'AUD', style: 'currency' }).format(value);
}

function makeLocalId(prefix: string) {
  return `${prefix}-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  accountState: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  accountStateTitle: { color: colors.white, fontSize: 24, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  accountStateCopy: { maxWidth: 420, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  scroll: { width: '100%', maxWidth: 980, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  backButton: { ...mobileFrame, width: 46, height: 46, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.white },
  headerCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.4, lineHeight: 41, textTransform: 'uppercase' },
  titleCompact: { fontSize: 30, lineHeight: 33 },
  lead: { maxWidth: 620, color: colors.muted, fontSize: 13, lineHeight: 20 },
  previewNotice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.silver, padding: spacing.md },
  previewNoticeTitle: { color: colors.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  previewNoticeCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { flexShrink: 1, color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  sectionMeta: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: .5, textTransform: 'uppercase' },
  vehicleSelectButton: { ...mobileFrame, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.silver, padding: spacing.md },
  vehicleDropdown: { ...mobileFrame, overflow: 'hidden', backgroundColor: colors.panel },
  vehicleDropdownChoice: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, padding: spacing.md },
  vehicleDropdownChoiceSelected: { backgroundColor: colors.silver },
  vehicleChoiceCopy: { flex: 1, minWidth: 0, gap: 3 },
  vehicleChoiceTitle: { color: colors.white, fontSize: 12, fontWeight: '900' },
  vehicleChoiceTitleSelected: { color: colors.ink },
  vehicleChoiceMeta: { color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  vehicleChoiceMetaSelected: { color: '#555D61' },
  selectedVehicleBar: { ...mobileFrame, gap: 3, backgroundColor: colors.panel, padding: spacing.md },
  selectedVehicleKicker: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  selectedVehicleName: { color: colors.white, fontSize: 18, fontWeight: '900', lineHeight: 23, textTransform: 'uppercase' },
  selectedVehicleRegistration: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  selectedVehicleMaintenance: { color: colors.silver, fontSize: 10, fontWeight: '800', lineHeight: 16, marginTop: spacing.xs },
  selectedVehicleLocal: { color: colors.accent, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  reportSection: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.lg },
  addAction: { ...mobileFrame, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.white, paddingHorizontal: spacing.md },
  addActionText: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: .6, textAlign: 'center', textTransform: 'uppercase' },
  formCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  formHeading: { gap: 3 },
  formKicker: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  formTitle: { color: colors.white, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  formNotice: { borderLeftWidth: 3, borderLeftColor: colors.accent, color: colors.muted, fontSize: 10, lineHeight: 16, paddingLeft: spacing.sm },
  fieldGrid: { gap: spacing.md },
  fieldGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  fieldCell: { minWidth: 240, flex: 1 },
  notesInput: { minHeight: 104, textAlignVertical: 'top' },
  formError: { color: colors.danger, fontSize: 11, lineHeight: 17 },
  formActions: { gap: spacing.sm },
  statusPicker: { gap: spacing.xs },
  statusPickerLabel: { color: colors.silver, fontSize: 10, fontWeight: '900', letterSpacing: .7, textTransform: 'uppercase' },
  statusOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statusOption: { minHeight: 44, minWidth: 112, flexGrow: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, paddingHorizontal: spacing.sm },
  statusOptionSelected: { borderColor: colors.white, backgroundColor: colors.silver },
  statusOptionText: { color: colors.white, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusOptionTextSelected: { color: colors.ink },
  sectionNotice: { color: colors.silver, fontSize: 11, fontWeight: '800', lineHeight: 17 },
  pdfNotice: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  recordCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.lg },
  recordHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  recordHeaderCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  recordLabel: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 14, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  recordLabelPsi: { borderColor: 'rgba(101,207,248,.58)', backgroundColor: 'rgba(101,207,248,.12)' },
  recordLabelLocal: { borderColor: 'rgba(255,255,255,.42)', backgroundColor: 'rgba(255,255,255,.08)' },
  recordLabelText: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: .6, textTransform: 'uppercase' },
  recordLabelTextLocal: { color: colors.silver },
  recordTitle: { color: colors.white, fontSize: 17, fontWeight: '900', lineHeight: 22, textTransform: 'uppercase' },
  recordDescription: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  recordMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recordMeta: { minWidth: 140, flex: 1, gap: 3, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  recordMetaLabel: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: .7, textTransform: 'uppercase' },
  recordMetaValue: { color: colors.silver, fontSize: 11, fontWeight: '800', lineHeight: 17 },
  localExpiry: { color: colors.mutedDark, fontSize: 9, lineHeight: 15 },
  resultGrid: { flexDirection: 'row', gap: spacing.sm },
  resultValue: { ...mobileFrame, flex: 1, minWidth: 0, gap: 2, backgroundColor: colors.ink, padding: spacing.md },
  resultLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  resultNumber: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.5, lineHeight: 42 },
  resultUnit: { color: colors.accent, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  noAttachment: { color: colors.mutedDark, fontSize: 10, fontStyle: 'italic' },
  inlineAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md },
  inlineActionText: { color: colors.white, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusBadge: { flexShrink: 0, borderWidth: 1, borderRadius: 14, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  status_monitor: { borderColor: 'rgba(255,255,255,.32)', backgroundColor: 'rgba(255,255,255,.07)' },
  status_recommended: { borderColor: 'rgba(101,207,248,.54)', backgroundColor: 'rgba(101,207,248,.12)' },
  status_due_soon: { borderColor: 'rgba(46,125,155,.65)', backgroundColor: 'rgba(46,125,155,.16)' },
  status_priority: { borderColor: 'rgba(255,159,145,.65)', backgroundColor: 'rgba(180,35,24,.18)' },
  statusBadgeText: { color: colors.silver, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  invoiceDate: { color: colors.muted, fontSize: 10 },
  invoiceAmount: { maxWidth: 126, flexShrink: 1, color: colors.accent, fontSize: 23, fontWeight: '900' },
  attachmentStatus: { color: colors.silver, fontSize: 9, fontWeight: '900', letterSpacing: .5, textTransform: 'uppercase' },
  attachmentPicker: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
  attachmentLabel: { color: colors.silver, fontSize: 10, fontWeight: '900', letterSpacing: .7, textTransform: 'uppercase' },
  attachmentPreview: { ...mobileFrame, width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.ink },
  attachmentEmpty: { ...mobileFrame, minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.ink },
  attachmentEmptyText: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  attachmentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  smallAction: { minHeight: 44, minWidth: 116, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, paddingHorizontal: spacing.sm },
  smallActionText: { color: colors.white, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  attachmentNotice: { color: colors.muted, fontSize: 9, lineHeight: 15 },
  emptyState: { ...mobileFrame, width: '100%', alignSelf: 'stretch', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.inkSoft, padding: spacing.lg },
  emptyStateTitle: { width: '100%', flexShrink: 1, color: colors.white, fontSize: 13, fontWeight: '900', lineHeight: 18, paddingHorizontal: spacing.xs, textAlign: 'center', textTransform: 'uppercase' },
  emptyStateCopy: { width: '100%', flexShrink: 1, color: colors.muted, fontSize: 10, lineHeight: 16, paddingHorizontal: spacing.xs, textAlign: 'center' },
  footerNotice: { gap: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.accent, backgroundColor: colors.panel, padding: spacing.md },
  footerNoticeTitle: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  footerNoticeCopy: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  attachmentModal: { flex: 1, gap: spacing.md, backgroundColor: colors.ink, padding: spacing.md },
  attachmentModalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  attachmentModalTitle: { flex: 1, color: colors.white, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  modalClose: { ...mobileFrame, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.white },
  attachmentModalImage: { ...mobileFrame, flex: 1, width: '100%', backgroundColor: colors.inkSoft },
  attachmentModalNotice: { color: colors.muted, fontSize: 10, lineHeight: 16, textAlign: 'center' },
  pressed: { opacity: .72 },
});
