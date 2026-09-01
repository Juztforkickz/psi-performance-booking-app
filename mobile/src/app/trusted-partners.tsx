import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ImageSourcePropType,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { TRUSTED_PARTNERS, type TrustedPartner } from '@/lib/trusted-partners';
import { useThemePreference } from '@/lib/theme-preference';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const PARTNER_LOGOS: Readonly<Record<string, ImageSourcePropType>> = {
  'dark-side-film': require('../../assets/images/partners/dark-side-film.jpg'),
  'race-wires': require('../../assets/images/partners/race-wires.jpg'),
  'elite-autobody': require('../../assets/images/partners/elite-autobody.jpg'),
  'kng-tow': require('../../assets/images/partners/kng-tow.jpg'),
  'eye-candy': require('../../assets/images/partners/eye-candy.jpg'),
  'luxe-interiors': require('../../assets/images/partners/luxe-interiors.jpg'),
  'elite-detailing': require('../../assets/images/partners/elite-detailing.jpg'),
};

const PARTNER_LOGO_SCALES: Readonly<Record<string, number>> = {
  'dark-side-film': 1.54,
  'race-wires': 1.43,
  'elite-autobody': 1.28,
  'kng-tow': 1.5,
  'eye-candy': 1.29,
  'luxe-interiors': 1.26,
  'elite-detailing': 1.22,
};

