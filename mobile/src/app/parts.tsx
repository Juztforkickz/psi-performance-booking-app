import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui';
import { colors, contact, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CUSTOMER_PREVIEW, type BuildPlanStage } from '@/lib/customer-preview';
import { useCustomerPreview } from '@/lib/customer-preview-context';

const PARTS_STORE_URL = 'https://psiperformance.com.au/collections/all';
const GIFT_CARD_URL = 'https://psiperformance.com.au/products/psiperformance-gift-card';
const STARTER_PLAN_STAGES: readonly BuildPlanStage[] = [
  {
    id: 'starter-goal',
    title: 'Describe the goal',
    note: 'Capture intended use, concerns and the driving result you want before choosing parts.',
    status: 'current',
  },
  {
    id: 'starter-inspection',
    title: 'PSI inspection & baseline',
    note: 'PSI checks the vehicle and records a suitable baseline before recommending scope.',
    status: 'planned',
  },
  {
    id: 'starter-scope',
    title: 'Approve measured stages',
    note: 'Parts, price, timing and calibration are confirmed separately with PSI before work begins.',
    status: 'planned',
  },
];

export default function PlanBuildScreen() {
  const router = useRouter();
  const { prepareBookingVehicle, selectedVehicleId, vehicles } = useCustomerPreview();
  const { compact, horizontalPadding, short, tablet } = useResponsiveLayout();
  const vehicle = vehicles.find((item) => item.id === selectedVehicleId) ?? vehicles[0];
  const plan = CUSTOMER_PREVIEW.buildPlans.find((item) => item.vehicleId === vehicle.id);
  const planTitle = plan?.title ?? 'Start a staged PSI plan';
  const planObjective = plan?.objective ?? 'Define how you use the vehicle and what you want to improve, then let PSI inspect and shape a suitable plan.';
  const planStages = plan?.stages ?? STARTER_PLAN_STAGES;

  const openBookingForVehicle = (type: 'service' | 'dyno') => {
    prepareBookingVehicle(vehicle.id);
    router.push({ pathname: '/booking', params: { type } });
  };

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.screen}>
      <View style={[styles.header, compact && styles.headerCompact, { paddingHorizontal: horizontalPadding }]}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Ionicons color={colors.gold} name="arrow-back" size={22} />
          <Text maxFontSizeMultiplier={2} style={styles.backText}>Back</Text>
        </Pressable>
        <Image
          accessibilityLabel="PSI Performance Garage"
          resizeMode="contain"
          source={require('../../assets/images/psi-logo.png')}
          style={styles.logo}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, short && styles.scrollShort, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, tablet && styles.heroWide]}>
          <View style={[styles.heroImageFrame, tablet && styles.heroImageFrameWide]}>
            <Image
              accessibilityLabel="Illustrated engine, turbo and staged vehicle build plan"
              resizeMode="cover"
              source={require('../../assets/images/dashboard/tile-plan-build.jpg')}
              style={styles.fillImage}
            />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Plan & Build · Customer preview</Text>
            <Text maxFontSizeMultiplier={1.8} style={[styles.title, compact && styles.titleCompact]}>One goal.{`\n`}Measured stages.</Text>
            <Text style={styles.lead}>
              Keep the vehicle, your goals, PSI recommendations and the next approved stage together—without treating a plan as a quote or booking.
            </Text>
          </View>
        </View>

        <View accessibilityRole="alert" style={styles.previewNotice}>
          <Text style={styles.previewNoticeTitle}>Synthetic plan · nothing submitted</Text>
          <Text style={styles.previewNoticeCopy}>
            This example is local display data. Planning notes are not a quote, booking or guaranteed power result. PSI confirms scope, parts, price and timing separately.
          </Text>
        </View>

        <View style={styles.planHeading}>
          <View style={styles.planHeadingCopy}>
            <Text style={styles.planKicker}>{vehicle.year} {vehicle.make} {vehicle.model}</Text>
            <Text style={styles.planTitle}>{planTitle}</Text>
          </View>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>With PSI</Text>
          </View>
        </View>
        <Text style={styles.planObjective}>{planObjective}</Text>

        <View style={styles.stageList}>
          {planStages.map((stage, index) => (
            <PlanStage index={index + 1} key={stage.id} stage={stage} />
          ))}
        </View>

        <View style={styles.goalCard}>
          <Ionicons color={colors.gold} name="flag-outline" size={30} />
          <View style={styles.goalCopy}>
            <Text style={styles.goalTitle}>What the customer contributes</Text>
            <Text style={styles.bodyCopy}>
              Intended use, concerns, budget direction and what they want the car to feel like. PSI separately inspects the vehicle and recommends a safe, suitable scope.
            </Text>
          </View>
          <View style={styles.goalTags}>
            {['Street response', 'Reliability first', 'Measured progress'].map((tag) => (
              <View key={tag} style={styles.goalTag}><Text style={styles.goalTagText}>{tag}</Text></View>
            ))}
          </View>
        </View>

        <View style={styles.actionPanel}>
          <Text style={styles.actionKicker}>Take the next step</Text>
          <Text style={styles.actionTitle}>Start with inspection and conversation.</Text>
          <Text style={styles.bodyCopy}>The existing approval-first request flow remains the safe starting point. PSI reviews the vehicle and preferred date before confirming anything.</Text>
          <View style={styles.actions}>
            <PrimaryButton
              label="Request service & report"
              onPress={() => openBookingForVehicle('service')}
            />
            <PrimaryButton
              label="Request hub dyno tuning"
              onPress={() => openBookingForVehicle('dyno')}
              variant="outline"
            />
            <PrimaryButton
              label={`Call PSI · ${contact.phoneDisplay}`}
              onPress={() => void Linking.openURL(contact.phoneUrl)}
              variant="outline"
            />
          </View>
        </View>

        <View style={styles.storeCard}>
          <View style={styles.storeHeading}>
            <Ionicons color={colors.gold} name="bag-handle-outline" size={26} />
            <View style={styles.storeHeadingCopy}>
              <Text style={styles.storeKicker}>Official PSI website</Text>
              <Text style={styles.storeTitle}>Parts & gift cards</Text>
            </View>
          </View>
          <Text style={styles.bodyCopy}>Store checkout opens on PSI&apos;s official website. This app never claims an order or payment has completed.</Text>
          <View style={styles.storeActions}>
            <PrimaryButton label="Shop performance parts ↗" onPress={() => void Linking.openURL(PARTS_STORE_URL)} />
            <PrimaryButton label="PSI gift cards ↗" onPress={() => void Linking.openURL(GIFT_CARD_URL)} variant="outline" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanStage({ index, stage }: { index: number; stage: BuildPlanStage }) {
  const current = stage.status === 'current';
  const complete = stage.status === 'completed';
  return (
    <View style={[styles.stageCard, current && styles.stageCardCurrent]}>
      <View style={[styles.stageNumber, (current || complete) && styles.stageNumberActive]}>
        {complete ? (
          <Ionicons color={colors.ink} name="checkmark" size={17} />
        ) : (
          <Text style={[styles.stageNumberText, current && styles.stageNumberTextActive]}>{String(index).padStart(2, '0')}</Text>
        )}
      </View>
      <View style={styles.stageCopy}>
        <View style={styles.stageTopline}>
          <Text style={styles.stageTitle}>{stage.title}</Text>
          <Text style={[styles.stageStatus, current && styles.stageStatusCurrent]}>{stage.status}</Text>
        </View>
        <Text style={styles.bodyCopy}>{stage.note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { width: '100%', maxWidth: 980, minHeight: 70, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  headerCompact: { minHeight: 62 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backText: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  logo: { width: 106, height: 38 },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 940, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.xl, paddingBottom: 64 },
  scrollShort: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  hero: { ...mobileFrame, overflow: 'hidden', backgroundColor: colors.panel },
  heroWide: { flexDirection: 'row' },
  heroImageFrame: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden', backgroundColor: colors.inkSoft },
  heroImageFrameWide: { width: '44%', aspectRatio: 1 },
  fillImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heroCopy: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.7, lineHeight: 40, textTransform: 'uppercase' },
  titleCompact: { fontSize: 32, lineHeight: 35 },
  lead: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  previewNotice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.cream, padding: spacing.md },
  previewNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  previewNoticeCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  planHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  planHeadingCopy: { flex: 1, gap: spacing.xs },
  planKicker: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  planTitle: { color: colors.white, fontSize: 22, fontWeight: '900', lineHeight: 27, textTransform: 'uppercase' },
  planBadge: { ...mobileFrame, backgroundColor: colors.cream, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  planBadgeText: { color: colors.ink, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  planObjective: { maxWidth: 740, color: colors.cream, fontSize: 14, lineHeight: 22 },
  stageList: { gap: spacing.sm },
  stageCard: { ...mobileFrame, minHeight: 118, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  stageCardCurrent: { backgroundColor: colors.inkSoft },
  stageNumber: { ...mobileFrame, width: 46, height: 46, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  stageNumberActive: { backgroundColor: colors.cream },
  stageNumberText: { color: colors.gold, fontSize: 10, fontWeight: '900' },
  stageNumberTextActive: { color: colors.ink },
  stageCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  stageTopline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  stageTitle: { flex: 1, color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  stageStatus: { color: colors.muted, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  stageStatusCurrent: { color: colors.gold },
  bodyCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  goalCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.lg },
  goalCopy: { gap: spacing.xs },
  goalTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  goalTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  goalTag: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  goalTagText: { color: colors.cream, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  actionPanel: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  actionKicker: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  actionTitle: { color: colors.white, fontSize: 20, fontWeight: '900', textTransform: 'uppercase' },
  actions: { gap: spacing.sm },
  storeCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.lg },
  storeHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  storeHeadingCopy: { flex: 1, gap: 2 },
  storeKicker: { color: colors.gold, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  storeTitle: { color: colors.white, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  storeActions: { gap: spacing.sm },
  pressed: { opacity: .72 },
});
