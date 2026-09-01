import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { VehiclePhotoPicker } from '@/components/vehicle-photo-picker';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { australianDateToIso, formatAustralianDate, isoDateToAustralian } from '@/lib/australian-date';
import { saveCustomerOdometer } from '@/lib/customer-account';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import {
  createCustomerVehiclePhotoSignedUrl,
  newestCustomerVehiclePhoto,
  removeCustomerVehiclePhoto,
  uploadCustomerVehiclePhoto,
} from '@/lib/customer-private-files';
import {
  CUSTOMER_PREVIEW,
  getLatestVerifiedDynoResult,
  type PreviewVehicle,
} from '@/lib/customer-preview';
import { useCustomerPreview } from '@/lib/customer-preview-context';
import type { VehicleFileRow } from '@/lib/database.types';
import { releaseLocalVehiclePhoto } from '@/lib/local-vehicle-photo';

const GARAGE_IMAGE = require('../../../assets/images/dashboard/tile-my-garage-blue-silver.jpg');
const REPORT_IMAGE = require('../../../assets/images/dashboard/tile-vehicle-reports-blue-silver.jpg');

type MaintenanceDraft = {
  customerLastServiceDate: string;
  customerNextCheckInDate: string;
  odometerKm: string;
};

export default function GarageScreen() {
  const auth = useCustomerAuth();
  const { account, error, status } = useCustomerAccount();
  const secureAccountActive = CUSTOMER_AUTH.enabled && auth.status === 'signed_in';

  if (CUSTOMER_AUTH.enabled && auth.status === 'loading') {
    return <GarageAccountState copy="Restoring your account…" loading title="Opening My Garage" />;
  }

  if (secureAccountActive && status === 'loading') {
    return <GarageAccountState copy="Loading your vehicles…" loading title="Opening My Garage" />;
  }

  if (secureAccountActive && (status === 'error' || !account)) {
    return <GarageAccountState copy={error || 'Your private vehicle records could not be loaded.'} title="Garage unavailable" />;
  }

  const secureVehicles = secureAccountActive
    ? (account?.vehicles ?? []).map((vehicle): PreviewVehicle => {
      const summary = account?.serviceSummaries.find((candidate) => candidate.vehicle_id === vehicle.id);
      return {
        id: vehicle.id,
        isPrimary: vehicle.is_primary,
        lastVisit: summary?.latest_psi_service_at ?? null,
        latestPsiOdometerKm: summary?.latest_psi_odometer_km ?? null,
        make: vehicle.make,
        model: vehicle.model,
        nextDue: summary?.next_psi_check_in_date ?? null,
        nextPsiCheckInOdometerKm: summary?.next_psi_check_in_odometer_km ?? null,
        odometerKm: summary?.latest_customer_odometer_km ?? vehicle.odometer_km,
        registration: vehicle.registration,
        vinLastFour: vehicle.vin_last_four,
        year: vehicle.year,
      };
    })
    : null;

  if (secureVehicles && secureVehicles.length === 0) {
    return <GarageAccountState actionLabel="Add your first vehicle" copy="Your account is ready. Add a vehicle to begin." title="Your garage is ready" />;
  }

  return <GarageContent secureVehicleFiles={secureAccountActive ? account?.vehicleFiles ?? [] : null} secureVehicles={secureVehicles} />;
}

function GarageAccountState({
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
        {loading ? <ActivityIndicator color={colors.accent} size="large" /> : <Ionicons color={colors.accent} name="car-sport" size={38} />}
        <Text style={styles.accountStateTitle}>{title}</Text>
        <Text style={styles.accountStateCopy}>{copy}</Text>
        {actionLabel ? <PrimaryButton label={actionLabel} onPress={() => router.push('/account/sign-up')} /> : null}
        {!loading ? <PrimaryButton label="Open account" onPress={() => router.push('/account')} variant="outline" /> : null}
      </View>
    </SafeAreaView>
  );
}

