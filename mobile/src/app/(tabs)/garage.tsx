import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { useCustomerAccount } from '@/lib/customer-account-context';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import {
  CUSTOMER_PREVIEW,
  getLatestVerifiedDynoResult,
  type PreviewVehicle,
} from '@/lib/customer-preview';
import { useCustomerPreview } from '@/lib/customer-preview-context';

const GARAGE_IMAGE = require('../../../assets/images/dashboard/tile-my-garage.jpg');
const REPORT_IMAGE = require('../../../assets/images/dashboard/tile-vehicle-reports.jpg');

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
    return <GarageAccountState copy="Restoring your protected customer session…" loading title="Opening secure garage" />;
  }

  if (secureAccountActive && status === 'loading') {
    return <GarageAccountState copy="Loading vehicles owned by your authenticated account…" loading title="Opening secure garage" />;
  }

  if (secureAccountActive && (status === 'error' || !account)) {
    return <GarageAccountState copy={error || 'Your private vehicle records could not be loaded.'} title="Garage unavailable" />;
  }

  const secureVehicles = secureAccountActive
    ? (account?.vehicles ?? []).map((vehicle): PreviewVehicle => ({
      id: vehicle.id,
      isPrimary: vehicle.is_primary,
      lastVisit: null,
      make: vehicle.make,
      model: vehicle.model,
      nextDue: null,
      odometerKm: vehicle.odometer_km,
      registration: vehicle.registration,
      vinLastFour: vehicle.vin_last_four,
      year: vehicle.year,
    }))
    : null;

  if (secureVehicles && secureVehicles.length === 0) {
    return <GarageAccountState actionLabel="Add your first vehicle" copy="Your secure account is active, but it does not have a vehicle yet." title="Your garage is ready" />;
  }

  return <GarageContent secureVehicles={secureVehicles} />;
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
        {loading ? <ActivityIndicator color={colors.gold} size="large" /> : <Ionicons color={colors.gold} name="car-sport" size={38} />}
        <Text style={styles.accountStateTitle}>{title}</Text>
        <Text style={styles.accountStateCopy}>{copy}</Text>
        {actionLabel ? <PrimaryButton label={actionLabel} onPress={() => router.push('/account/sign-up')} /> : null}
        {!loading ? <PrimaryButton label="Open account" onPress={() => router.push('/account')} variant="outline" /> : null}
      </View>
    </SafeAreaView>
  );
}

