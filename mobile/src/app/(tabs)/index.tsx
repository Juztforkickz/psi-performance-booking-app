import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
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
import { DashboardTile } from '@/components/dashboard-tile';
import { colors, contact, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { useCustomerPreview } from '@/lib/customer-preview-context';
import { PUBLIC_DEMO } from '@/lib/public-demo';
import { useThemePreference } from '@/lib/theme-preference';

const DASHBOARD_TILES = {
  garage: require('../../../assets/images/dashboard/tile-my-garage.jpg'),
  bookings: require('../../../assets/images/dashboard/tile-my-bookings.jpg'),
  bookAhead: require('../../../assets/images/dashboard/tile-book-ahead.jpg'),
  alerts: require('../../../assets/images/dashboard/tile-alerts.jpg'),
  dyno: require('../../../assets/images/dashboard/tile-from-attachment-scaled-960x1200.jpg'),
  reports: require('../../../assets/images/dashboard/tile-vehicle-reports.jpg'),
  planBuild: require('../../../assets/images/dashboard/tile-plan-build.jpg'),
} as const;

const PSI_PROMISES = [
  { index: '01', title: 'Protect', copy: 'Start with the health, safety and reliability of the complete vehicle.' },
  { index: '02', title: 'Build', copy: 'Plan the right upgrades around your goals and how you actually use the car.' },
  { index: '03', title: 'Together', copy: 'PSI listens, explains and shapes the project with you.' },
] as const;

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { prepareBookingVehicle, selectedVehicleId } = useCustomerPreview();
  const { compact, horizontalPadding, largeText, tablet, width } = useResponsiveLayout();
  const { activeTheme, theme } = useThemePreference();
  const [contactIconFontsLoaded] = useFonts({
    ionicons: require('../../../assets/fonts/Ionicons.ttf'),
    'material-community': require('../../../assets/fonts/MaterialCommunityIcons.ttf'),
  });
  const [bookingChooserOpen, setBookingChooserOpen] = useState(false);
  const threeColumns = tablet && width >= 780 && !largeText;

  const openBooking = (type: 'service' | 'dyno') => {
    setBookingChooserOpen(false);
    prepareBookingVehicle(selectedVehicleId);
    router.push({ pathname: '/booking', params: { type } });
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.screen }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          accessibilityRole="alert"
          style={[
            styles.demoBanner,
            compact && styles.compactFrame,
            { backgroundColor: activeTheme === 'dark' ? colors.cream : theme.surfaceRaised, borderColor: theme.frame },
          ]}
        >
          <Text style={[styles.demoTitle, { color: activeTheme === 'dark' ? colors.ink : theme.textInverse }]}>
            {PUBLIC_DEMO.label}
          </Text>
          <Text style={[styles.demoCopy, { color: activeTheme === 'dark' ? '#464646' : '#5E5A55' }]}>
            Explore the new customer-app direction. Accounts, photos, alerts and submissions remain preview-only.
          </Text>
        </View>

        <View style={styles.header}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="PSI Performance Garage"
            resizeMode="contain"
            source={require('../../../assets/images/psi-logo.png')}
            style={styles.logo}
          />
          <Pressable
            accessibilityHint="Opens passwordless customer account access"
            accessibilityLabel="Customer account"
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={({ pressed }) => [
              styles.accountButton,
              pressed && styles.pressed,
              {
                borderColor: theme.frame,
                backgroundColor: activeTheme === 'dark' ? colors.white : theme.frame,
              },
            ]}
          >
            <Ionicons color={activeTheme === 'dark' ? colors.ink : theme.textInverse} name="person" size={20} />
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: activeTheme === 'dark' ? colors.gold : theme.accent }]}>
            Good afternoon · Customer preview
          </Text>
          <Text maxFontSizeMultiplier={1.8} style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}>Your PSI app.</Text>
          <Text style={[styles.lead, { color: theme.textMuted }]}>Your vehicle, visits, results and next plan in one place.</Text>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your shortcuts</Text>
          <Text style={[styles.sectionHint, { color: activeTheme === 'dark' ? theme.accent : theme.accentAlt }]}>Tap a tile</Text>
        </View>
        <View style={styles.tileGrid}>
          <TileCell threeColumns={threeColumns}>
            <DashboardTile
              accessibilityHint="Opens vehicle selection, photos, results and history"
              image={DASHBOARD_TILES.garage}
              label="My Garage"
              onPress={() => router.push('/garage')}
            />
          </TileCell>
          <TileCell threeColumns={threeColumns}>
            <DashboardTile
              accessibilityHint="Opens your own upcoming and past visits"
              image={DASHBOARD_TILES.bookings}
              label="My Bookings"
              onPress={() => router.push('/bookings')}
            />
          </TileCell>
          <TileCell threeColumns={threeColumns}>
            <DashboardTile
              accessibilityHint="Choose a service or dyno request for a future date"
              image={DASHBOARD_TILES.bookAhead}
              label="Book Ahead"
              onPress={() => setBookingChooserOpen(true)}
            />
          </TileCell>
          <TileCell threeColumns={threeColumns}>
            <DashboardTile
              accessibilityHint="Opens booking updates and reminders"
              image={DASHBOARD_TILES.alerts}
              label="Settings & Notifications"
              onPress={() => router.push('/alerts')}
            />
          </TileCell>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Workshop</Text>
        </View>
        <View style={styles.tileGrid}>
          <TileCell threeColumns={threeColumns}>
            <DashboardTile
              accessibilityHint="Starts the existing approval-first dyno tuning request"
              image={DASHBOARD_TILES.dyno}
              label="Dyno Tuning"
              onPress={() => openBooking('dyno')}
            />
          </TileCell>
          <TileCell threeColumns={threeColumns}>
            <DashboardTile
              accessibilityHint="Opens the latest PSI-published vehicle and dyno reports"
              image={DASHBOARD_TILES.reports}
              label="Vehicle Reports"
              onPress={() => router.push({ pathname: '/garage', params: { section: 'dyno' } })}
            />
          </TileCell>
          <TileCell threeColumns={threeColumns}>
            <DashboardTile
              accessibilityHint="Open the build brief template and official PSI parts links"
              image={DASHBOARD_TILES.planBuild}
              label="Plan & Build"
              imageStyle={styles.planBuildTileImage}
              onPress={() => router.push('/parts')}
            />
          </TileCell>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>The PSI standard</Text>
        </View>
        <View style={[styles.standardPanel, { borderColor: theme.frame, backgroundColor: theme.surface }]}>
          <View style={styles.standardImageFrame}>
            <Image
              accessibilityLabel="PSI Performance Holden GTSR and Porsche outside the workshop"
              resizeMode="contain"
              source={require('../../../assets/images/psi-gtsr-porsche-clean.jpg')}
              style={styles.standardImage}
            />
            <Image
              accessible={false}
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={require('../../../assets/images/psi-logo.png')}
              style={styles.standardShedLogo}
            />
          </View>
        <View style={styles.promiseList}>
          {PSI_PROMISES.map((promise) => (
            <View key={promise.index} style={styles.promise}>
              <Text style={[styles.promiseIndex, { color: theme.accent }]}>{promise.index}</Text>
              <View style={styles.promiseCopy}>
                <Text style={[styles.promiseTitle, { color: theme.text }]}>{promise.title}</Text>
                <Text style={[styles.promiseText, { color: theme.textMuted }]}>{promise.copy}</Text>
              </View>
            </View>
          ))}
        </View>
        </View>

        <View
          style={[
            styles.contactPanel,
            { borderColor: theme.frame, backgroundColor: activeTheme === 'dark' ? colors.panel : theme.surface },
          ]}
        >
          <Text style={[styles.contactKicker, { color: theme.accent }]}>PSI Performance · Pakenham</Text>
          <Text style={[styles.contactTitle, { color: theme.text }]}>Need to speak with the workshop?</Text>
          <View style={styles.workshopFacts}>
            <WorkshopFact icon="time-outline" label="Shop hours" value={'Mon–Fri · 8:30am–5pm\nSaturday · By appointment'} />
            <WorkshopFact icon="location-outline" label="Workshop" value={contact.address} />
          </View>
          <View style={styles.contactActions}>
            <ContactAction
              icon="call"
              iconsLoaded={contactIconFontsLoaded}
              label="Call PSI"
              onPress={() => void Linking.openURL(contact.phoneUrl)}
              theme={theme}
            />
            <ContactAction
              icon="mail"
              iconsLoaded={contactIconFontsLoaded}
              label="Email"
              onPress={() => void Linking.openURL(contact.emailUrl)}
              theme={theme}
            />
            <ContactAction
              icon="map"
              iconsLoaded={contactIconFontsLoaded}
              label="Directions"
              onPress={() => void Linking.openURL(contact.mapsUrl)}
              theme={theme}
            />
            <ContactAction
              icon="instagram"
              iconsLoaded={contactIconFontsLoaded}
              label="Instagram"
              onPress={() => void Linking.openURL(contact.instagram)}
              theme={theme}
            />
            <ContactAction
              icon="facebook"
              iconsLoaded={contactIconFontsLoaded}
              label="Facebook"
              onPress={() => void Linking.openURL(contact.facebook)}
              theme={theme}
            />
            <ContactAction
              icon="website"
              iconsLoaded={contactIconFontsLoaded}
              label="Website"
              onPress={() => void Linking.openURL(contact.website)}
              theme={theme}
            />
          </View>
          <View
            accessibilityLabel="PSI Performance contact QR code"
            style={[
              styles.qrCard,
              compact && styles.qrCardCompact,
              { borderColor: theme.frame, backgroundColor: activeTheme === 'dark' ? colors.cream : theme.surfaceRaised },
            ]}
          >
            <View style={styles.qrImageFrame}>
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel="Scan to save PSI contact"
                resizeMode="contain"
                source={require('../../../assets/images/psi-contact-qr.png')}
                style={styles.qrImage}
              />
            </View>
            <View style={styles.qrCopy}>
              <Text style={[styles.qrKicker, { color: activeTheme === 'dark' ? colors.goldDark : '#4A3D2E' }]}>
                Quick contact
              </Text>
              <Text style={[styles.qrTitle, { color: activeTheme === 'dark' ? colors.ink : theme.text }]}>Scan to save PSI contact</Text>
              <Text style={[styles.qrDescription, { color: activeTheme === 'dark' ? '#57534C' : '#5D584F' }]}>
                Phone, email, workshop address and website in one scan.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>© {new Date().getFullYear()} PSI Performance™ · All rights reserved</Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={10}
            onPress={() => void Linking.openURL(contact.privacy)}
            style={({ pressed }) => [styles.footerLinkTarget, pressed && styles.pressed]}
          >
            <Text style={[styles.footerLink, { color: activeTheme === 'dark' ? theme.accent : theme.accentAlt }]}>Privacy policy ↗</Text>
          </Pressable>
        </View>

        <BrandRail />
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setBookingChooserOpen(false)}
        transparent
        visible={bookingChooserOpen}
      >
        <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.modalSafeArea}>
          <ScrollView contentContainerStyle={styles.modalBackdrop} showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityLabel="Close booking type chooser"
              accessibilityRole="button"
              onPress={() => setBookingChooserOpen(false)}
              style={StyleSheet.absoluteFill}
            />
            <View accessibilityViewIsModal style={styles.modalSheet}>
            <View style={styles.modalHeading}>
              <View style={styles.modalHeadingCopy}>
                <Text style={styles.eyebrow}>Book ahead</Text>
                <Text style={styles.modalTitle}>Where should PSI begin?</Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() => setBookingChooserOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Ionicons color={colors.white} name="close" size={24} />
              </Pressable>
            </View>
            <BookingChoice
              detail="Service, inspection and a clear vehicle report. From $423.50 including GST."
              label="Service & Report"
              onPress={() => openBooking('service')}
            />
            <BookingChoice
              detail="Hub dyno calibration, testing and measured results. From $649 including GST."
              label="Dyno Tuning"
              onPress={() => openBooking('dyno')}
            />
            <Text style={styles.modalNotice}>PSI reviews every preferred date before confirming work or requesting a deposit.</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function TileCell({
  children,
  threeColumns,
}: {
  children: React.ReactNode;
  threeColumns: boolean;
}) {
  return (
    <View style={[styles.tileCell, threeColumns && styles.tileCellThird]}>
      {children}
    </View>
  );
}

