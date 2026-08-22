import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { VehiclePhotoPicker } from '@/components/vehicle-photo-picker';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import {
  CUSTOMER_PREVIEW,
  getLatestVerifiedDynoResult,
} from '@/lib/customer-preview';
import { useCustomerPreview } from '@/lib/customer-preview-context';

const GARAGE_IMAGE = require('../../../assets/images/dashboard/tile-my-garage.jpg');
const REPORT_IMAGE = require('../../../assets/images/dashboard/tile-vehicle-reports.jpg');

export default function GarageScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { compact, horizontalPadding, largeText, tablet } = useResponsiveLayout();
  const {
    prepareBookingVehicle,
    selectedVehicleId,
    selectVehicle,
    setVehiclePhoto,
    vehiclePhotos,
    vehicles,
  } = useCustomerPreview();

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0];
  const selectedPhoto = vehiclePhotos[selectedVehicle.id] ?? null;
  const dynoResult = getLatestVerifiedDynoResult(selectedVehicle.id);
  const buildPlan = CUSTOMER_PREVIEW.buildPlans.find((plan) => plan.vehicleId === selectedVehicle.id);
  const vehicleLabel = `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`;
  const dynoFirst = section === 'dyno';

  const heroSource = selectedPhoto ? { uri: selectedPhoto.uri } : GARAGE_IMAGE;

  const openBookingForVehicle = (type: 'service' | 'dyno') => {
    prepareBookingVehicle(selectedVehicle.id);
    router.push({ pathname: '/booking', params: { type } });
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Customer preview</Text>
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
          <Text style={styles.previewNoticeTitle}>Preview vehicle data</Text>
          <Text style={styles.previewNoticeCopy}>
            This garage is not connected to PSI records. Details and photos stay only in this open app preview and clear when it reloads or closes.
          </Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your vehicles</Text>
          <Text style={styles.sectionMeta}>{vehicles.length} preview vehicles</Text>
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
                onPress={() => selectVehicle(vehicle.id)}
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
            accessibilityLabel="Set up a vehicle in the account preview"
            accessibilityRole="button"
            onPress={() => router.push('/account/sign-up')}
            style={({ pressed }) => [styles.addVehicle, pressed && styles.pressed]}
          >
            <Ionicons color={colors.gold} name="add" size={24} />
            <Text style={styles.addVehicleText}>Set up preview vehicle</Text>
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
                label="Odometer"
                value={selectedVehicle.odometerKm == null ? 'Not added' : `${selectedVehicle.odometerKm.toLocaleString('en-AU')} km`}
              />
              <VehicleStat label="Last PSI visit" value={formatShortDate(selectedVehicle.lastVisit)} />
              <VehicleStat label="Next check-in" value={formatShortDate(selectedVehicle.nextDue)} />
            </View>
          </View>
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
              resizeMode="cover"
              source={require('../../../assets/images/dashboard/tile-plan-build.jpg')}
              style={styles.fillImage}
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
          <PrimaryButton label="Preview account setup" onPress={() => router.push('/account/sign-up')} variant="outline" />
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
          accessibilityLabel="Vehicle report with illustrated power and torque curves"
          resizeMode="cover"
          source={REPORT_IMAGE}
          style={styles.fillImage}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
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
  photoSection: { ...mobileFrame, backgroundColor: colors.panel, padding: spacing.lg },
  dynoCard: { ...mobileFrame, overflow: 'hidden', backgroundColor: colors.panel },
  dynoImageFrame: { width: '100%', aspectRatio: 16 / 8.5, overflow: 'hidden', backgroundColor: colors.inkSoft },
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
  buildImageFrame: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden', backgroundColor: colors.inkSoft },
  buildImageFrameWide: { width: '44%', aspectRatio: 1 },
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