function GarageContent({ secureVehicles }: { secureVehicles: readonly PreviewVehicle[] | null }) {
  const router = useRouter();
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
  const selectedVehicleId = secureVehicles ? secureSelectedVehicleId : previewSelectedVehicleId;

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];
  const selectedPhoto = vehiclePhotos[selectedVehicle.id] ?? null;
  const dynoResult = getLatestVerifiedDynoResult(selectedVehicle.id);
  const buildPlan = CUSTOMER_PREVIEW.buildPlans.find((plan) => plan.vehicleId === selectedVehicle.id);
  const vehicleLabel = `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`;
  const dynoFirst = section === 'dyno';
  const maintenance = vehicleMaintenance[selectedVehicle.id] ?? {
    customerLastServiceDate: null,
    customerNextCheckInDate: null,
    odometerKm: selectedVehicle.odometerKm,
    updatedLocally: false,
  };
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceDraft, setMaintenanceDraft] = useState<MaintenanceDraft>({
    customerLastServiceDate: maintenance.customerLastServiceDate ?? '',
    customerNextCheckInDate: maintenance.customerNextCheckInDate ?? '',
    odometerKm: maintenance.odometerKm?.toString() ?? '',
  });
  const [maintenanceError, setMaintenanceError] = useState('');
  const [maintenanceNotice, setMaintenanceNotice] = useState('');

  const resetMaintenanceDraft = (vehicle: PreviewVehicle) => {
    const nextMaintenance = vehicleMaintenance[vehicle.id] ?? {
      customerLastServiceDate: null,
      customerNextCheckInDate: null,
      odometerKm: vehicle.odometerKm,
    };
    setMaintenanceDraft({
      customerLastServiceDate: nextMaintenance.customerLastServiceDate ?? '',
      customerNextCheckInDate: nextMaintenance.customerNextCheckInDate ?? '',
      odometerKm: nextMaintenance.odometerKm?.toString() ?? '',
    });
  };

  const selectGarageVehicle = (vehicleId: string) => {
    const vehicle = vehicles.find((candidate) => candidate.id === vehicleId);
    if (!vehicle) return;
    resetMaintenanceDraft(vehicle);
    setMaintenanceOpen(false);
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

  const saveMaintenancePreview = () => {
    const odometerKm = maintenanceDraft.odometerKm ? Number(maintenanceDraft.odometerKm) : null;
    const datesAreValid = [maintenanceDraft.customerLastServiceDate, maintenanceDraft.customerNextCheckInDate]
      .every((value) => !value || isIsoDate(value));
    if (
      (odometerKm !== null && (!Number.isInteger(odometerKm) || odometerKm < 0 || odometerKm > 9999999))
      || !datesAreValid
    ) {
      setMaintenanceNotice('');
      setMaintenanceError('Enter a valid odometer and use YYYY-MM-DD for each date, or leave a field blank.');
      return;
    }
    updateVehicleMaintenancePreview(selectedVehicle.id, {
      customerLastServiceDate: maintenanceDraft.customerLastServiceDate || null,
      customerNextCheckInDate: maintenanceDraft.customerNextCheckInDate || null,
      odometerKm,
    });
    setMaintenanceError('');
    setMaintenanceNotice('Maintenance details updated for this open preview only. Nothing was uploaded or permanently saved.');
    setMaintenanceOpen(false);
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{secureVehicles ? 'Secure customer garage' : 'Customer preview'}</Text>
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
          <Text style={styles.previewNoticeTitle}>{secureVehicles ? 'Private account vehicles' : 'Preview vehicle data'}</Text>
          <Text style={styles.previewNoticeCopy}>
            {secureVehicles
              ? 'This vehicle list is loaded from your authenticated private account. Photos and maintenance edits on this screen remain local to this open session and are not uploaded or saved yet.'
              : 'This garage is not connected to PSI records. Details and photos stay only in this open app preview and clear when it reloads or closes.'}
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your vehicles</Text>
          <Text style={styles.sectionMeta}>{vehicles.length} {secureVehicles ? 'account' : 'preview'} vehicles</Text>
        </View>
        <ScrollView
          accessibilityRole="radiogroup"
          contentContainerStyle={styles.vehicleSelector}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {vehicles.map((vehicle) => {
            const selected = vehicle.id === selectedVehicle.id;
            return (
              <Pressable
                accessibilityLabel={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={vehicle.id}
                onPress={() => selectGarageVehicle(vehicle.id)}
                style={({ pressed }) => [
                  styles.vehicleChoice,
                  selected && styles.vehicleChoiceSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons color={selected ? colors.ink : colors.gold} name="car-sport" size={22} />
                <View style={styles.vehicleChoiceCopy}>
                  <Text style={[styles.vehicleChoiceTitle, selected && styles.vehicleChoiceTextSelected]}>
                    {vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={[styles.vehicleChoiceMeta, selected && styles.vehicleChoiceMetaSelected]}>
                    {vehicle.year} · {vehicle.registration}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityLabel={secureVehicles ? 'Manage the primary account vehicle' : 'Set up a vehicle in the account preview'}
            accessibilityRole="button"
            onPress={() => router.push('/account/sign-up')}
            style={({ pressed }) => [styles.addVehicle, pressed && styles.pressed]}
          >
            <Ionicons color={colors.gold} name="add" size={24} />
            <Text style={styles.addVehicleText}>{secureVehicles ? 'Manage primary vehicle' : 'Set up preview vehicle'}</Text>
          </Pressable>
        </ScrollView>

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
                <Text style={styles.exampleImageLabelText}>Example artwork · add your car photo</Text>
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
              <VehicleStat label="Personal last service" value={formatShortDate(maintenance.customerLastServiceDate)} />
              <VehicleStat label="Personal next check-in" value={formatShortDate(maintenance.customerNextCheckInDate)} />
            </View>
            {maintenance.updatedLocally ? <Text style={styles.localMaintenanceLabel}>Local preview details · not a PSI-verified record</Text> : null}
          </View>
        </View>

        <View style={styles.maintenanceCard}>
          <View style={styles.maintenanceHeading}>
            <View style={styles.maintenanceHeadingCopy}>
              <Text style={styles.primaryLabel}>Vehicle upkeep</Text>
              <Text style={styles.maintenanceTitle}>Maintenance details</Text>
              <Text style={styles.bodyCopy}>Update the customer odometer and personal service reminders for this {secureVehicles ? 'open session' : 'preview vehicle'}.</Text>
            </View>
            <Ionicons color={colors.gold} name="create-outline" size={24} />
          </View>
          <Text style={styles.maintenanceBoundary}>Customer-entered details stay separate from PSI workshop records. They cannot replace the protected Last PSI service or Next PSI check-in above.</Text>
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
                <View style={styles.maintenanceDateField}><Field hint="YYYY-MM-DD · customer entry" label="Personal last service"><FormInput autoCapitalize="none" maxLength={10} onChangeText={(customerLastServiceDate) => setMaintenanceDraft((draft) => ({ ...draft, customerLastServiceDate }))} placeholder="2026-05-14" value={maintenanceDraft.customerLastServiceDate} /></Field></View>
                <View style={styles.maintenanceDateField}><Field hint="YYYY-MM-DD · customer entry" label="Personal next check-in"><FormInput autoCapitalize="none" maxLength={10} onChangeText={(customerNextCheckInDate) => setMaintenanceDraft((draft) => ({ ...draft, customerNextCheckInDate }))} placeholder="2026-11-14" value={maintenanceDraft.customerNextCheckInDate} /></Field></View>
              </View>
              {maintenanceError ? <Text accessibilityRole="alert" style={styles.maintenanceError}>{maintenanceError}</Text> : null}
              <View style={styles.maintenanceActions}>
                <PrimaryButton label="Save Preview Details" onPress={saveMaintenancePreview} />
                <PrimaryButton label="Cancel" onPress={() => { setMaintenanceOpen(false); setMaintenanceError(''); }} variant="outline" />
              </View>
            </View>
          ) : (
            <View style={styles.maintenanceActions}>
              <PrimaryButton label="Edit Maintenance Details" onPress={() => { setMaintenanceNotice(''); setMaintenanceOpen(true); }} />
              <PrimaryButton label="Open Service History" onPress={() => router.push('/vehicle-reports')} variant="outline" />
            </View>
          )}
          {maintenanceNotice ? <Text accessibilityRole="alert" style={styles.maintenanceNotice}>{maintenanceNotice}</Text> : null}
          <Text style={styles.maintenanceExpiry}>Local only · these edits clear when the app reloads or closes.</Text>
        </View>

        {dynoFirst ? <DynoResultCard result={dynoResult} vehicleLabel={vehicleLabel} /> : null}

        <View style={styles.photoSection}>
          <VehiclePhotoPicker
            onChange={(photo) => setVehiclePhoto(selectedVehicle.id, photo)}
            value={selectedPhoto}
            vehicleLabel={vehicleLabel}
          />
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
              source={require('../../../assets/images/dashboard/tile-plan-build.jpg')}
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
          <PrimaryButton label={secureVehicles ? 'Manage primary vehicle' : 'Preview account setup'} onPress={() => router.push('/account/sign-up')} variant="outline" />
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
              <ResultValue label="Peak power" value={`${result.peakPower.value}`} unit="kW at hubs" />
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
  if (!value) return 'Not scheduled';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  accountState: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  accountStateTitle: { color: colors.white, fontSize: 24, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
  accountStateCopy: { maxWidth: 420, color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  scroll: { width: '100%', maxWidth: 980, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 39, fontWeight: '900', letterSpacing: -1.5, lineHeight: 41, textTransform: 'uppercase' },
  titleCompact: { fontSize: 33, lineHeight: 35 },
  accountButton: { ...mobileFrame, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.white },
  previewNotice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.cream, padding: spacing.md },
  previewNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  previewNoticeCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  sectionMeta: { color: colors.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  vehicleSelector: { gap: spacing.sm, paddingRight: spacing.md },
  vehicleChoice: { ...mobileFrame, minWidth: 210, minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.panel, padding: spacing.md },
  vehicleChoiceSelected: { backgroundColor: colors.cream },
  vehicleChoiceCopy: { flex: 1, gap: 2 },
  vehicleChoiceTitle: { color: colors.white, fontSize: 12, fontWeight: '900' },
  vehicleChoiceTextSelected: { color: colors.ink },
  vehicleChoiceMeta: { color: colors.muted, fontSize: 10, textTransform: 'uppercase' },
  vehicleChoiceMetaSelected: { color: '#57534C' },
  addVehicle: { ...mobileFrame, minWidth: 142, minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.ink, padding: spacing.md },
  addVehicleText: { color: colors.white, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  vehicleCard: { ...mobileFrame, overflow: 'hidden', backgroundColor: colors.panel },
  vehicleCardWide: { flexDirection: 'row' },
  vehicleImageFrame: { width: '100%', aspectRatio: 16 / 10, overflow: 'hidden', backgroundColor: '#090909' },
  vehicleImageFrameWide: { width: '48%', aspectRatio: 1.1 },
  fillImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  exampleImageLabel: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, left: spacing.sm, backgroundColor: 'rgba(0,0,0,.84)', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  exampleImageLabelText: { color: colors.cream, fontSize: 8, fontWeight: '900', letterSpacing: .5, textAlign: 'center', textTransform: 'uppercase' },
  vehicleDetails: { flex: 1, gap: spacing.md, padding: spacing.lg },
  primaryLabel: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  vehicleName: { color: colors.white, fontSize: 22, fontWeight: '900', lineHeight: 26, textTransform: 'uppercase' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { width: '47%', flexGrow: 1, minWidth: 125, gap: 3, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  statLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: .5, textTransform: 'uppercase' },
  statValue: { color: colors.white, fontSize: 12, fontWeight: '800' },
  localMaintenanceLabel: { color: colors.gold, fontSize: 9, fontWeight: '900', lineHeight: 14, textTransform: 'uppercase' },
  maintenanceCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.lg },
  maintenanceHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  maintenanceHeadingCopy: { flex: 1, gap: spacing.xs },
  maintenanceTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  maintenanceBoundary: { color: colors.cream, fontSize: 10, fontWeight: '800', lineHeight: 16 },
  maintenanceForm: { gap: spacing.md },
  maintenanceDateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  maintenanceDateField: { flex: 1, minWidth: 180 },
  maintenanceActions: { gap: spacing.sm },
  maintenanceError: { color: '#FF9F91', fontSize: 11, fontWeight: '800', lineHeight: 17 },
  maintenanceNotice: { color: colors.cream, fontSize: 11, fontWeight: '800', lineHeight: 17 },
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
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 16, backgroundColor: colors.cream, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  verifiedText: { color: colors.ink, fontSize: 9, fontWeight: '900' },
  resultGrid: { flexDirection: 'row', gap: spacing.sm },
  resultValue: { ...mobileFrame, flex: 1, minWidth: 0, gap: 2, backgroundColor: colors.ink, padding: spacing.md },
  resultLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  resultNumber: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.5, lineHeight: 42 },
  resultUnit: { color: colors.gold, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  resultMeta: { gap: spacing.xs },
  bodyCopy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  readOnly: { color: colors.cream, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
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
  stageMarkCurrent: { backgroundColor: colors.gold },
  stageCopy: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  stageTitle: { flex: 1, color: colors.white, fontSize: 11, fontWeight: '800' },
  stageStatus: { color: colors.muted, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  actions: { gap: spacing.sm },
  pressed: { opacity: .72 },
});