export default function TrustedPartnersScreen() {
  const router = useRouter();
  const { compact, horizontalPadding, largeText } = useResponsiveLayout();
  const { activeTheme, theme } = useThemePreference();
  const [linkError, setLinkError] = useState('');

  const openLink = async (url: string) => {
    setLinkError('');
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError('That contact link could not be opened on this device. Please use the displayed details instead.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.screen }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, { borderColor: theme.frame }, pressed && styles.pressed]}
          >
            <Ionicons color={theme.text} name="arrow-back" size={22} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Trusted Partners</Text>
          <View style={styles.headerBalance} />
        </View>

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: activeTheme === 'dark' ? theme.accent : theme.accentAlt }]}>PSI referral directory</Text>
          <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}>Trusted specialists.</Text>
          <Text style={[styles.lead, { color: theme.textMuted }]}>
            Independent automotive businesses PSI may recommend when your vehicle needs specialist work outside our workshop.
          </Text>
        </View>

        <View style={[styles.notice, { backgroundColor: theme.surfaceRaised, borderColor: theme.frame }]}>
          <Ionicons color={theme.accent} name="information-circle-outline" size={23} />
          <Text style={[styles.noticeText, { color: theme.textMuted }]}>
            Contact partners directly to confirm services, availability and pricing. Referrals are not PSI bookings or quotes.
          </Text>
        </View>

        {linkError ? (
          <View accessibilityRole="alert" style={[styles.errorNotice, { borderColor: theme.warning }]}>
            <Text style={[styles.errorText, { color: theme.warning }]}>{linkError}</Text>
          </View>
        ) : null}

        <View style={styles.partnerList}>
          {TRUSTED_PARTNERS.map((partner, index) => (
            <PartnerCard
              compact={compact || largeText}
              index={index + 1}
              key={partner.id}
              logo={PARTNER_LOGOS[partner.id]}
              onOpenLink={openLink}
              partner={partner}
            />
          ))}
        </View>

        <Text style={[styles.footerNote, { color: theme.textMuted }]}>
          Details may change; confirm directly with each business.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PartnerCard({
  compact,
  index,
  logo,
  onOpenLink,
  partner,
}: {
  compact: boolean;
  index: number;
  logo: ImageSourcePropType;
  onOpenLink: (url: string) => Promise<void>;
  partner: TrustedPartner;
}) {
  const { theme } = useThemePreference();
  const [showPhonePicker, setShowPhonePicker] = useState(false);
  const actions: { icon: IoniconName; label: string; url: string }[] = [];
  const handleCallPress = async () => {
    if (!partner.phoneUrl) {
      return;
    }

    if (!partner.secondaryPhoneUrl) {
      await onOpenLink(partner.phoneUrl);
      return;
    }

    setShowPhonePicker(true);
  };

  const callSelectedNumber = (url: string) => {
    setShowPhonePicker(false);
    void onOpenLink(url);
  };

  if (partner.phoneUrl) actions.push({ icon: 'call-outline', label: 'Call', url: partner.phoneUrl });
  if (partner.emailUrl) actions.push({ icon: 'mail-outline', label: 'Email', url: partner.emailUrl });
  if (partner.websiteUrl) actions.push({ icon: 'globe-outline', label: 'Website', url: partner.websiteUrl });
  if (partner.instagramUrl) actions.push({ icon: 'logo-instagram', label: 'Instagram', url: partner.instagramUrl });

  return (
    <View style={[styles.partnerCard, { backgroundColor: theme.surface, borderColor: theme.frame }]}>
      <View style={[styles.partnerTop, compact && styles.partnerTopCompact]}>
        <View style={[styles.logoFrame, { borderColor: theme.frame }]}>
          <Image
            accessibilityLabel={`${partner.businessName} logo`}
            resizeMode="cover"
            source={logo}
            style={[
              styles.logo,
              { transform: [{ scale: PARTNER_LOGO_SCALES[partner.id] ?? 1 }] },
            ]}
          />
        </View>
        <View style={styles.partnerHeading}>
          <Text style={[styles.partnerIndex, { color: theme.accent }]}>{String(index).padStart(2, '0')}</Text>
          <Text style={[styles.category, { color: theme.accent }]}>{partner.category}</Text>
          <Text style={[styles.businessName, { color: theme.text }]}>{partner.businessName}</Text>
        </View>
      </View>

      <Text style={[styles.summary, { color: theme.textMuted }]}>{partner.summary}</Text>

      <View style={[styles.details, { borderTopColor: theme.border }]}>
        {partner.address ? <PartnerDetail icon="location-outline" value={partner.address} /> : null}
        {partner.phoneDisplay ? <PartnerDetail icon="call-outline" value={partner.phoneDisplay} /> : null}
        {partner.secondaryPhoneDisplay ? (
          <PartnerDetail icon="call-outline" value={partner.secondaryPhoneDisplay} />
        ) : null}
        {partner.email ? <PartnerDetail icon="mail-outline" value={partner.email} /> : null}
      </View>

      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            accessibilityLabel={`${action.label} ${partner.businessName}`}
            accessibilityRole="link"
            key={action.label}
            onPress={() => {
              if (action.label === 'Call') {
                void handleCallPress();
                return;
              }

              void onOpenLink(action.url);
            }}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: theme.surfaceRaised, borderColor: theme.frame },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons color={theme.accent} name={action.icon} size={19} />
            <Text style={[styles.actionText, { color: theme.text }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowPhonePicker(false)}
        transparent
        visible={showPhonePicker}
      >
        <View style={styles.phonePickerBackdrop}>
          <View
            accessibilityLabel={`Select a number to call ${partner.businessName}`}
            accessibilityRole="alert"
            style={[styles.phonePicker, { backgroundColor: theme.surface, borderColor: theme.frame }]}
          >
            <Text style={[styles.phonePickerEyebrow, { color: theme.accent }]}>Select a number</Text>
            <Text style={[styles.phonePickerTitle, { color: theme.text }]}>Call {partner.businessName}</Text>

            <View style={styles.phonePickerActions}>
              {partner.phoneUrl && partner.phoneDisplay ? (
                <Pressable
                  accessibilityLabel={`Call ${partner.phoneDisplay}`}
                  accessibilityRole="button"
                  onPress={() => callSelectedNumber(partner.phoneUrl ?? '')}
                  style={({ pressed }) => [
                    styles.phonePickerButton,
                    { backgroundColor: theme.surfaceRaised, borderColor: theme.frame },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons color={theme.accent} name="call-outline" size={20} />
                  <Text style={[styles.phonePickerNumber, { color: theme.text }]}>{partner.phoneDisplay}</Text>
                </Pressable>
              ) : null}

              {partner.secondaryPhoneUrl && partner.secondaryPhoneDisplay ? (
                <Pressable
                  accessibilityLabel={`Call ${partner.secondaryPhoneDisplay}`}
                  accessibilityRole="button"
                  onPress={() => callSelectedNumber(partner.secondaryPhoneUrl ?? '')}
                  style={({ pressed }) => [
                    styles.phonePickerButton,
                    { backgroundColor: theme.surfaceRaised, borderColor: theme.frame },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons color={theme.accent} name="call-outline" size={20} />
                  <Text style={[styles.phonePickerNumber, { color: theme.text }]}>{partner.secondaryPhoneDisplay}</Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              accessibilityLabel="Cancel calling"
              accessibilityRole="button"
              onPress={() => setShowPhonePicker(false)}
              style={({ pressed }) => [styles.phonePickerCancel, pressed && styles.pressed]}
            >
              <Text style={[styles.phonePickerCancelText, { color: theme.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PartnerDetail({ icon, value }: { icon: IoniconName; value: string }) {
  const { theme } = useThemePreference();
  return (
    <View style={styles.detailRow}>
      <Ionicons color={theme.accent} name={icon} size={17} />
      <Text selectable style={[styles.detailText, { color: theme.textMuted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, paddingBottom: spacing.sm },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '900', letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase' },
  headerBalance: { width: 44 },
  hero: { gap: spacing.xs },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { fontSize: 38, fontWeight: '900', letterSpacing: -1.3, lineHeight: 41, textTransform: 'uppercase' },
  titleCompact: { fontSize: 31, lineHeight: 34 },
  lead: { maxWidth: 660, fontSize: 14, lineHeight: 21 },
  notice: { ...mobileFrame, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md },
  noticeText: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 17 },
  errorNotice: { borderWidth: 2, padding: spacing.md },
  errorText: { fontSize: 11, lineHeight: 17 },
  partnerList: { gap: spacing.md },
  partnerCard: { ...mobileFrame, gap: spacing.md, padding: spacing.md },
  partnerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  partnerTopCompact: { alignItems: 'flex-start' },
  logoFrame: { width: 92, height: 92, flexShrink: 0, overflow: 'hidden', borderWidth: 2, borderRadius: 46, backgroundColor: colors.ink },
  logo: { width: '100%', height: '100%' },
  partnerHeading: { flex: 1, minWidth: 0, gap: 3 },
  partnerIndex: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  category: { fontSize: 10, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  businessName: { fontSize: 19, fontWeight: '900', lineHeight: 23, textTransform: 'uppercase' },
  summary: { fontSize: 12, lineHeight: 18 },
  details: { gap: spacing.xs, borderTopWidth: 1, paddingTop: spacing.sm },
  detailRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailText: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  action: { minWidth: 116, minHeight: 46, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 2, paddingHorizontal: spacing.sm },
  actionText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  phonePickerBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, .72)', padding: spacing.lg },
  phonePicker: { ...mobileFrame, width: '100%', maxWidth: 420, gap: spacing.sm, borderWidth: 2, padding: spacing.lg },
  phonePickerEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  phonePickerTitle: { fontSize: 21, fontWeight: '900', lineHeight: 25, textTransform: 'uppercase' },
  phonePickerActions: { gap: spacing.sm, paddingTop: spacing.xs },
  phonePickerButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 2, paddingHorizontal: spacing.md },
  phonePickerNumber: { fontSize: 15, fontWeight: '900' },
  phonePickerCancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  phonePickerCancelText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  footerNote: { fontSize: 10, lineHeight: 16, paddingBottom: spacing.md },
  pressed: { opacity: .72 },
});