function GarageContent({
  secureVehicleFiles,
  secureVehicles,
}: {
  secureVehicleFiles: readonly VehicleFileRow[] | null;
  secureVehicles: readonly PreviewVehicle[] | null;
}) {
  const router = useRouter();
  const { refreshAccount } = useCustomerAccount();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { compact, horizontalPadding, largeText, tablet } = useResponsiveLayout();
  const {
    prepareBookingVehicle,
    prepareBookingVehicleRecord,
    selectedVehicleId: previewSelectedVehicleId,
    selectVehicle: selectPreviewVehicle,
    setVehiclePhoto,
    updateVehicleMaintenancePreview,
    vehicleMaintenance,
    vehiclePhotos,
    vehicles: previewVehicles,
  } = useCustomerPreview();

  const vehicles = secureVehicles ?? previewVehicles;
  const [secureSelectedVehicleId, setSecureSelectedVehicleId] = useState(() => secureVehicles?.find((vehicle) => vehicle.isPrimary)?.id ?? secureVehicles?.[0]?.id ?? '');
  const [securePhotoFiles, setSecurePhotoFiles] = useState<Record<string, VehicleFileRow | null>>({});
  const [securePhotoUris, setSecurePhotoUris] = useState<Record<string, string | null>>({});
  const [vehicleSelectorOpen, setVehicleSelectorOpen] = useState(false);
  const [photoNotice, setPhotoNotice] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);
  const selectedVehicleId = secureVehicles ? secureSelectedVehicleId : previewSelectedVehicleId;

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];
  const hasPhotoOverride = Object.prototype.hasOwnProperty.call(securePhotoFiles, selectedVehicle.id);
  const selectedSecurePhotoFile = hasPhotoOverride
    ? securePhotoFiles[selectedVehicle.id]
    : newestCustomerVehiclePhoto(secureVehicleFiles ?? [], selectedVehicle.id);
  const securePhotoUri = securePhotoUris[selectedVehicle.id] ?? null;
  const selectedPhoto = secureVehicles
    ? securePhotoUri ? {
      fileSize: selectedSecurePhotoFile?.file_size_bytes ?? null,
      height: 0,
      mimeType: selectedSecurePhotoFile?.mime_type ?? null,
      uri: securePhotoUri,
      width: 0,
    } : null
    : vehiclePhotos[selectedVehicle.id] ?? null;
  const dynoResult = getLatestVerifiedDynoResult(selectedVehicle.id);
  const buildPlan = CUSTOMER_PREVIEW.buildPlans.find((plan) => plan.vehicleId === selectedVehicle.id);
  const vehicleLabel = `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`;
  const dynoFirst = section === 'dyno';
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
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceDraft, setMaintenanceDraft] = useState<MaintenanceDraft>({
    customerLastServiceDate: isoDateToAustralian(maintenance.customerLastServiceDate),
    customerNextCheckInDate: isoDateToAustralian(maintenance.customerNextCheckInDate),
    odometerKm: maintenance.odometerKm?.toString() ?? '',
  });
  const [maintenanceError, setMaintenanceError] = useState('');
  const [maintenanceNotice, setMaintenanceNotice] = useState('');
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  useEffect(() => {
    if (!secureVehicles || !selectedSecurePhotoFile || securePhotoUris[selectedVehicle.id]) return;
    let active = true;
    createCustomerVehiclePhotoSignedUrl(selectedSecurePhotoFile)
      .then((uri) => {
        if (active) setSecurePhotoUris((current) => ({ ...current, [selectedVehicle.id]: uri }));
      })
      .catch(() => {
        if (active) setPhotoNotice('Your private vehicle photo could not be opened. Refresh the account or try again.');
      });
    return () => { active = false; };
  }, [securePhotoUris, secureVehicles, selectedSecurePhotoFile, selectedVehicle.id]);

  const changeVehiclePhoto = async (photo: Parameters<typeof setVehiclePhoto>[1]) => {
    if (!secureVehicles) {
      setVehiclePhoto(selectedVehicle.id, photo);
      return;
    }

    setPhotoSaving(true);
    setPhotoNotice('');
    const previousUri = securePhotoUris[selectedVehicle.id] ?? null;
    try {
      if (!photo) {
        if (!selectedSecurePhotoFile) return;
        const result = await removeCustomerVehiclePhoto(selectedSecurePhotoFile);
        setSecurePhotoFiles((current) => ({ ...current, [selectedVehicle.id]: null }));
        setSecurePhotoUris((current) => ({ ...current, [selectedVehicle.id]: null }));
        setPhotoNotice(result.storageRemoved
          ? 'Your customer-added vehicle photo was removed from the private account.'
          : 'The photo was removed from your account view. PSI must clean up the remaining private file.');
      } else {
        setSecurePhotoUris((current) => ({ ...current, [selectedVehicle.id]: photo.uri }));
        const result = await uploadCustomerVehiclePhoto(selectedVehicle.id, photo);
        setSecurePhotoFiles((current) => ({ ...current, [selectedVehicle.id]: result.file }));
        setSecurePhotoUris((current) => ({ ...current, [selectedVehicle.id]: result.signedUrl }));
        setPhotoNotice(result.cleanupWarning ?? 'Your vehicle photo was saved privately to this account.');
      }
      refreshAccount();
    } catch {
      setSecurePhotoUris((current) => ({ ...current, [selectedVehicle.id]: previousUri }));
      setPhotoNotice('The private photo was not changed. Choose a JPEG, PNG or WebP image under 8 MB and try again.');
    } finally {
      if (photo) releaseLocalVehiclePhoto(photo);
      setPhotoSaving(false);
    }
  };

  const resetMaintenanceDraft = (vehicle: PreviewVehicle) => {
    const local = vehicleMaintenance[vehicle.id];
    const nextMaintenance = {
      customerLastServiceDate: local?.customerLastServiceDate ?? null,
      customerNextCheckInDate: local?.customerNextCheckInDate ?? null,
      odometerKm: secureVehicles ? vehicle.odometerKm : local?.odometerKm ?? vehicle.odometerKm,
    };
    setMaintenanceDraft({
      customerLastServiceDate: isoDateToAustralian(nextMaintenance.customerLastServiceDate),
      customerNextCheckInDate: isoDateToAustralian(nextMaintenance.customerNextCheckInDate),
      odometerKm: nextMaintenance.odometerKm?.toString() ?? '',
    });
  };

  const selectGarageVehicle = (vehicleId: string) => {
    const vehicle = vehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle) return;
    resetMaintenanceDraft(vehicle);
    setMaintenanceOpen(false);
    setVehicleSelectorOpen(false);
    setMaintenanceError('');
    setMaintenanceNotice('');
    if (secureVehicles) setSecureSelectedVehicleId(vehicleId);
    else selectPreviewVehicle(vehicleId);
  };

  const heroSource = selectedPhoto ? { uri: selectedPhoto.uri } : GARAGE_IMAGE;

  const openBookingForVehicle = (type: 'service' | 'dyno') => {
    if (secureVehicles) prepareBookingVehicleRecord(selectedVehicle);
    else prepareBookingVehicle(selectedVehicle.id);
    router.push({ pathname: '/booking', params: { type } });
  };

  const saveMaintenancePreview = async () => {
    const odometerKm = maintenanceDraft.odometerKm ? Number(maintenanceDraft.odometerKm) : null;
    const customerLastServiceDate = maintenanceDraft.customerLastServiceDate ? australianDateToIso(maintenanceDraft.customerLastServiceDate) : null;
    const customerNextCheckInDate = maintenanceDraft.customerNextCheckInDate ? australianDateToIso(maintenanceDraft.customerNextCheckInDate) : null;
    const datesAreValid = (!maintenanceDraft.customerLastServiceDate || customerLastServiceDate)
      && (!maintenanceDraft.customerNextCheckInDate || customerNextCheckInDate);
    if (
      (odometerKm !== null && (!Number.isInteger(odometerKm) || odometerKm < 0 || odometerKm > 9999999))
      || !datesAreValid
    ) {
      setMaintenanceNotice('');
      setMaintenanceError('Enter a valid odometer and use DD/MM/YYYY for each date, or leave a field blank.');
      return;
    }
    if (secureVehicles && odometerKm !== null && selectedVehicle.odometerKm !== null && odometerKm < selectedVehicle.odometerKm) {
      setMaintenanceNotice('');
      setMaintenanceError(`A new customer reading cannot be lower than the latest saved reading of ${selectedVehicle.odometerKm.toLocaleString('en-AU')} km.`);
      return;
    }

    setMaintenanceSaving(true);
    try {
      if (secureVehicles && odometerKm !== null && odometerKm !== selectedVehicle.odometerKm) {
        await saveCustomerOdometer(selectedVehicle.id, odometerKm);
        refreshAccount();
      }
      updateVehicleMaintenancePreview(selectedVehicle.id, {
        customerLastServiceDate,
        customerNextCheckInDate,
        odometerKm,
      });
      setMaintenanceError('');
      setMaintenanceNotice(secureVehicles
        ? `Odometer ${odometerKm !== null && odometerKm !== selectedVehicle.odometerKm ? 'updated' : 'unchanged'}. Personal reminders remain separate from PSI workshop records.`
        : 'Demo maintenance details updated for this session.');
      setMaintenanceOpen(false);
    } catch {
      setMaintenanceNotice('');
      setMaintenanceError('The odometer could not be saved. Sign in again and try once more.');
    } finally {
      setMaintenanceSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{secureVehicles ? 'Your vehicles' : 'Garage preview'}</Text>
            <Text maxFontSizeMultiplier={1.8} style={[styles.title, compact && styles.titleCompact]}>My Garage</Text>
          </View>
          <Pressable
            accessibilityLabel="Account setup"
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.ink} name="person" size={20} />
          </Pressable>
        </View>

        <View accessibilityRole="alert" style={styles.previewNotice}>
          <Text style={styles.previewNoticeTitle}>{secureVehicles ? 'Your private garage' : 'Demo garage'}</Text>
          <Text style={styles.previewNoticeCopy}>
            {secureVehicles
              ? 'Your vehicles, PSI history and photos are private. Personal reminder dates stay on this device.'
              : 'These example details and photos clear when the demo closes.'}
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your vehicles</Text>
          <Text style={styles.sectionMeta}>{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'}</Text>
        </View>
        <View style={styles.vehicleSelectorRow}>
          <Pressable
            accessibilityHint={vehicles.length > 1 ? 'Opens your saved vehicle list' : 'Shows your selected vehicle'}
            accessibilityLabel={`Selected vehicle, ${vehicleLabel}`}
            accessibilityRole="button"
            accessibilityState={{ expanded: vehicleSelectorOpen }}
            onPress={() => setVehicleSelectorOpen((current) => !current)}
            style={({ pressed }) => [styles.selectedVehicleChoice, pressed && styles.pressed]}
          >
            <Ionicons color={colors.ink} name="car-sport" size={21} />
            <View style={styles.vehicleChoiceCopy}>
              <Text numberOfLines={1} style={[styles.vehicleChoiceTitle, styles.vehicleChoiceTextSelected]}>{selectedVehicle.make} {selectedVehicle.model}</Text>
              <Text numberOfLines={1} style={[styles.vehicleChoiceMeta, styles.vehicleChoiceMetaSelected]}>{selectedVehicle.year} · {selectedVehicle.registration}</Text>
            </View>
            <Ionicons color={colors.ink} name={vehicleSelectorOpen ? 'chevron-up' : 'chevron-down'} size={19} />
          </Pressable>
          <Pressable
            accessibilityLabel="Add vehicle"
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/account/sign-up', params: { mode: 'add' } })}
            style={({ pressed }) => [styles.addVehicle, pressed && styles.pressed]}
          >
            <Ionicons color={colors.accent} name="add" size={20} />
            <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={styles.addVehicleText}>Add Vehicle</Text>
          </Pressable>
        </View>
        {vehicleSelectorOpen ? (
          <View accessibilityRole="radiogroup" style={styles.vehicleDropdown}>
            {vehicles.map((vehicle) => {
              const selected = vehicle.id === selectedVehicle.id;
              return (
                <Pressable
                  accessibilityLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={vehicle.id}
                  onPress={() => selectGarageVehicle(vehicle.id)}
                  style={({ pressed }) => [styles.vehicleDropdownChoice, selected && styles.vehicleDropdownChoiceSelected, pressed && styles.pressed]}
                >
                  <Ionicons color={selected ? colors.ink : colors.accent} name="car-sport" size={20} />
                  <View style={styles.vehicleChoiceCopy}>
                    <Text style={[styles.vehicleChoiceTitle, selected && styles.vehicleChoiceTextSelected]}>{vehicle.make} {vehicle.model}</Text>
                    <Text style={[styles.vehicleChoiceMeta, selected && styles.vehicleChoiceMetaSelected]}>{vehicle.year} · {vehicle.registration}</Text>
                  </View>
                  {selected ? <Ionicons color={colors.ink} name="checkmark-circle" size={20} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={[styles.vehicleCard, tablet && styles.vehicleCardWide]}>
          <View style={[styles.vehicleImageFrame, tablet && styles.vehicleImageFrameWide]}>
            <Image
              accessibilityLabel={selectedPhoto ? `Selected photo of ${vehicleLabel}` : `Generic garage artwork; no photo selected for ${vehicleLabel}`}
              resizeMode={selectedPhoto ? 'contain' : 'cover'}
              source={heroSource}
              style={styles.fillImage}
            />
            {!selectedPhoto ? (
              <View style={styles.exampleImageLabel}>
                <Text style={styles.exampleImageLabelText}>Example image · add your photo</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.vehicleDetails}>
            <Text style={styles.primaryLabel}>{selectedVehicle.isPrimary ? 'Primary vehicle' : 'Garage vehicle'}</Text>
            <Text maxFontSizeMultiplier={1.7} style={styles.vehicleName}>{vehicleLabel}</Text>
            <View style={styles.statGrid}>
              <VehicleStat label="Registration" value={selectedVehicle.registration} />
              <VehicleStat
                label="Customer odometer"
                value={maintenance.odometerKm == null ? 'Not added' : `${maintenance.odometerKm.toLocaleString('en-AU')} km`}
              />
              <VehicleStat label="Last PSI service" value={formatShortDate(selectedVehicle.lastVisit)} />
              <VehicleStat label="Next PSI check-in" value={formatShortDate(selectedVehicle.nextDue)} />
              {secureVehicles ? <VehicleStat label="Latest PSI odometer" value={formatOdometer(selectedVehicle.latestPsiOdometerKm)} /> : null}
              {secureVehicles ? <VehicleStat label="Next PSI odometer" value={formatOdometer(selectedVehicle.nextPsiCheckInOdometerKm)} /> : null}
              <VehicleStat label="Personal last service" value={formatShortDate(maintenance.customerLastServiceDate)} />
              <VehicleStat label="Personal next check-in" value={formatShortDate(maintenance.customerNextCheckInDate)} />
            </View>
            {maintenance.updatedLocally ? <Text style={styles.localMaintenanceLabel}>{secureVehicles ? 'Personal reminder · not a PSI record' : 'Demo details'}</Text> : null}
          </View>
        </View>

        <View style={styles.maintenanceCard}>
          <View style={styles.maintenanceHeading}>
            <View style={styles.maintenanceHeadingCopy}>
              <Text style={styles.primaryLabel}>Vehicle upkeep</Text>
              <Text style={styles.maintenanceTitle}>Maintenance details</Text>
              <Text style={styles.bodyCopy}>Track your odometer and add personal service reminders.</Text>
            </View>
            <Ionicons color={colors.accent} name="create-outline" size={24} />
          </View>
          <Text style={styles.maintenanceBoundary}>Personal entries do not change PSI workshop records.</Text>
          {maintenanceOpen ? (
            <View style={styles.maintenanceForm}>
              <Field hint="Customer reading · kilometres" label="Customer odometer">
                <FormInput
                  keyboardType="number-pad"
                  maxLength={7}
                  onChangeText={(odometerKm) => setMaintenanceDraft((draft) => ({ ...draft, odometerKm: odometerKm.replace(/\D/g, '') }))}
                  placeholder="84210"
                  value={maintenanceDraft.odometerKm}
                />
              </Field>
              <View style={styles.maintenanceDateGrid}>
                <View style={styles.maintenanceDateField}><Field hint="DD/MM/YYYY · personal" label="Personal last service"><FormInput autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(customerLastServiceDate) => setMaintenanceDraft((draft) => ({ ...draft, customerLastServiceDate }))} placeholder="14/05/2026" value={maintenanceDraft.customerLastServiceDate} /></Field></View>
                <View style={styles.maintenanceDateField}><Field hint="DD/MM/YYYY · personal" label="Personal next check-in"><FormInput autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(customerNextCheckInDate) => setMaintenanceDraft((draft) => ({ ...draft, customerNextCheckInDate }))} placeholder="14/11/2026" value={maintenanceDraft.customerNextCheckInDate} /></Field></View>
              </View>
              {maintenanceError ? <Text accessibilityRole="alert" style={styles.maintenanceError}>{maintenanceError}</Text> : null}
              <View style={styles.maintenanceActions}>
                <PrimaryButton label={secureVehicles ? 'Save details' : 'Save demo details'} loading={maintenanceSaving} onPress={() => void saveMaintenancePreview()} />
                <PrimaryButton disabled={maintenanceSaving} label="Cancel" onPress={() => { setMaintenanceOpen(false); setMaintenanceError(''); }} variant="outline" />
              </View>
            </View>
          ) : (
            <View style={styles.maintenanceActions}>
              <PrimaryButton label="Edit details" onPress={() => { setMaintenanceNotice(''); setMaintenanceOpen(true); }} />
              <PrimaryButton label="Service history" onPress={() => router.push('/vehicle-reports')} variant="outline" />
            </View>
          )}
          {maintenanceNotice ? <Text accessibilityRole="alert" style={styles.maintenanceNotice}>{maintenanceNotice}</Text> : null}
          <Text style={styles.maintenanceExpiry}>{secureVehicles ? 'Odometer updates save to your account. Reminder dates are temporary and clear when the app closes.' : 'Demo entries clear when the app closes.'}</Text>
        </View>

        {dynoFirst ? <DynoResultCard result={dynoResult} vehicleLabel={vehicleLabel} /> : null}

        <View style={styles.photoSection}>
          <VehiclePhotoPicker
            onChange={(photo) => void changeVehiclePhoto(photo)}
            saving={photoSaving}
            storageMode={secureVehicles ? 'private_account' : 'local_preview'}
            value={selectedPhoto}
            vehicleLabel={vehicleLabel}
          />
          {photoNotice ? <Text accessibilityRole="alert" style={styles.maintenanceNotice}>{photoNotice}</Text> : null}
        </View>

        {!dynoFirst ? <DynoResultCard result={dynoResult} vehicleLabel={vehicleLabel} /> : null}

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Plan & Build</Text>
          <Text style={styles.sectionMeta}>With PSI</Text>
        </View>
        <View style={[styles.buildCard, (tablet && !largeText) && styles.buildCardWide]}>
          <View style={[styles.buildImageFrame, (tablet && !largeText) && styles.buildImageFrameWide]}>
            <Image
              accessibilityLabel="Illustrated engine and performance build plan"
              resizeMode="contain"
              source={require('../../../assets/images/dashboard/tile-plan-build-blue-silver.jpg')}
              style={[styles.fillImage, styles.planBuildImage]}
            />
          </View>
          <View style={styles.buildBody}>
            <Text style={styles.primaryLabel}>{buildPlan ? 'Example active plan' : 'Start with your goal'}</Text>
            <Text style={styles.buildTitle}>{buildPlan?.title ?? 'Plan the next stage'}</Text>
            <Text style={styles.bodyCopy}>
              {buildPlan?.objective ?? 'Tell PSI how you use the vehicle and what you want from it.'}
            </Text>
            {buildPlan ? (
              <View style={styles.stageList}>
                {buildPlan.stages.map((stage) => (
                  <View key={stage.id} style={styles.stage}>
                    <View style={[styles.stageMark, stage.status === 'current' && styles.stageMarkCurrent]} />
                    <View style={styles.stageCopy}>
                      <Text style={styles.stageTitle}>{stage.title}</Text>
                      <Text style={styles.stageStatus}>{stage.status.replace('_', ' ')}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            <PrimaryButton label="Open Plan & Build" onPress={() => router.push('/parts')} />
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Book service for this vehicle" onPress={() => openBookingForVehicle('service')} />
          <PrimaryButton label="Book dyno for this vehicle" onPress={() => openBookingForVehicle('dyno')} variant="outline" />
          <PrimaryButton label={secureVehicles ? 'Manage primary vehicle' : 'Open demo account setup'} onPress={() => router.push('/account/sign-up')} variant="outline" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function VehicleStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function DynoResultCard({
  result,
  vehicleLabel,
}: {
  result: ReturnType<typeof getLatestVerifiedDynoResult>;
  vehicleLabel: string;
}) {
  return (
    <View style={styles.dynoCard}>
      <View style={styles.dynoImageFrame}>
        <Image
          accessibilityLabel="Illustrated diagnostic scan tool and vehicle health report"
          resizeMode="contain"
          source={REPORT_IMAGE}
          style={[styles.fillImage, styles.reportImage]}
        />
      </View>
      <View style={styles.dynoBody}>
        <View style={styles.dynoHeading}>
          <View style={styles.dynoHeadingCopy}>
            <Text style={styles.primaryLabel}>Latest PSI-verified hub dyno result</Text>
            <Text style={styles.dynoTitle}>{vehicleLabel}</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Ionicons color={colors.ink} name="checkmark" size={14} />
            <Text style={styles.verifiedText}>PSI</Text>
          </View>
        </View>
        {result ? (
          <>
            <View style={styles.resultGrid}>
              <ResultValue label="Peak power" value={`${result.peakPower.value}`} unit="HP at hubs" />
              <ResultValue label="Peak torque" value={`${result.peakTorque.value}`} unit="Nm at hubs" />
            </View>
            <View style={styles.resultMeta}>
              <Text style={styles.bodyCopy}>Run: {formatShortDate(result.recordedAt)} · {result.fuel} · {result.ambientTemperatureC}°C</Text>
              <Text style={styles.readOnly}>Read-only for customers · PSI publishes each verified run</Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyResult}>
            <Text style={styles.emptyResultTitle}>No PSI result published yet</Text>
            <Text style={styles.bodyCopy}>Verified results will appear here after PSI completes and publishes a hub-dyno session.</Text>
          </View>
        )}
        <Text style={styles.disclaimer}>
          Example display only. Figures use the measurement basis and conditions shown on the PSI run report; results vary.
        </Text>
      </View>
    </View>
  );
}

function ResultValue({ label, unit, value }: { label: string; unit: string; value: string }) {
  return (
    <View style={styles.resultValue}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text adjustsFontSizeToFit maxFontSizeMultiplier={1.5} numberOfLines={1} style={styles.resultNumber}>{value}</Text>
      <Text style={styles.resultUnit}>{unit}</Text>
    </View>
  );
}

function formatShortDate(value: string | null) {
  return formatAustralianDate(value);
}

function formatOdometer(value: number | null | undefined) {
  return value == null ? 'Not recorded' : `${value.toLocaleString('en-AU')} km`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  accountState: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  accountStateTitle: { color: colors.white, fontSize: 24, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  accountStateCopy: { maxWidth: 420, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  scroll: { width: '100%', maxWidth: 980, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl + spacing.lg },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 39, fontWeight: '900', letterSpacing: -1.5, lineHeight: 41, textTransform: 'uppercase' },
  titleCompact: { fontSize: 33, lineHeight: 35 },
  accountButton: { ...mobileFrame, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.white },
  previewNotice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.silver, padding: spacing.md },
  previewNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  previewNoticeCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  sectionMeta: { color: colors.accent, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  vehicleSelectorRow: { width: '100%', flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  selectedVehicleChoice: { ...mobileFrame, minWidth: 0, minHeight: 70, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.silver, padding: spacing.md },
  vehicleChoiceCopy: { flex: 1, minWidth: 0, gap: 2 },
  vehicleChoiceTitle: { color: colors.white, fontSize: 12, fontWeight: '900' },
  vehicleChoiceTextSelected: { color: colors.ink },
  vehicleChoiceMeta: { color: colors.muted, fontSize: 10, textTransform: 'uppercase' },
  vehicleChoiceMetaSelected: { color: '#555D61' },
  addVehicle: { ...mobileFrame, width: 132, minHeight: 70, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: colors.ink, paddingHorizontal: spacing.sm },
  addVehicleText: { flexShrink: 1, color: colors.white, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  vehicleDropdown: { ...mobileFrame, overflow: 'hidden', backgroundColor: colors.panel },
  vehicleDropdownChoice: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, padding: spacing.md },
  vehicleDropdownChoiceSelected: { backgroundColor: colors.silver },
  vehicleCard: { ...mobileFrame, overflow: 'hidden', backgroundColor: colors.panel },
  vehicleCardWide: { flexDirection: 'row' },
  vehicleImageFrame: { width: '100%', aspectRatio: 16 / 10, overflow: 'hidden', backgroundColor: '#090909' },
  vehicleImageFrameWide: { width: '48%', aspectRatio: 1.1 },
  fillImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  exampleImageLabel: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, left: spacing.sm, backgroundColor: 'rgba(0,0,0,.84)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  exampleImageLabelText: { color: colors.silver, fontSize: 8, fontWeight: '900', letterSpacing: .5, textAlign: 'center', textTransform: 'uppercase' },
  vehicleDetails: { flex: 1, gap: spacing.md, padding: spacing.lg },
  primaryLabel: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  vehicleName: { color: colors.white, fontSize: 22, fontWeight: '900', lineHeight: 26, textTransform: 'uppercase' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { width: '47%', flexGrow: 1, minWidth: 125, gap: 3, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  statLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: .5, textTransform: 'uppercase' },
  statValue: { color: colors.white, fontSize: 12, fontWeight: '800' },
  localMaintenanceLabel: { color: colors.accent, fontSize: 9, fontWeight: '900', lineHeight: 14, textTransform: 'uppercase' },
  maintenanceCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.lg },
  maintenanceHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  maintenanceHeadingCopy: { flex: 1, gap: spacing.xs },
  maintenanceTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  maintenanceBoundary: { color: colors.silver, fontSize: 10, fontWeight: '800', lineHeight: 16 },
  maintenanceForm: { gap: spacing.md },
  maintenanceDateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  maintenanceDateField: { flex: 1, minWidth: 180 },
  maintenanceActions: { gap: spacing.sm },
  maintenanceError: { color: '#FF9F91', fontSize: 11, fontWeight: '800', lineHeight: 17 },
  maintenanceNotice: { color: colors.silver, fontSize: 11, fontWeight: '800', lineHeight: 17 },
  maintenanceExpiry: { color: colors.mutedDark, fontSize: 9, lineHeight: 14 },
  photoSection: { ...mobileFrame, backgroundColor: colors.panel, padding: spacing.lg },
  dynoCard: { ...mobileFrame, overflow: 'hidden', backgroundColor: colors.panel },
  dynoImageFrame: { width: '100%', aspectRatio: 1.1, overflow: 'hidden', backgroundColor: colors.ink },
  // The source reserves its lower third for tile text. This keeps the complete scanner and plug visible while removing only that empty area.
  reportImage: { transform: [{ scale: 1.36 }], transformOrigin: 'top center' },
  dynoBody: { gap: spacing.lg, padding: spacing.lg },
  dynoHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  dynoHeadingCopy: { flex: 1, gap: spacing.xs },
  dynoTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 16, backgroundColor: colors.silver, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  verifiedText: { color: colors.ink, fontSize: 9, fontWeight: '900' },
  resultGrid: { flexDirection: 'row', gap: spacing.sm },
  resultValue: { ...mobileFrame, flex: 1, minWidth: 0, gap: 2, backgroundColor: colors.ink, padding: spacing.md },
  resultLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  resultNumber: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.5, lineHeight: 42 },
  resultUnit: { color: colors.accent, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  resultMeta: { gap: spacing.xs },
  bodyCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  readOnly: { color: colors.silver, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  emptyResult: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
  emptyResultTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  disclaimer: { color: colors.mutedDark, fontSize: 10, lineHeight: 16 },
  buildCard: { ...mobileFrame, overflow: 'hidden', backgroundColor: colors.panel },
  buildCardWide: { flexDirection: 'row' },
  buildImageFrame: { width: '100%', aspectRatio: 4 / 5, overflow: 'hidden', backgroundColor: colors.inkSoft },
  buildImageFrameWide: { width: '44%', aspectRatio: 1 },
  planBuildImage: {},
  buildBody: { flex: 1, gap: spacing.md, padding: spacing.lg },
  buildTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  stageList: { gap: spacing.sm },
  stage: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stageMark: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.mutedDark },
  stageMarkCurrent: { backgroundColor: colors.accent },
  stageCopy: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  stageTitle: { flex: 1, color: colors.white, fontSize: 11, fontWeight: '800' },
  stageStatus: { color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  actions: { gap: spacing.sm },
  pressed: { opacity: .72 },
});
