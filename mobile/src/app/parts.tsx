import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanBuildSelect } from '@/components/plan-build-select';
import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, contact, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CUSTOMER_PREVIEW, type BuildPlanStage } from '@/lib/customer-preview';
import { useCustomerPreview } from '@/lib/customer-preview-context';
import {
  BUDGET_OPTIONS,
  buildPlanEmailUrl,
  buildPlanSmsUrl,
  createEmptyPlanBuildDraft,
  formatPlanBuildBrief,
  getPlanBuildDraftIssue,
  INTENDED_USE_OPTIONS,
  PLAN_BUILD_AREAS,
  PLAN_SMS_RECIPIENT_URL,
  PLANNING_STAGE_OPTIONS,
  PRIORITY_OPTIONS,
  resolvePlanSmsPlatform,
  TIMING_OPTIONS,
  type PlanAreaId,
  type PlanBuildDraft,
} from '@/lib/plan-build-preview';

const PARTS_STORE_URL = 'https://psiperformance.com.au/collections/all';
const GIFT_CARD_URL = 'https://psiperformance.com.au/products/psiperformance-gift-card';
const INSTAGRAM_MESSAGE_URL = 'https://ig.me/m/psiperformancegarage';
const FACEBOOK_MESSAGE_URL = 'https://m.me/psiperformancegarage';
const AREA_ICONS = {
  engine: 'settings-outline',
  suspension: 'options-outline',
  exhaust: 'cloud-outline',
  intake: 'funnel-outline',
  repairs: 'construct-outline',
  interior: 'speedometer-outline',
  programming: 'code-slash-outline',
  other: 'add-outline',
} as const;
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
  const { selectedVehicleId, vehicles } = useCustomerPreview();
  const { compact, horizontalPadding, largeText, short, tablet } = useResponsiveLayout();
  const [draft, setDraft] = useState<PlanBuildDraft>(() => createEmptyPlanBuildDraft());
  const [handoffStatus, setHandoffStatus] = useState('');
  const vehicle = vehicles.find((item) => item.id === selectedVehicleId) ?? vehicles[0];
  const plan = CUSTOMER_PREVIEW.buildPlans.find((item) => item.vehicleId === vehicle.id);
  const planTitle = plan?.title ?? 'Start a staged PSI plan';
  const planObjective = plan?.objective ?? 'Define how you use the vehicle and what you want to improve, then let PSI inspect and shape a suitable plan.';
  const planStages = plan?.stages ?? STARTER_PLAN_STAGES;
  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const brief = useMemo(() => formatPlanBuildBrief(draft, vehicleLabel), [draft, vehicleLabel]);
  const handoffIssue = useMemo(() => getPlanBuildDraftIssue(draft), [draft]);
  const canOpenHandoff = handoffIssue === null;
  const stackAreaCards = compact || largeText;

  const updateDraft = <Key extends keyof PlanBuildDraft>(key: Key, value: PlanBuildDraft[Key]) => {
    setHandoffStatus('');
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const toggleArea = (areaId: PlanAreaId) => {
    setHandoffStatus('');
    setDraft((current) => {
      if (!current.selectedAreas.includes(areaId)) {
        return { ...current, selectedAreas: [...current.selectedAreas, areaId] };
      }

      const areaSelections = { ...current.areaSelections };
      const areaNotes = { ...current.areaNotes };
      delete areaSelections[areaId];
      delete areaNotes[areaId];
      return {
        ...current,
        selectedAreas: current.selectedAreas.filter((item) => item !== areaId),
        areaSelections,
        areaNotes,
      };
    });
  };

  const updateAreaSelection = (areaId: PlanAreaId, value: string) => {
    setHandoffStatus('');
    setDraft((current) => ({
      ...current,
      areaSelections: { ...current.areaSelections, [areaId]: value },
      areaNotes: value === 'other'
        ? current.areaNotes
        : { ...current.areaNotes, [areaId]: '' },
    }));
  };

  const updateAreaNote = (areaId: PlanAreaId, value: string) => {
    setHandoffStatus('');
    setDraft((current) => ({
      ...current,
      areaNotes: { ...current.areaNotes, [areaId]: value },
    }));
  };

  const updateBudget = (value: string) => {
    setHandoffStatus('');
    setDraft((current) => ({
      ...current,
      budget: value,
      budgetDetails: value === 'defined' ? current.budgetDetails : '',
    }));
  };

  const openContactHandoff = async ({
    buildUrl,
    fallbackUrl,
    label,
    transfersBrief,
  }: {
    buildUrl: () => string;
    fallbackUrl?: string;
    label: string;
    transfersBrief: boolean;
  }) => {
    setHandoffStatus('');
    try {
      await Linking.openURL(buildUrl());
      setHandoffStatus(transfersBrief
        ? `${label} opened with a draft. Nothing was sent automatically. Review it first; if you tap Send there, it becomes a real message to PSI.`
        : `${label} opened without a prefilled brief. Copy the selectable brief above into your message. Nothing was sent automatically; if you tap Send there, it becomes a real message to PSI.`);
    } catch {
      if (fallbackUrl) {
        try {
          await Linking.openURL(fallbackUrl);
          setHandoffStatus(`${label} opened without a prefilled brief. Copy the selectable brief above into your message. Nothing was sent automatically; if you tap Send there, it becomes a real message to PSI.`);
          return;
        } catch {
          // The visible error below covers both attempts without exposing entered text.
        }
      }
      setHandoffStatus(`${label} could not be opened on this device. Your brief is still visible above and has not been sent.`);
    }
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
              style={[styles.fillImage, styles.heroImage]}
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
          <Text style={styles.previewNoticeTitle}>Preview build brief · not saved</Text>
          <Text style={styles.previewNoticeCopy}>
            Use these choices to shape a conversation with PSI. Nothing is sent, uploaded or stored by this app. The brief clears when the preview reloads.
          </Text>
        </View>

        <View style={styles.builderCard}>
          <BuilderHeading
            copy="The vehicle currently selected in My Garage stays attached to this local preview brief."
            number="01"
            title="Your vehicle"
          />
          <View style={styles.vehicleBrief}>
            <View style={styles.vehicleBriefIcon}>
              <Ionicons color={colors.ink} name="car-sport-outline" size={24} />
            </View>
            <View style={styles.vehicleBriefCopy}>
              <Text style={styles.vehicleBriefLabel}>Selected from My Garage</Text>
              <Text style={styles.vehicleBriefTitle}>{vehicleLabel}</Text>
              <Text style={styles.vehicleBriefMeta}>{vehicle.registration} · Example vehicle data</Text>
            </View>
          </View>
        </View>

        <View style={styles.builderCard}>
          <BuilderHeading
            copy="Choose every area you want to discuss. These are conversation topics—not a promise that a part or service is suitable."
            number="02"
            title="Choose build areas"
          />
          <View style={styles.areaGrid}>
            {PLAN_BUILD_AREAS.map((area) => {
              const selected = draft.selectedAreas.includes(area.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={area.id}
                  onPress={() => toggleArea(area.id)}
                  style={({ pressed }) => [
                    styles.areaCard,
                    !stackAreaCards && styles.areaCardTwoColumn,
                    selected && styles.areaCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.areaIcon, selected && styles.areaIconSelected]}>
                    <Ionicons color={selected ? colors.ink : colors.gold} name={AREA_ICONS[area.id]} size={22} />
                  </View>
                  <View style={styles.areaCopy}>
                    <Text style={[styles.areaTitle, selected && styles.areaTextSelected]}>{area.label}</Text>
                    <Text style={[styles.areaDetail, selected && styles.areaDetailSelected]}>{area.detail}</Text>
                  </View>
                  <View style={[styles.areaCheck, selected && styles.areaCheckSelected]}>
                    {selected ? <Ionicons color={colors.ink} name="checkmark" size={15} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {draft.selectedAreas.length ? (
            <View style={styles.areaDetailsList}>
              {draft.selectedAreas.map((areaId) => {
                const area = PLAN_BUILD_AREAS.find((item) => item.id === areaId);
                if (!area) return null;
                const selectedOption = draft.areaSelections[areaId] ?? '';
                return (
                  <View key={area.id} style={styles.areaDetailCard}>
                    <View style={styles.areaDetailHeading}>
                      <Ionicons color={colors.gold} name={AREA_ICONS[area.id]} size={20} />
                      <Text style={styles.areaDetailTitle}>{area.label}</Text>
                    </View>
                    <PlanBuildSelect
                      label="What would you like to discuss?"
                      onChange={(value) => updateAreaSelection(area.id, value)}
                      options={area.options}
                      value={selectedOption}
                    />
                    {selectedOption === 'other' ? (
                      <Field hint={`${(draft.areaNotes[area.id] ?? '').length}/240`} label={`${area.label} — other details`}>
                        <FormInput
                          autoCapitalize="sentences"
                          autoCorrect
                          maxLength={240}
                          multiline
                          onChangeText={(value) => updateAreaNote(area.id, value)}
                          placeholder="Tell PSI what was not listed."
                          style={styles.smallTextArea}
                          textAlignVertical="top"
                          value={draft.areaNotes[area.id] ?? ''}
                        />
                      </Field>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptySelection}>
              <Ionicons color={colors.gold} name="arrow-up-outline" size={20} />
              <Text style={styles.emptySelectionText}>Choose at least one area to start shaping your brief.</Text>
            </View>
          )}
        </View>

        <View style={styles.builderCard}>
          <BuilderHeading
            copy="Add any useful direction for the first conversation. These fields are optional; PSI still inspects and confirms the right scope separately."
            number="03"
            title="Shape the plan"
          />
          <View style={styles.selectList}>
            <PlanBuildSelect
              label="Intended use"
              onChange={(value) => updateDraft('intendedUse', value)}
              options={INTENDED_USE_OPTIONS}
              value={draft.intendedUse}
            />
            <PlanBuildSelect
              label="Main priority"
              onChange={(value) => updateDraft('priority', value)}
              options={PRIORITY_OPTIONS}
              value={draft.priority}
            />
            <PlanBuildSelect
              label="Planning stage"
              onChange={(value) => updateDraft('planningStage', value)}
              options={PLANNING_STAGE_OPTIONS}
              value={draft.planningStage}
            />
            <PlanBuildSelect
              label="Timing"
              onChange={(value) => updateDraft('timing', value)}
              options={TIMING_OPTIONS}
              value={draft.timing}
            />
            <PlanBuildSelect
              label="Budget direction"
              onChange={updateBudget}
              options={BUDGET_OPTIONS}
              value={draft.budget}
            />
          </View>

          {draft.budget === 'defined' ? (
            <Field hint={`${draft.budgetDetails.length}/160`} label="Budget note — optional">
              <FormInput
                autoCapitalize="sentences"
                autoCorrect
                maxLength={160}
                onChangeText={(value) => updateDraft('budgetDetails', value)}
                placeholder="Add the range or staging limit you want to discuss."
                value={draft.budgetDetails}
              />
            </Field>
          ) : null}

          <Field hint={`${draft.goalNotes.length}/360`} label="Goal or concern — optional">
            <FormInput
              autoCapitalize="sentences"
              autoCorrect
              maxLength={360}
              multiline
              onChangeText={(value) => updateDraft('goalNotes', value)}
              placeholder="What would you like the vehicle to do, feel like or stop doing?"
              style={styles.textArea}
              textAlignVertical="top"
              value={draft.goalNotes}
            />
          </Field>
          <Field hint={`${draft.currentSetup.length}/360`} label="Current setup — optional">
            <FormInput
              autoCapitalize="sentences"
              autoCorrect
              maxLength={360}
              multiline
              onChangeText={(value) => updateDraft('currentSetup', value)}
              placeholder="Current modifications, parts already fitted or parts you already own."
              style={styles.textArea}
              textAlignVertical="top"
              value={draft.currentSetup}
            />
          </Field>
        </View>

        <View style={styles.actionPanel}>
          <BuilderHeading
            copy="Check the brief, then choose how you want to contact PSI. SMS and email carry a draft; social buttons open the PSI message thread without copying your brief."
            number="04"
            title="Review & continue"
          />
          <Text selectable style={styles.briefPreview}>{brief}</Text>
          <View accessibilityRole="alert" style={styles.handoffNotice}>
            <Ionicons color={colors.gold} name="shield-checkmark-outline" size={22} />
            <Text style={styles.handoffNoticeText}>
              Nothing has been sent. If you tap Send in the external app, this becomes a real message to PSI; the demo itself does not send or store it. For social messages, copy the selectable brief above first.
            </Text>
          </View>
          <View style={styles.handoffActions}>
            <HandoffAction
              detail={contact.phoneDisplay}
              disabled={!canOpenHandoff}
              icon="chatbubble-outline"
              label="Open SMS draft"
              onPress={() => {
                const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
                const platform = resolvePlanSmsPlatform(Platform.OS, userAgent);
                void openContactHandoff({
                  buildUrl: () => buildPlanSmsUrl(brief, platform),
                  fallbackUrl: PLAN_SMS_RECIPIENT_URL,
                  label: 'Messages',
                  transfersBrief: true,
                });
              }}
            />
            <HandoffAction
              detail={contact.email}
              disabled={!canOpenHandoff}
              icon="mail-outline"
              label="Open email draft"
              onPress={() => void openContactHandoff({
                buildUrl: () => buildPlanEmailUrl(brief),
                fallbackUrl: contact.emailUrl,
                label: 'Email',
                transfersBrief: true,
              })}
            />
            <HandoffAction
              detail="@psiperformancegarage"
              disabled={!canOpenHandoff}
              icon="logo-instagram"
              label="Open Instagram to DM"
              onPress={() => void openContactHandoff({
                buildUrl: () => INSTAGRAM_MESSAGE_URL,
                fallbackUrl: contact.instagram,
                label: 'Instagram',
                transfersBrief: false,
              })}
            />
            <HandoffAction
              detail="PSI Performance Garage"
              disabled={!canOpenHandoff}
              icon="logo-facebook"
              label="Open Facebook to message"
              onPress={() => void openContactHandoff({
                buildUrl: () => FACEBOOK_MESSAGE_URL,
                fallbackUrl: contact.facebook,
                label: 'Facebook',
                transfersBrief: false,
              })}
            />
          </View>
          {!canOpenHandoff ? <Text style={styles.actionHint}>{handoffIssue}</Text> : null}
          {handoffStatus ? <Text accessibilityRole="alert" style={styles.handoffStatus}>{handoffStatus}</Text> : null}
          <Text style={styles.planDisclaimer}>
            This brief is not a quote or booking. PSI must inspect the vehicle and separately confirm suitability, availability, scope, pricing and timing.
          </Text>
        </View>

        <View style={styles.examplePlan}>
          <Text style={styles.examplePlanKicker}>Example only · not generated from your selections</Text>
          <Text style={styles.examplePlanNote}>PSI has not reviewed this local preview brief. These stages only show how a future plan could be organised.</Text>
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

function BuilderHeading({ copy, number, title }: { copy: string; number: string; title: string }) {
  return (
    <View style={styles.builderHeading}>
      <View style={styles.builderNumber}><Text style={styles.builderNumberText}>{number}</Text></View>
      <View style={styles.builderHeadingCopy}>
        <Text style={styles.builderTitle}>{title}</Text>
        <Text style={styles.bodyCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function HandoffAction({
  detail,
  disabled,
  icon,
  label,
  onPress,
}: {
  detail: string;
  disabled: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.handoffAction, pressed && styles.pressed, disabled && styles.handoffActionDisabled]}
    >
      <View style={styles.handoffIcon}>
        <Ionicons color={colors.ink} name={icon} size={22} />
      </View>
      <View style={styles.handoffCopy}>
        <Text style={styles.handoffLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.handoffDetail}>{detail}</Text>
      </View>
      <Ionicons color={colors.gold} name="open-outline" size={20} />
    </Pressable>
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
  heroImage: { transform: [{ scale: 1.18 }], transformOrigin: 'top center' },
  fillImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heroCopy: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 38, fontWeight: '900', letterSpacing: -1.7, lineHeight: 40, textTransform: 'uppercase' },
  titleCompact: { fontSize: 32, lineHeight: 35 },
  lead: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  previewNotice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.cream, padding: spacing.md },
  previewNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  previewNoticeCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  examplePlan: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.lg },
  examplePlanKicker: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  examplePlanNote: { maxWidth: 720, color: colors.muted, fontSize: 10, lineHeight: 16 },
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
  builderCard: { ...mobileFrame, gap: spacing.lg, backgroundColor: colors.panel, padding: spacing.lg },
  builderHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  builderNumber: { ...mobileFrame, width: 46, height: 46, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  builderNumberText: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: .5 },
  builderHeadingCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  builderTitle: { color: colors.white, fontSize: 19, fontWeight: '900', lineHeight: 23, textTransform: 'uppercase' },
  vehicleBrief: { ...mobileFrame, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.ink, padding: spacing.md },
  vehicleBriefIcon: { width: 46, height: 46, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.cream },
  vehicleBriefCopy: { flex: 1, minWidth: 0, gap: 3 },
  vehicleBriefLabel: { color: colors.gold, fontSize: 8, fontWeight: '900', letterSpacing: .7, textTransform: 'uppercase' },
  vehicleBriefTitle: { color: colors.white, fontSize: 15, fontWeight: '900', lineHeight: 19, textTransform: 'uppercase' },
  vehicleBriefMeta: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  areaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  areaCard: { ...mobileFrame, position: 'relative', width: '100%', minHeight: 132, gap: spacing.sm, backgroundColor: colors.ink, padding: spacing.md },
  areaCardTwoColumn: { width: '47%', flexGrow: 1 },
  areaCardSelected: { backgroundColor: colors.cream },
  areaIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 21, backgroundColor: colors.inkSoft },
  areaIconSelected: { borderColor: colors.ink, backgroundColor: colors.white },
  areaCopy: { flex: 1, gap: 3 },
  areaTitle: { color: colors.white, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  areaTextSelected: { color: colors.ink },
  areaDetail: { color: colors.muted, fontSize: 9, lineHeight: 14 },
  areaDetailSelected: { color: '#57534C' },
  areaCheck: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  areaCheckSelected: { borderColor: colors.ink, backgroundColor: colors.gold },
  areaDetailsList: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.lg },
  areaDetailCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.md },
  areaDetailHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  areaDetailTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  emptySelection: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.md },
  emptySelectionText: { flex: 1, minWidth: 0, color: colors.muted, fontSize: 11, lineHeight: 17 },
  selectList: { gap: spacing.md },
  textArea: { minHeight: 124, paddingTop: spacing.md },
  smallTextArea: { minHeight: 92, paddingTop: spacing.md },
  actionPanel: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  briefPreview: { ...mobileFrame, color: colors.cream, backgroundColor: colors.ink, fontSize: 11, lineHeight: 18, padding: spacing.md },
  handoffNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.gold, backgroundColor: 'rgba(217,179,91,.08)', padding: spacing.md },
  handoffNoticeText: { flex: 1, minWidth: 0, color: colors.cream, fontSize: 10, lineHeight: 16 },
  handoffActions: { gap: spacing.sm },
  handoffAction: { ...mobileFrame, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.ink, padding: spacing.sm },
  handoffActionDisabled: { opacity: .38 },
  handoffIcon: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.cream },
  handoffCopy: { flex: 1, minWidth: 0, gap: 3 },
  handoffLabel: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  handoffDetail: { color: colors.muted, fontSize: 9 },
  actionHint: { color: colors.gold, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  handoffStatus: { ...mobileFrame, color: colors.cream, backgroundColor: colors.panel, fontSize: 10, lineHeight: 16, padding: spacing.md },
  planDisclaimer: { color: colors.muted, fontSize: 9, lineHeight: 15 },
  storeCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.panel, padding: spacing.lg },
  storeHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  storeHeadingCopy: { flex: 1, gap: 2 },
  storeKicker: { color: colors.gold, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  storeTitle: { color: colors.white, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  storeActions: { gap: spacing.sm },
  pressed: { opacity: .72 },
});