function BookingChoice({ detail, label, onPress }: { detail: string; label: string; onPress: () => void }) {
  const { theme } = useThemePreference();
  return (
    <Pressable
      accessibilityHint={detail}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.bookingChoice,
        { borderColor: theme.frame, backgroundColor: theme.surface },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.bookingChoiceCopy}>
        <Text style={[styles.bookingChoiceTitle, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.bookingChoiceDetail, { color: theme.textMuted }]}>{detail}</Text>
      </View>
      <Ionicons color={theme.accent} name="arrow-forward" size={22} />
    </Pressable>
  );
}

function ContactAction({
  icon,
  iconsLoaded,
  label,
  onPress,
  theme,
}: {
  icon: ContactIconName;
  iconsLoaded: boolean;
  label: string;
  onPress: () => void;
  theme: { frame: string; text: string; accent: string; surface: string };
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactAction,
        { borderColor: theme.frame, backgroundColor: theme.surface },
        pressed && styles.pressed,
      ]}
    >
      <ContactActionIcon accentColor={theme.accent} loaded={iconsLoaded} name={icon} />
      <Text style={[styles.contactActionText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

type ContactIconName = 'call' | 'facebook' | 'instagram' | 'mail' | 'map' | 'website';

const CONTACT_IONICON_NAMES = {
  call: 'call-outline',
  facebook: 'logo-facebook',
  instagram: 'logo-instagram',
  mail: 'mail-outline',
  website: 'globe-outline',
} as const satisfies Record<Exclude<ContactIconName, 'map'>, keyof typeof Ionicons.glyphMap>;

function ContactActionIcon({
  accentColor,
  loaded,
  name,
}: {
  accentColor: string;
  loaded: boolean;
  name: ContactIconName;
}) {
  const hiddenFromAccessibility = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  };

  return (
    <View {...hiddenFromAccessibility} style={styles.contactIconCanvas}>
      {!loaded ? null : name === 'map' ? (
        <MaterialCommunityIcons color={accentColor} name="google-maps" size={24} />
      ) : (
        <Ionicons color={accentColor} name={CONTACT_IONICON_NAMES[name]} size={23} />
      )}
    </View>
  );
}

function WorkshopFact({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { theme } = useThemePreference();

  return (
    <View style={[styles.workshopFact, { borderTopColor: theme.border }]}>
      <Ionicons color={theme.accent} name={icon} size={20} />
      <View style={styles.workshopFactCopy}>
        <Text style={[styles.workshopFactLabel, { color: theme.accent }]}>{label}</Text>
        <Text style={[styles.workshopFactValue, { color: theme.textInverse }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  scroll: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  demoBanner: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.cream, padding: spacing.md },
  compactFrame: { padding: spacing.sm },
  demoTitle: { color: colors.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  demoCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  logo: { width: 126, height: 48 },
  accountButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, borderRadius: 23, backgroundColor: colors.white },
  intro: { gap: spacing.xs },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.35, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 43, fontWeight: '900', letterSpacing: -1.8, lineHeight: 45, textTransform: 'uppercase' },
  titleCompact: { fontSize: 35, letterSpacing: -1.2, lineHeight: 38 },
  lead: { maxWidth: 620, color: colors.muted, fontSize: 14, lineHeight: 21 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase' },
  sectionHint: { color: colors.gold, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tileCell: { width: '47%', flexGrow: 0, flexShrink: 1, minWidth: 0, maxWidth: 360 },
  tileCellThird: { width: '30%', minWidth: 180 },
  standardPanel: { ...mobileFrame, overflow: 'hidden', backgroundColor: colors.panel },
  standardImageFrame: { width: '100%', aspectRatio: 1746 / 901, overflow: 'hidden', backgroundColor: colors.inkSoft },
  standardImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  standardShedLogo: { position: 'absolute', top: '7%', left: '51%', width: '24%', height: '18%', opacity: .58 },
  promiseList: { paddingHorizontal: spacing.md },
  promise: { minHeight: 94, flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: spacing.md },
  promiseIndex: { color: colors.gold, fontSize: 10, fontWeight: '900' },
  promiseCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  promiseTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  promiseText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  contactPanel: { ...mobileFrame, gap: spacing.sm, backgroundColor: colors.panel, padding: spacing.lg },
  contactKicker: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  contactTitle: { color: colors.white, fontSize: 20, fontWeight: '900', textTransform: 'uppercase' },
  workshopFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  workshopFact: { minWidth: 180, flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  workshopFactCopy: { flex: 1, minWidth: 0, gap: 2 },
  workshopFactLabel: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  workshopFactValue: { color: colors.cream, fontSize: 11, lineHeight: 17 },
  contactActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  contactAction: { minHeight: 50, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, ...mobileFrame, backgroundColor: colors.ink, paddingHorizontal: spacing.md },
  contactIconCanvas: { width: 22, height: 22, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  contactActionText: { color: colors.white, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  qrCard: { ...mobileFrame, flexDirection: 'row', alignItems: 'center', gap: spacing.md, overflow: 'hidden', backgroundColor: colors.cream, padding: spacing.md },
  qrCardCompact: { alignItems: 'stretch', flexDirection: 'column' },
  qrImageFrame: { width: 118, aspectRatio: 1, flexShrink: 0, overflow: 'hidden', backgroundColor: colors.white },
  qrImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  qrCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  qrKicker: { color: colors.goldDark, fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  qrTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  qrDescription: { color: '#57534C', fontSize: 10, lineHeight: 16 },
  footer: { minHeight: 64, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  footerText: { color: colors.muted, fontSize: 10 },
  footerLinkTarget: { minHeight: 44, justifyContent: 'center' },
  footerLink: { color: colors.gold, fontSize: 10, fontWeight: '900', textDecorationLine: 'underline', textTransform: 'uppercase' },
  modalSafeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,.82)' },
  modalBackdrop: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  modalSheet: { width: '100%', maxWidth: 560, gap: spacing.md, ...mobileFrame, backgroundColor: colors.inkSoft, padding: spacing.lg },
  planBuildTileImage: {},
  modalHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  modalHeadingCopy: { flex: 1, gap: spacing.xs },
  modalTitle: { color: colors.white, fontSize: 24, fontWeight: '900', lineHeight: 28, textTransform: 'uppercase' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', ...mobileFrame, backgroundColor: colors.ink },
  bookingChoice: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...mobileFrame, backgroundColor: colors.panel, padding: spacing.md },
  bookingChoiceCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  bookingChoiceTitle: { color: colors.white, fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  bookingChoiceDetail: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  modalNotice: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  pressed: { opacity: .72 },
});
