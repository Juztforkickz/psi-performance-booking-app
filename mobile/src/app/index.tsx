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
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, PrimaryButton } from '@/components/ui';
import { colors, contact, spacing } from '@/constants/brand';
import { BOOKING_PURPOSES, type BookingType } from '@/lib/booking';

type GatewayChoice = BookingType | 'parts';

const PURPOSE_OPTIONS: {
  value: GatewayChoice;
  label: string;
  detail: string;
  priceGuide: string;
}[] = [
  {
    value: 'service',
    label: BOOKING_PURPOSES.service.label,
    detail: 'A thorough workshop service, inspection and report.',
    priceGuide: 'Price guide from $385 + GST',
  },
  {
    value: 'dyno',
    label: BOOKING_PURPOSES.dyno.label,
    detail: 'Hub dyno calibration, testing and measured results.',
    priceGuide: 'Price guide from $350 + GST',
  },
  {
    value: 'parts',
    label: 'Buy some parts',
    detail: 'Explore a dedicated PSI performance parts page.',
    priceGuide: 'Parts catalogue',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const compact = width < 380;
  const [selected, setSelected] = useState<GatewayChoice | ''>('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectedOption = PURPOSE_OPTIONS.find((option) => option.value === selected);

  const continueFromGateway = () => {
    if (selected === 'parts') {
      router.push('/parts');
      return;
    }
    if (selected === 'service' || selected === 'dyno') {
      router.push({ pathname: '/booking', params: { type: selected } });
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image
            accessibilityLabel="PSI Performance Garage"
            resizeMode="contain"
            source={require('../../assets/images/psi-logo.png')}
            style={styles.logo}
          />
          <Pressable
            accessibilityHint="Opens PSI customer account access"
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
          >
            <View style={styles.accountMark}>
              <Text style={styles.accountInitial}>P</Text>
            </View>
            <Text style={styles.accountLabel}>Account</Text>
          </Pressable>
        </View>

        <View style={[styles.gateway, wide && styles.gatewayWide]}>
          <View style={[styles.introPanel, wide && styles.introPanelWide]}>
            <Eyebrow>PSI Performance · Pakenham</Eyebrow>
            <Text style={[styles.title, compact && styles.titleCompact, wide && styles.titleWide]}>Book your car{`\n`}now.</Text>
            <Text style={styles.introCopy}>
              Secure your preferred workshop date for servicing or dyno tuning. PSI confirms every request personally.
            </Text>

            {wide ? <WorkshopInfo /> : null}
          </View>

          <View style={[styles.bookingPanel, wide && styles.bookingPanelWide]}>
            <View style={styles.panelHeading}>
              <Text style={styles.panelKicker}>Online booking</Text>
              <Text style={styles.panelTitle}>What are you booking in for?</Text>
              <Text style={styles.panelCopy}>
                Choose a starting point. Prices are guides; PSI will confirm the work and final cost with you.
              </Text>
            </View>

            <View style={styles.selectorField}>
              <Text style={styles.selectorLabel}>Booking type</Text>
              <Pressable
                accessibilityHint="Opens booking type options"
                accessibilityLabel={selectedOption ? `Booking type, ${selectedOption.label}` : 'Booking type, not selected'}
                accessibilityRole="button"
                onPress={() => setSelectorOpen(true)}
                style={({ pressed }) => [styles.selectorButton, pressed && styles.pressed]}
              >
                <View style={styles.selectorCopy}>
                  <Text style={[styles.selectorValue, !selectedOption && styles.selectorPlaceholder]}>
                    {selectedOption?.label || 'Select an option'}
                  </Text>
                  {selectedOption ? <Text style={styles.selectorGuide}>{selectedOption.priceGuide}</Text> : null}
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
                </View>
              </View>
            ) : (
              <View style={styles.emptySelection}>
                <Text style={styles.emptySelectionText}>
                  Select an option to begin. Service and dyno bookings require a fixed $200 AUD deposit before submission.
                </Text>
              </View>
            )}

            <PrimaryButton
              disabled={!selected}
              label={selected === 'parts' ? 'Open parts page →' : 'Continue to booking →'}
              onPress={continueFromGateway}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/account')}
              style={({ pressed }) => [styles.accountPrompt, pressed && styles.pressed]}
            >
              <View>
                <Text style={styles.accountPromptTitle}>Customer accounts</Text>
                <Text style={styles.accountPromptCopy}>Review the secure, provider-ready account experience.</Text>
              </View>
              <Text style={styles.accountPromptArrow}>→</Text>
            </Pressable>

            <Text style={styles.depositNote}>
              Payment is handled by secure checkout. A preferred date is not confirmed until PSI accepts it.
            </Text>
          </View>
          {!wide ? <WorkshopInfo /> : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} PSI Performance Garage</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(contact.privacy)}>
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
        wide={width >= 680}
      />
    </SafeAreaView>
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

      <View accessibilityLabel="PSI Performance contact QR code" style={styles.qrCard}>
        <View style={styles.qrImageFrame}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Scan to save PSI contact"
            resizeMode="contain"
            source={require('../../assets/images/psi-contact-qr.png')}
            style={styles.qrImage}
          />
        </View>
        <View style={styles.qrCopy}>
          <Text style={styles.qrEyebrow}>Quick contact</Text>
          <Text style={styles.qrTitle}>Scan to save PSI contact</Text>
          <Text style={styles.qrDescription}>Phone, email, workshop address and website in one scan.</Text>
        </View>
      </View>
    </View>
  );
}

function PurposeSelector({
  visible,
  selected,
  wide,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: GatewayChoice | '';
  wide: boolean;
  onSelect: (value: GatewayChoice) => void;
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={[styles.modalRoot, wide && styles.modalRootWide]}>
        <Pressable accessibilityLabel="Close booking type selector" accessibilityRole="button" onPress={onClose} style={styles.modalBackdrop} />
        <View accessibilityViewIsModal style={[styles.selectorSheet, wide && styles.selectorSheetWide]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeading}>
            <View>
              <Text style={styles.sheetKicker}>Choose one</Text>
              <Text style={styles.sheetTitle}>What are you booking in for?</Text>
            </View>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={12} onPress={onClose}>
              <Text style={styles.closeButton}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            accessibilityRole="radiogroup"
            contentContainerStyle={styles.optionList}
            showsVerticalScrollIndicator={false}
            style={styles.optionScroll}
          >
            {PURPOSE_OPTIONS.map((option, index) => {
              const active = selected === option.value;
              return (
                <Pressable
                  accessibilityLabel={`${option.label}. ${option.priceGuide}. ${option.detail}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  key={option.value}
                  onPress={() => onSelect(option.value)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    active && styles.optionRowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.optionIndex, active && styles.optionTextActive]}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, active && styles.optionTextActive]}>{option.label}</Text>
                    <Text style={[styles.optionPrice, active && styles.optionPriceActive]}>{option.priceGuide}</Text>
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
  logo: {
    width: 142,
    height: 48,
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
  },
  accountMark: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.gold,
  },
  accountInitial: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  accountLabel: {
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
  qrCopy: {
    flex: 1,
    gap: spacing.xs,
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
    color: colors.mutedDark,
    fontSize: 10,
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
    justifyContent: 'flex-end',
  },
  modalRootWide: {
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
    maxHeight: '88%',
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
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
  },
  optionCopy: {
    flex: 1,
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
