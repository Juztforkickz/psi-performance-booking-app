import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, contact, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { useCustomerAccount } from '@/lib/customer-account-context';
import {
  PREVIEW_CUSTOMER_CARS_FOR_SALE,
  formatAud,
  formatKilometres,
  loadCustomerCarsForSale,
  type CustomerCarListing,
} from '@/lib/customer-cars-for-sale';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useNotifications } from '@/lib/notifications';
import { useThemePreference } from '@/lib/theme-preference';

const LISTING_ART = require('../../assets/images/dashboard/tile-customer-cars-for-sale-blue-silver.jpg');

export default function CustomerCarsForSaleScreen() {
  const router = useRouter();
  const { account } = useCustomerAccount();
  const { compact, horizontalPadding, largeText, width } = useResponsiveLayout();
  const { activeTheme, theme } = useThemePreference();
  const notifications = useNotifications();
  const [message, setMessage] = useState('');
  const [listings, setListings] = useState<readonly CustomerCarListing[]>(() => !CUSTOMER_AUTH.enabled ? PREVIEW_CUSTOMER_CARS_FOR_SALE : []);
  const [loading, setLoading] = useState(CUSTOMER_AUTH.enabled);
  const preview = !CUSTOMER_AUTH.enabled;
  const twoColumns = width >= 760 && !largeText;
  const primaryVehicle = account?.vehicles.find((vehicle) => vehicle.is_primary) ?? account?.vehicles[0];

  useEffect(() => {
    if (preview) return;
    let active = true;
    void loadCustomerCarsForSale()
      .then((result) => { if (active) setListings(result); })
      .catch(() => { if (active) setMessage('Listings could not be refreshed. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [preview]);

  const openEmail = async (subject: string, body: string) => {
    setMessage('');
    const url = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      setMessage(`Email ${contact.email} or call ${contact.phoneDisplay}.`);
    }
  };

  const requestListing = () => {
    const vehicleLine = primaryVehicle
      ? `${primaryVehicle.year} ${primaryVehicle.make} ${primaryVehicle.model} · ${primaryVehicle.registration}`
      : 'Vehicle: ';
    void openEmail(
      'Customer car listing request',
      `Hi PSI,\n\nI would like to discuss listing my car in Customer Cars for Sale.\n\n${vehicleLine}\nExpected price: \nCurrent kilometres: \nBest contact number: \n\nI understand PSI will confirm the vehicle, wording, photos and my permission before publishing anything.`,
    );
  };

  const enquire = (listing: CustomerCarListing) => {
    void openEmail(
      `Enquiry · ${listing.title} · ${listing.registration}`,
      `Hi PSI,\n\nI am interested in the ${listing.title} listed in Customer Cars for Sale.\n\nReference: ${listing.registration}\nMy name: \nBest contact number: \nQuestions: `,
    );
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.screen }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { borderColor: theme.frame }, pressed && styles.pressed]}>
            <Ionicons color={theme.text} name="arrow-back" size={22} />
          </Pressable>
          <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={[styles.headerTitle, { color: theme.text }]}>Customer Cars for Sale</Text>
          <View style={styles.headerBalance} />
        </View>

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: activeTheme === 'dark' ? theme.accent : theme.accentAlt }]}>PSI-cared-for vehicles</Text>
          <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}>Customer Cars for Sale</Text>
          <Text style={[styles.lead, { color: theme.textMuted }]}>Vehicles PSI customers have asked us to share with the community.</Text>
        </View>

        <View style={[styles.notice, { backgroundColor: theme.surfaceRaised, borderColor: theme.frame }]}>
          <Ionicons color={theme.accent} name="shield-checkmark-outline" size={24} />
          <Text style={[styles.noticeText, { color: theme.textMuted }]}>A listing appears only after the owner gives permission and PSI checks the vehicle identity. PSI workshop history is shared only where authorised. Buyers should confirm the sale terms and arrange their own inspection.</Text>
        </View>

        {!preview && notifications.preferences ? <View style={[styles.alertSettings, { backgroundColor: theme.surface, borderColor: theme.frame }]}>
          <View style={styles.alertSettingsCopy}>
            <Text style={[styles.alertSettingsTitle, { color: theme.text }]}>New listing alerts</Text>
            <Text style={[styles.noticeText, { color: theme.textMuted }]}>Choose app banners with sound, and optional email notices when PSI publishes a customer car.</Text>
          </View>
          <AlertToggle
            enabled={notifications.preferences?.car_sale_alerts_enabled ?? true}
            label="App banners and sound"
            onPress={() => void notifications.setPreference('car_sale_alerts_enabled', !(notifications.preferences?.car_sale_alerts_enabled ?? true))}
          />
          <AlertToggle
            enabled={notifications.preferences?.car_sale_emails_enabled ?? false}
            label="Email notices"
            onPress={() => void notifications.setPreference('car_sale_emails_enabled', !(notifications.preferences?.car_sale_emails_enabled ?? false))}
          />
          <Text style={[styles.emailConsent, { color: theme.textMuted }]}>Email notices are optional. Every email explains how to unsubscribe.</Text>
        </View> : null}

        {preview ? <Text style={[styles.previewNote, { color: theme.accent }]}>Preview data only · this vehicle is not for sale.</Text> : null}

        {loading ? <ActivityIndicator color={theme.accent} size="large" /> : listings.length > 0 ? (
          <View style={[styles.list, twoColumns && styles.listWide]}>
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} onEnquire={enquire} wide={twoColumns} />
            ))}
          </View>
        ) : (
          <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.frame }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceRaised }]}><Ionicons color={theme.accent} name="car-sport-outline" size={34} /></View>
            <Text maxFontSizeMultiplier={1.3} style={[styles.emptyTitle, { color: theme.text }]}>No approved listings right now</Text>
            <Text style={[styles.emptyCopy, { color: theme.textMuted }]}>New owner-approved customer vehicles will appear here when they become available.</Text>
          </View>
        )}

        <View style={[styles.sellerCard, { backgroundColor: theme.surface, borderColor: theme.frame }]}>
          <Text style={[styles.sellerEyebrow, { color: theme.accent }]}>Selling your PSI-worked car?</Text>
          <Text maxFontSizeMultiplier={1.3} style={[styles.sellerTitle, { color: theme.text }]}>Ask PSI to review a listing</Text>
          <Text style={[styles.sellerCopy, { color: theme.textMuted }]}>Send the vehicle, expected price and current kilometres. PSI will contact you before any details or photos are published.</Text>
          <Pressable accessibilityHint="Opens an email draft to PSI" accessibilityLabel="Ask PSI to list my car" accessibilityRole="button" onPress={requestListing} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
            <Ionicons color={colors.ink} name="mail-outline" size={20} />
            <Text style={styles.primaryButtonText}>Ask PSI to list my car</Text>
          </Pressable>
          <Pressable accessibilityLabel="Call PSI about a vehicle listing" accessibilityRole="button" onPress={() => void Linking.openURL(contact.phoneUrl)} style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.frame }, pressed && styles.pressed]}>
            <Ionicons color={theme.accent} name="call-outline" size={20} />
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Call {contact.phoneDisplay}</Text>
          </Pressable>
        </View>

        {message ? <Text accessibilityRole="alert" style={[styles.feedback, { color: theme.accent }]}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function AlertToggle({ enabled, label, onPress }: { enabled: boolean; label: string; onPress: () => void }) {
  const { theme } = useThemePreference();
  return <Pressable accessibilityLabel={`${label}, ${enabled ? 'on' : 'off'}`} accessibilityRole="switch" accessibilityState={{ checked: enabled }} onPress={onPress} style={({ pressed }) => [styles.alertToggle, { borderColor: theme.border }, pressed && styles.pressed]}>
    <Text style={[styles.alertToggleLabel, { color: theme.text }]}>{label}</Text>
    <View style={[styles.switchTrack, { backgroundColor: enabled ? theme.accent : theme.surfaceRaised }]}><View style={[styles.switchThumb, enabled && styles.switchThumbEnabled]} /></View>
  </Pressable>;
}

function ListingCard({ listing, onEnquire, wide }: { listing: CustomerCarListing; onEnquire: (listing: CustomerCarListing) => void; wide: boolean }) {
  const { theme } = useThemePreference();
  return (
    <View style={[styles.card, wide && styles.cardWide, { backgroundColor: theme.surface, borderColor: theme.frame }]}>
      <View style={styles.artFrame}><Image accessibilityLabel={`${listing.title} listing artwork`} resizeMode="cover" source={LISTING_ART} style={styles.art} /></View>
      <View style={styles.cardBody}>
        <View style={styles.statusRow}>
          <Text style={[styles.status, { color: theme.accent }]}>{listing.status === 'available' ? 'Available' : 'Under offer'}</Text>
          <Text style={[styles.reference, { color: theme.textMuted }]}>{listing.registration}</Text>
        </View>
        <Text style={[styles.carTitle, { color: theme.text }]}>{listing.title}</Text>
        <Text style={[styles.price, { color: theme.accent }]}>{formatAud(listing.askingPriceCents)}</Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>{formatKilometres(listing.kilometres)} · {listing.transmission}</Text>
        <Text style={[styles.summary, { color: theme.textMuted }]}>{listing.summary}</Text>
        <View style={styles.highlights}>{listing.highlights.map((item) => <View key={item} style={styles.highlight}><Ionicons color={theme.accent} name="checkmark-circle-outline" size={17} /><Text style={[styles.highlightText, { color: theme.text }]}>{item}</Text></View>)}</View>
        <Pressable accessibilityLabel={`Enquire about ${listing.title}`} accessibilityRole="button" onPress={() => onEnquire(listing)} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>Enquire through PSI</Text>
          <Ionicons color={colors.ink} name="arrow-forward" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, paddingBottom: spacing.sm },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  headerTitle: { flex: 1, fontSize: 14, fontWeight: '900', letterSpacing: .7, textAlign: 'center', textTransform: 'uppercase' },
  headerBalance: { width: 44 },
  hero: { gap: spacing.xs },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { maxWidth: 700, fontSize: 38, fontWeight: '900', letterSpacing: -1.3, lineHeight: 41, textTransform: 'uppercase' },
  titleCompact: { fontSize: 30, lineHeight: 33 },
  lead: { maxWidth: 660, fontSize: 14, lineHeight: 21 },
  notice: { ...mobileFrame, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md },
  noticeText: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 17 },
  alertSettings: { ...mobileFrame, gap: spacing.sm, padding: spacing.md },
  alertSettingsCopy: { gap: spacing.xs },
  alertSettingsTitle: { fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  alertToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderTopWidth: 1, paddingTop: spacing.sm },
  alertToggleLabel: { flex: 1, fontSize: 12, fontWeight: '800' },
  switchTrack: { width: 44, height: 26, borderRadius: 13, padding: 3 },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  switchThumbEnabled: { alignSelf: 'flex-end' },
  emailConsent: { fontSize: 10, lineHeight: 16 },
  previewNote: { fontSize: 10, fontWeight: '900', letterSpacing: .7, textTransform: 'uppercase' },
  list: { gap: spacing.md },
  listWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { ...mobileFrame, overflow: 'hidden' },
  cardWide: { width: '48%', flexGrow: 1, minWidth: 300 },
  artFrame: { height: 210, overflow: 'hidden', backgroundColor: colors.ink },
  art: { width: '100%', height: '100%', transform: [{ scale: 1.05 }, { translateY: 12 }] },
  cardBody: { gap: spacing.sm, padding: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  status: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  reference: { fontSize: 10, fontWeight: '800' },
  carTitle: { fontSize: 20, fontWeight: '900', lineHeight: 24, textTransform: 'uppercase' },
  price: { fontSize: 24, fontWeight: '900' },
  meta: { fontSize: 11, fontWeight: '800' },
  summary: { fontSize: 11, lineHeight: 18 },
  highlights: { gap: spacing.xs },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  highlightText: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 17 },
  empty: { ...mobileFrame, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl + spacing.xs },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { width: '100%', fontSize: 18, fontWeight: '900', lineHeight: 24, textAlign: 'center', textTransform: 'uppercase' },
  emptyCopy: { maxWidth: 430, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  sellerCard: { ...mobileFrame, gap: spacing.sm, padding: spacing.lg },
  sellerEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  sellerTitle: { width: '100%', flexShrink: 1, fontSize: 21, fontWeight: '900', lineHeight: 28, textTransform: 'uppercase' },
  sellerCopy: { fontSize: 11, lineHeight: 18 },
  primaryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  primaryButtonText: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: .6, textAlign: 'center', textTransform: 'uppercase' },
  secondaryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 2, paddingHorizontal: spacing.md },
  secondaryButtonText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  feedback: { fontSize: 11, fontWeight: '800', lineHeight: 17, textAlign: 'center' },
  pressed: { opacity: .72 },
});
