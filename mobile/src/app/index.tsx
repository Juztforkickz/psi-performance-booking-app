import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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

import { BrandRail } from '@/components/brand-rail';
import { Eyebrow, PrimaryButton } from '@/components/ui';
import { colors, contact, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { BOOKING_PURPOSES, type BookingType } from '@/lib/booking';

type GatewayChoice = BookingType | 'parts' | 'gift_card';

const PARTS_STORE_URL = 'https://psiperformance.com.au/collections/all';
const GIFT_CARD_URL = 'https://psiperformance.com.au/products/psiperformance-gift-card';

type VerifiedOwnerStory = {
  quote: string;
  customer: string;
  rating: '★★★★★';
  vehicle?: string;
};

/**
 * Excerpts published on PSI's official homepage. Preserve the wording and only
 * add further feedback after PSI has verified its source and approval status.
 */
const VERIFIED_OWNER_STORIES: readonly VerifiedOwnerStory[] = [
  {
    customer: 'Cale Pearson',
    quote: 'The communication was excellent, they kept me updated throughout the entire process and were always clear about the next steps. I appreciated the regular progress updates and the transparency at every stage. The handover was smooth, with everything explained in detail. The team truly cares about both the car and the customer.',
    rating: '★★★★★',
    vehicle: '2002 Monaro · Communication and personal care',
  },
  {
    customer: 'Cade',
    quote: 'Could not be happier. These guys know their stuff and will look after you through the whole process. Answering all my questions and going above and beyond to deliver a really amazing result. Thanks Matt and Dale for your work 🙏🏻',
    rating: '★★★★★',
    vehicle: 'Knowledge, support and gratitude',
  },
  {
    customer: 'Harry Beith',
    quote: 'Matt and the team rebuilt my LS1 and transmission back to factory fresh condition. I was kept up to date the whole way through the project with photos included. I can\'t praise enough the quality of work and professionalism of the whole team. They turned an old well used 400,000 km drive train into brand new.',
    rating: '★★★★★',
    vehicle: 'LS1 and transmission rebuild · Transformational result',
  },
];
const OWNER_STORIES_SOURCE_URL = 'https://psiperformance.com.au/';

const PSI_PROMISES = [
  {
    index: '01',
    title: 'Protect',
    copy: 'Start with the health, safety and reliability of the complete vehicle.',
  },
  {
    index: '02',
    title: 'Build',
    copy: 'Plan the right upgrades around your goals and how you actually use the car.',
  },
  {
    index: '03',
    title: 'Together',
    copy: 'You matter here. PSI listens, explains and shapes the project with you.',
  },
] as const;

const PURPOSE_OPTIONS: {
  value: GatewayChoice;
  label: string;
  detail: string;
  priceGuide: string;
  depositGuide?: string;
}[] = [
  {
    value: 'service',
    label: BOOKING_PURPOSES.service.label,
    detail: 'A thorough workshop service, inspection and report.',
    priceGuide: 'From $423.50 incl. GST',
    depositGuide: '$100 deposit after date approval',
  },
  {
    value: 'dyno',
    label: BOOKING_PURPOSES.dyno.label,
    detail: 'Hub dyno calibration, testing and measured results.',
    priceGuide: BOOKING_PURPOSES.dyno.priceGuide,
    depositGuide: '$300 deposit after date approval',
  },
  {
    value: 'parts',
    label: 'Buy some parts',
    detail: 'Shop PSI performance parts on the official website.',
    priceGuide: 'Open online parts store',
  },
  {
    value: 'gift_card',
    label: 'Buy a gift card',
    detail: 'Choose a PSI Performance gift card and check out on the official website.',
    priceGuide: 'Open secure gift-card checkout',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { compact, fontScale, horizontalPadding, shortLandscape, useHomeColumns: wide, width } = useResponsiveLayout();
  const compactHeader = width < 350 || fontScale > 1.4;
  const [selected, setSelected] = useState<GatewayChoice | ''>('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectedOption = PURPOSE_OPTIONS.find((option) => option.value === selected);

  const continueFromGateway = () => {
    if (selected === 'parts') {
      void Linking.openURL(PARTS_STORE_URL);
      return;
    }
    if (selected === 'gift_card') {
      void Linking.openURL(GIFT_CARD_URL);
      return;
    }
    if (selected === 'service' || selected === 'dyno') {
      router.push({ pathname: '/booking', params: { type: selected } });
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, compact && styles.headerCompact]}>
          <Image
            accessibilityLabel="PSI Performance Garage"
            resizeMode="contain"
            source={require('../../assets/images/psi-logo.png')}
            style={[styles.logo, compactHeader && styles.logoCompact]}
          />
          <Pressable
            accessibilityHint="Opens PSI customer account access"
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={({ pressed }) => [styles.accountButton, compactHeader && styles.accountButtonCompact, pressed && styles.pressed]}
          >
            <View style={[styles.accountMark, compactHeader && styles.accountMarkCompact]}>
              <Text maxFontSizeMultiplier={1.4} style={styles.accountInitial}>P</Text>
            </View>
            <Text maxFontSizeMultiplier={2} style={styles.accountLabel}>Account</Text>
          </Pressable>
        </View>

        <View style={[styles.gateway, shortLandscape && styles.gatewayShort, wide && styles.gatewayWide]}>
          <View style={[styles.introPanel, wide && styles.introPanelWide]}>
            <Eyebrow>PSI Performance · Pakenham</Eyebrow>
            <Text maxFontSizeMultiplier={2} style={[styles.title, compact && styles.titleCompact, shortLandscape && styles.titleShort, wide && styles.titleWide]}>Book your car{`\n`}now.</Text>
            <Text style={styles.introCopy}>
              From servicing and diagnostics to dyno tuning, performance upgrades and parts, PSI is your one-stop
              performance workshop—with every request reviewed personally.
            </Text>

            {wide ? <WorkshopInfo /> : null}
          </View>

          <View style={[styles.bookingPanel, compact && styles.bookingPanelCompact, wide && styles.bookingPanelWide]}>
            <View style={styles.panelHeading}>
              <Text style={styles.panelKicker}>Online booking</Text>
              <Text style={styles.panelTitle}>What are you booking in for?</Text>
              <Text style={styles.panelCopy}>
                Tell us where to begin. PSI will personally review your vehicle, your goals and the right next step
                before confirming the work and final cost.
              </Text>
            </View>

            <View style={styles.selectorField}>
              <Text style={styles.selectorLabel}>Booking type</Text>
              <Pressable
                accessibilityHint="Opens booking type options"
                accessibilityLabel={selectedOption
                  ? `Booking type, ${selectedOption.label}. ${selectedOption.priceGuide}. ${selectedOption.depositGuide || ''}`.trim()
                  : 'Booking type, not selected'}
                accessibilityRole="button"
                onPress={() => setSelectorOpen(true)}
                style={({ pressed }) => [styles.selectorButton, pressed && styles.pressed]}
              >
                <View style={styles.selectorCopy}>
                  <Text style={[styles.selectorValue, !selectedOption && styles.selectorPlaceholder]}>
                    {selectedOption?.label || 'Select an option'}
                  </Text>
                  {selectedOption ? (
                    <Text style={styles.selectorGuide}>
                      {selectedOption.priceGuide}{selectedOption.depositGuide ? ` · ${selectedOption.depositGuide}` : ''}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
            </View>

            {selectedOption ? (
              <View style={styles.selectionCard}>
                <View style={styles.selectionIndex}>
                  <Text style={styles.selectionIndexText}>
                    {String(PURPOSE_OPTIONS.findIndex((item) => item.value === selectedOption.value) + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View style={styles.selectionCopy}>
                  <Text style={styles.selectionTitle}>{selectedOption.label}</Text>
                  <Text style={styles.selectionDetail}>{selectedOption.detail}</Text>
                  <Text style={styles.selectionPrice}>{selectedOption.priceGuide}</Text>
                  {selectedOption.depositGuide ? <Text style={styles.selectionDeposit}>{selectedOption.depositGuide}</Text> : null}
                </View>
              </View>
            ) : (
              <View style={styles.emptySelection}>
                <Text style={styles.emptySelectionText}>
                  Select an option to begin. Booking requests are reviewed before PSI confirms a date or sends a deposit link.
                </Text>
              </View>
            )}

            <PrimaryButton
              disabled={!selected}
              label={selected === 'parts'
                ? 'Shop parts on PSI website ↗'
                : selected === 'gift_card'
                  ? 'Buy a PSI gift card ↗'
                  : 'Continue to booking →'}
              onPress={continueFromGateway}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/account')}
              style={({ pressed }) => [styles.accountPrompt, pressed && styles.pressed]}
            >
              <View style={styles.accountPromptCopyWrap}>
                <Text style={styles.accountPromptTitle}>Customer accounts</Text>
                <Text style={styles.accountPromptCopy}>Review the secure, provider-ready account experience.</Text>
              </View>
              <Text style={styles.accountPromptArrow}>→</Text>
            </Pressable>

            <Text style={styles.depositNote}>
              Request first, pay after approval. PSI checks your preferred date before sending the applicable secure deposit link.
            </Text>
          </View>
          {!wide ? <WorkshopInfo /> : null}
        </View>

        <PsiStandard />

        <BrandRail />

        <View style={styles.footer}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} PSI Performance™ · All rights reserved</Text>
          <Pressable accessibilityRole="link" hitSlop={10} onPress={() => void Linking.openURL(contact.privacy)} style={styles.footerLinkTarget}>
            <Text style={styles.footerLink}>Privacy policy ↗</Text>
          </Pressable>
        </View>
      </ScrollView>

      <PurposeSelector
        onClose={() => setSelectorOpen(false)}
        onSelect={(value) => {
          setSelected(value);
          setSelectorOpen(false);
        }}
        selected={selected}
        visible={selectorOpen}
      />
    </SafeAreaView>
  );
}

function PsiStandard() {
  const { compact, useFieldColumns: wide, width } = useResponsiveLayout();
  const tabletStories = width >= 720;
  const wideStories = width >= 1024;

  return (
    <View accessibilityLabel="The PSI service standard" style={styles.standardSection}>
      <View style={[styles.standardLead, wide && styles.standardLeadWide]}>
        <View style={styles.standardHeading}>
          <Eyebrow>The PSI standard</Eyebrow>
          <Text maxFontSizeMultiplier={2} style={[styles.standardTitle, compact && styles.standardTitleCompact]}>
            One workshop.{`\n`}Your vehicle.
          </Text>
          <Text style={styles.standardCopy}>
            PSI brings the complete workshop journey together without losing sight of the individual behind the
            build. Let us protect and build your vehicle or project—together.
          </Text>
        </View>

        <View style={[styles.standardScore, wide && styles.standardScoreWide]}>
          <Text accessibilityLabel="Ten out of ten" maxFontSizeMultiplier={1.5} style={styles.standardScoreValue}>10/10</Text>
          <Text style={styles.standardScoreTitle}>The standard we work toward</Text>
          <Text style={styles.standardScoreCopy}>
            Care, clear communication and respect for your goals—from the first conversation to final handover.
          </Text>
          <Text style={styles.standardScoreDisclaimer}>PSI service commitment—not a customer review rating.</Text>
        </View>
      </View>

      <Image
        accessible
        accessibilityLabel="Black VF GTSR and grey Porsche 911 GT3 RS parked together outside the PSI workshop"
        accessibilityRole="image"
        resizeMode="cover"
        source={wide ? require('../../assets/images/psi-gtsr-porsche-clean.jpg') : require('../../assets/images/psi-gtsr-porsche-mobile-clean.jpg')}
        style={[styles.standardVehiclePhoto, wide ? styles.standardVehiclePhotoWide : styles.standardVehiclePhotoMobile]}
      />

      <View style={[styles.promiseGrid, wide && styles.promiseGridWide]}>
        {PSI_PROMISES.map((promise) => (
          <View key={promise.index} style={[styles.promiseCard, wide && styles.promiseCardWide]}>
            <Text style={styles.promiseIndex}>{promise.index}</Text>
            <Text style={styles.promiseTitle}>{promise.title}</Text>
            <Text style={styles.promiseCopy}>{promise.copy}</Text>
          </View>
        ))}
      </View>

      <View accessibilityLabel="Genuine five-star PSI customer feedback" style={styles.ownerStories}>
        <View style={styles.ownerStoriesHeading}>
          <View style={styles.ownerStoriesHeadingCopy}>
            <Text style={styles.ownerStoriesKicker}>Genuine five-star customer feedback</Text>
            <Text style={styles.ownerStoriesTitle}>Real owners. Real care. Real results.</Text>
          </View>
          <Pressable
            accessibilityHint="Opens the official PSI Performance website"
            accessibilityRole="link"
            onPress={() => void Linking.openURL(OWNER_STORIES_SOURCE_URL)}
            style={({ pressed }) => [styles.ownerStoriesSourceLink, pressed && styles.pressed]}
          >
            <Text style={styles.ownerStoriesSourceText}>Published on PSI homepage ↗</Text>
          </Pressable>
        </View>
        <View style={[styles.ownerStoryGrid, tabletStories && styles.ownerStoryGridTablet, wideStories && styles.ownerStoryGridWide]}>
          {VERIFIED_OWNER_STORIES.map((story) => (
            <View key={`${story.customer}-${story.quote}`} style={[styles.ownerStory, tabletStories && styles.ownerStoryTablet, wideStories && styles.ownerStoryWide]}>
              <Text accessibilityLabel="Five out of five stars" style={styles.ownerStoryRating}>{story.rating}</Text>
              <Text style={styles.ownerStoryQuote}>“{story.quote}”</Text>
              <Text style={styles.ownerStorySource}>
                {story.customer}{story.vehicle ? ` · ${story.vehicle}` : ''}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function InfoItem({
  label,
  value,
  link = false,
  onPress,
}: {
  label: string;
  value: string;
  link?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, link && styles.infoValueLink]}>{value}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.infoItem, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.infoItem}>{content}</View>;
}

function WorkshopInfo() {
  const { fontScale, width } = useResponsiveLayout();
  const stackQr = width < 440 || fontScale > 1.25;

  return (
    <View style={styles.contactArea}>
      <View style={styles.infoList}>
        <InfoItem label="Shop hours" value={'Mon–Fri · 8:30am–5pm\nSaturday · By appointment'} />
        <InfoItem
          label="Phone"
          link
          onPress={() => void Linking.openURL(contact.phoneUrl)}
          value={contact.phoneDisplay}
        />
        <InfoItem
          label="Email"
          link
          onPress={() => void Linking.openURL(contact.emailUrl)}
          value={contact.email}
        />
        <InfoItem
          label="Workshop"
          link
          onPress={() => void Linking.openURL(contact.mapsUrl)}
          value={contact.address}
        />
        <InfoItem
          label="Instagram"
          link
          onPress={() => void Linking.openURL(contact.instagram)}
          value="@psiperformancegarage"
        />
        <InfoItem
          label="Facebook"
          link
          onPress={() => void Linking.openURL(contact.facebook)}
          value="PSI Performance Garage"
        />
      </View>

      <View accessibilityLabel="PSI Performance contact QR code" style={[styles.qrCard, stackQr && styles.qrCardStacked]}>
        <View style={[styles.qrImageFrame, stackQr && styles.qrImageFrameStacked]}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Scan to save PSI contact"
            resizeMode="contain"
            source={require('../../assets/images/psi-contact-qr.png')}
            style={[styles.qrImage, stackQr && styles.qrImageStacked]}
          />
        </View>
        <View style={[styles.qrCopy, stackQr && styles.qrCopyStacked]}>
          <Text style={[styles.qrEyebrow, stackQr && styles.qrTextStacked]}>Quick contact</Text>
          <Text style={[styles.qrTitle, stackQr && styles.qrTextStacked]}>Scan to save PSI contact</Text>
          <Text style={[styles.qrDescription, stackQr && styles.qrTextStacked]}>Phone, email, workshop address and website in one scan.</Text>
        </View>
      </View>
    </View>
  );
}

function PurposeSelector({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: GatewayChoice | '';
  onSelect: (value: GatewayChoice) => void;
  onClose: () => void;
}) {
  const { compact, fontScale, height, shortLandscape, width } = useResponsiveLayout();
  const wide = width >= 680 && height >= 600 && fontScale <= 1.3;
  const tight = compact || shortLandscape;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close booking type selector" accessibilityRole="button" onPress={onClose} style={styles.modalBackdrop} />
        <SafeAreaView
          edges={['top', 'right', 'bottom', 'left']}
          style={[styles.modalSafeArea, wide && styles.modalSafeAreaWide]}
        >
          <View accessibilityViewIsModal style={[styles.selectorSheet, tight && styles.selectorSheetTight, wide && styles.selectorSheetWide]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View style={styles.sheetHeadingCopy}>
                <Text style={styles.sheetKicker}>Choose one</Text>
                <Text maxFontSizeMultiplier={2} style={styles.sheetTitle}>What are you booking in for?</Text>
              </View>
              <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={12} onPress={onClose}>
                <Text maxFontSizeMultiplier={1.3} style={styles.closeButton}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              accessibilityRole="radiogroup"
              contentContainerStyle={styles.optionList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.optionScroll}
            >
              {PURPOSE_OPTIONS.map((option, index) => {
                const active = selected === option.value;
                return (
                  <Pressable
                    accessibilityLabel={`${option.label}. ${option.priceGuide}. ${option.depositGuide ? `${option.depositGuide}. ` : ''}${option.detail}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    aria-checked={active}
                    key={option.value}
                    onPress={() => onSelect(option.value)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      active && styles.optionRowActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text maxFontSizeMultiplier={1.5} style={[styles.optionIndex, active && styles.optionTextActive]}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionTitle, active && styles.optionTextActive]}>{option.label}</Text>
                      <Text style={[styles.optionPrice, active && styles.optionPriceActive]}>{option.priceGuide}</Text>
                      {option.depositGuide ? (
                        <Text style={[styles.optionDeposit, active && styles.optionPriceActive]}>{option.depositGuide}</Text>
                      ) : null}
                      <Text style={[styles.optionDetail, active && styles.optionDetailActive]}>{option.detail}</Text>
                    </View>
                    <View style={[styles.optionRadio, active && styles.optionRadioActive]}>
                      {active ? <View style={styles.optionRadioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    width: '100%',
    maxWidth: 1180,
    minHeight: 78,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerCompact: {
    minHeight: 66,
  },
  logo: {
    width: 142,
    height: 48,
  },
  logoCompact: {
    width: 96,
    height: 36,
  },
  accountButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    flexShrink: 1,
  },
  accountButtonCompact: {
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  accountMark: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.gold,
  },
  accountMarkCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  accountInitial: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  accountLabel: {
    flexShrink: 1,
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  gateway: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: spacing.xxl,
    paddingVertical: 54,
  },
  gatewayShort: {
    gap: spacing.xl,
    paddingVertical: spacing.xl,
  },
  gatewayWide: {
    minHeight: 670,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 64,
    paddingVertical: 72,
  },
  introPanel: {
    gap: spacing.md,
  },
  introPanelWide: {
    width: '38%',
    justifyContent: 'center',
    paddingRight: spacing.lg,
  },
  title: {
    marginTop: spacing.sm,
    color: colors.white,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -2.5,
    lineHeight: 47,
    textTransform: 'uppercase',
  },
  titleWide: {
    fontSize: 62,
    lineHeight: 62,
  },
  titleShort: {
    fontSize: 36,
    lineHeight: 38,
  },
  titleCompact: {
    fontSize: 38,
    letterSpacing: -1.8,
    lineHeight: 40,
  },
  introCopy: {
    maxWidth: 480,
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 24,
  },
  contactArea: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  infoList: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  infoItem: {
    minHeight: 82,
    justifyContent: 'center',
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: spacing.md,
  },
  infoLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: colors.cream,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  infoValueLink: {
    textDecorationLine: 'underline',
  },
  qrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: spacing.md,
  },
  qrCardStacked: {
    alignItems: 'center',
    flexDirection: 'column',
  },
  qrImageFrame: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    padding: 7,
  },
  qrImage: {
    width: 98,
    height: 98,
  },
  qrImageFrameStacked: {
    width: 148,
    height: 148,
  },
  qrImageStacked: {
    width: 132,
    height: 132,
  },
  qrCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  qrCopyStacked: {
    flex: 0,
    width: '100%',
    alignItems: 'center',
  },
  qrTextStacked: {
    textAlign: 'center',
  },
  qrEyebrow: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  qrTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19,
    textTransform: 'uppercase',
  },
  qrDescription: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  bookingPanel: {
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 4,
    backgroundColor: colors.panel,
    padding: spacing.lg,
  },
  bookingPanelCompact: {
    padding: spacing.md,
  },
  bookingPanelWide: {
    flex: 1,
    justifyContent: 'center',
    padding: 42,
  },
  panelHeading: {
    gap: spacing.sm,
  },
  panelKicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: colors.white,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 33,
    textTransform: 'uppercase',
  },
  panelCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  selectorField: {
    gap: spacing.sm,
  },
  selectorLabel: {
    color: colors.cream,
    fontSize: 12,
    fontWeight: '900',
  },
  selectorButton: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 3,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
  },
  selectorCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  selectorValue: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  selectorPlaceholder: {
    color: colors.muted,
    fontWeight: '600',
  },
  selectorGuide: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '800',
  },
  chevron: {
    color: colors.gold,
    fontSize: 27,
    lineHeight: 30,
  },
  selectionCard: {
    minHeight: 112,
    flexDirection: 'row',
    gap: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    backgroundColor: colors.inkSoft,
    padding: spacing.md,
  },
  selectionIndex: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.gold,
  },
  selectionIndexText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  selectionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  selectionTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '900',
  },
  selectionDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  selectionPrice: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  selectionDeposit: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: '800',
  },
  emptySelection: {
    minHeight: 94,
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    padding: spacing.md,
  },
  emptySelectionText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
  },
  accountPrompt: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
  },
  accountPromptTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  accountPromptCopyWrap: {
    flex: 1,
    minWidth: 0,
  },
  accountPromptCopy: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
  },
  accountPromptArrow: {
    color: colors.gold,
    fontSize: 22,
  },
  depositNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  standardSection: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 56,
  },
  standardLead: {
    gap: spacing.xl,
  },
  standardLeadWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  standardHeading: {
    flex: 1,
    minWidth: 0,
    gap: spacing.md,
  },
  standardTitle: {
    color: colors.white,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 44,
    textTransform: 'uppercase',
  },
  standardTitleCompact: {
    fontSize: 34,
    letterSpacing: -1.4,
    lineHeight: 37,
  },
  standardCopy: {
    maxWidth: 620,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 24,
  },
  standardScore: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.panel,
    padding: spacing.lg,
  },
  standardScoreWide: {
    width: '36%',
    justifyContent: 'center',
  },
  standardScoreValue: {
    color: colors.gold,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 44,
  },
  standardScoreTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  standardScoreCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
  },
  standardScoreDisclaimer: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 15,
  },
  standardVehiclePhoto: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
  },
  standardVehiclePhotoWide: {
    aspectRatio: 1744 / 901,
  },
  standardVehiclePhotoMobile: {
    aspectRatio: 1,
  },
  promiseGrid: {
    gap: spacing.sm,
  },
  promiseGridWide: {
    flexDirection: 'row',
  },
  promiseCard: {
    gap: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: colors.gold,
    backgroundColor: colors.panel,
    padding: spacing.lg,
  },
  promiseCardWide: {
    flex: 1,
  },
  promiseIndex: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  promiseTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  promiseCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  ownerStories: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.xl,
  },
  ownerStoriesHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  ownerStoriesHeadingCopy: {
    flex: 1,
    minWidth: 220,
    gap: spacing.xs,
  },
  ownerStoriesKicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  ownerStoriesTitle: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  ownerStoriesSourceLink: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
  },
  ownerStoriesSourceText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  ownerStoryGrid: {
    gap: spacing.sm,
  },
  ownerStoryGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ownerStoryGridWide: {
    flexDirection: 'row',
  },
  ownerStory: {
    gap: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    backgroundColor: colors.panel,
    padding: spacing.lg,
  },
  ownerStoryWide: {
    flexBasis: 0,
    flex: 1,
  },
  ownerStoryTablet: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  ownerStoryRating: {
    color: colors.gold,
    fontSize: 15,
    letterSpacing: 2,
  },
  ownerStoryQuote: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  ownerStorySource: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  footer: {
    width: '100%',
    maxWidth: 1180,
    minHeight: 72,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerText: {
    color: colors.muted,
    fontSize: 10,
  },
  footerLinkTarget: {
    minHeight: 44,
    justifyContent: 'center',
  },
  footerLink: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '800',
    textDecorationLine: 'underline',
    textTransform: 'uppercase',
  },
  modalRoot: {
    flex: 1,
  },
  modalSafeArea: {
    flex: 1,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  modalSafeAreaWide: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
  },
  selectorSheet: {
    minHeight: 0,
    maxHeight: '92%',
    gap: spacing.lg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  selectorSheetTight: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  selectorSheetWide: {
    width: '100%',
    maxWidth: 620,
    borderRadius: 5,
    padding: spacing.xl,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: colors.line,
  },
  sheetHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sheetHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetKicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    maxWidth: 470,
    marginTop: spacing.xs,
    color: colors.white,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  closeButton: {
    color: colors.muted,
    fontSize: 32,
    lineHeight: 34,
  },
  optionList: {
    gap: spacing.sm,
  },
  optionScroll: {
    flexShrink: 1,
    minHeight: 0,
  },
  optionRow: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 3,
    backgroundColor: colors.ink,
    padding: spacing.md,
  },
  optionRowActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  optionIndex: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  optionTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  optionPrice: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  optionDeposit: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: '800',
  },
  optionDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
  },
  optionTextActive: {
    color: colors.ink,
  },
  optionPriceActive: {
    color: '#4A360C',
  },
  optionDetailActive: {
    color: '#4A360C',
  },
  optionRadio: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 11,
    flexShrink: 0,
  },
  optionRadioActive: {
    borderColor: colors.ink,
  },
  optionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ink,
  },
  pressed: {
    opacity: 0.72,
  },
});
