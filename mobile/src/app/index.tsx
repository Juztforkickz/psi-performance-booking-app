import { useRouter } from 'expo-router';
import {
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, PrimaryButton } from '@/components/ui';
import { colors, contact, spacing } from '@/constants/brand';
import type { BookingType } from '@/lib/booking';

const trustPoints = ['Hub dyno tuning', 'Logbook servicing', 'Performance builds', 'Diagnostics & repairs'];

export default function HomeScreen() {
  const router = useRouter();

  const startBooking = (type: BookingType) => {
    router.push({ pathname: '/booking', params: { type } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <ImageBackground
        source={require('../../assets/images/psi-hero-mobile.jpg')}
        resizeMode="cover"
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroShade} />
        <SafeAreaView edges={['top']} style={styles.heroSafe}>
          <View style={styles.header}>
            <Image
              accessibilityLabel="PSI Performance Garage"
              resizeMode="contain"
              source={require('../../assets/images/psi-logo.png')}
              style={styles.logo}
            />
            <Pressable
              accessibilityHint="Calls the PSI workshop"
              accessibilityRole="link"
              onPress={() => void Linking.openURL(contact.phoneUrl)}
              style={({ pressed }) => [styles.headerCall, pressed && styles.pressed]}
            >
              <Text style={styles.headerCallSmall}>Call workshop</Text>
              <Text style={styles.headerCallNumber}>{contact.phoneDisplay}</Text>
            </Pressable>
          </View>

          <View style={styles.heroCopy}>
            <Eyebrow>Pakenham · Victoria</Eyebrow>
            <Text style={styles.heroTitle}>Your car.{`\n`}Our craft.</Text>
            <Text style={styles.heroLead}>
              Precision tuning, trusted servicing and properly sorted performance cars.
            </Text>

            <View style={styles.heroActions}>
              <BookingLaunchCard
                detail="Logbook, maintenance & diagnostics"
                index="01"
                onPress={() => startBooking('service')}
                title="Vehicle service"
              />
              <BookingLaunchCard
                accent
                detail="Calibration, drivability & performance"
                index="02"
                onPress={() => startBooking('dyno')}
                title="Dyno tune"
              />
            </View>
          </View>

          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>Mon–Fri 8:30am–5pm</Text>
            <Text style={styles.heroFooterText}>Saturday by appointment</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>

      <View style={styles.trustStrip}>
        {trustPoints.map((point, index) => (
          <View key={point} style={styles.trustItem}>
            <Text style={styles.trustIndex}>0{index + 1}</Text>
            <Text style={styles.trustText}>{point}</Text>
          </View>
        ))}
      </View>

      <View style={styles.lightSection}>
        <View style={styles.maxWidth}>
          <Eyebrow dark>Workshop & performance</Eyebrow>
          <Text style={styles.sectionTitleDark}>Street manners.{`\n`}Track-bred thinking.</Text>
          <Text style={styles.sectionLeadDark}>
            From routine maintenance to carefully calibrated performance work, every job gets the same attention to detail.
          </Text>

          <View style={styles.serviceList}>
            <ServiceCard
              bullets={['Logbook, minor and major servicing', 'Diagnostics and mechanical fault-finding', 'Performance upgrades and repairs']}
              image={require('../../assets/images/psi-service.png')}
              onPress={() => startBooking('service')}
              title="Vehicle service"
            />
            <ServiceCard
              bullets={['Hub dyno tuning and testing', 'Australian, European and JDM vehicles', 'Existing tune and health reviews']}
              dark
              image={require('../../assets/images/psi-dyno-mobile.jpg')}
              onPress={() => startBooking('dyno')}
              title="Dyno tune"
            />
          </View>
        </View>
      </View>

      <View style={styles.whySection}>
        <View style={styles.maxWidth}>
          <Eyebrow>Why PSI</Eyebrow>
          <Text style={styles.sectionTitleLight}>Done properly.{`\n`}Explained clearly.</Text>
          <Text style={styles.sectionLeadLight}>
            Clear advice, measured results and workshop care built around reliability—not shortcuts.
          </Text>
          <View style={styles.whyGrid}>
            <ValuePoint index="01" title="Clear advice" copy="Understand what your car needs and why." />
            <ValuePoint index="02" title="Measured results" copy="Calibrate and diagnose with real data." />
            <ValuePoint index="03" title="No shortcuts" copy="Work built around reliability and detail." />
            <ValuePoint index="04" title="One workshop" copy="Servicing, mechanical work and tuning together." />
          </View>
        </View>
      </View>

      <View style={styles.contactSection}>
        <View style={styles.maxWidth}>
          <Eyebrow dark>PSI Performance Garage</Eyebrow>
          <Text style={styles.contactTitle}>Ready when you are.</Text>
          <PrimaryButton label="Start a booking request" onPress={() => startBooking('service')} />

          <View style={styles.contactLinks}>
            <ContactLink label="Call" onPress={() => void Linking.openURL(contact.phoneUrl)} value={contact.phoneDisplay} />
            <ContactLink label="Email" onPress={() => void Linking.openURL(contact.emailUrl)} value={contact.email} />
            <ContactLink label="Workshop" onPress={() => void Linking.openURL(contact.mapsUrl)} value={contact.address} />
          </View>

          <View accessibilityRole="none" style={styles.socialRow}>
            <SocialLink label="Facebook" url={contact.facebook} />
            <SocialLink label="Instagram" url={contact.instagram} />
            <SocialLink label="YouTube" url={contact.youtube} />
          </View>
          <Text style={styles.footerText}>© {new Date().getFullYear()} PSI Performance</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function BookingLaunchCard({
  index,
  title,
  detail,
  accent = false,
  onPress,
}: {
  index: string;
  title: string;
  detail: string;
  accent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Opens the booking request"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.launchCard, accent && styles.launchCardAccent, pressed && styles.pressed]}
    >
      <Text style={[styles.launchIndex, accent && styles.launchDark]}>{index}</Text>
      <View style={styles.launchCopy}>
        <Text style={[styles.launchTitle, accent && styles.launchDark]}>{title}</Text>
        <Text style={[styles.launchDetail, accent && styles.launchDetailDark]}>{detail}</Text>
      </View>
      <Text style={[styles.launchArrow, accent && styles.launchDark]}>→</Text>
    </Pressable>
  );
}

function ServiceCard({
  title,
  image,
  bullets,
  onPress,
  dark = false,
}: {
  title: string;
  image: number;
  bullets: string[];
  onPress: () => void;
  dark?: boolean;
}) {
  return (
    <View style={[styles.serviceCard, dark && styles.serviceCardDark]}>
      <Image resizeMode="cover" source={image} style={styles.serviceImage} />
      <View style={styles.serviceBody}>
        <Text style={[styles.serviceTitle, dark && styles.serviceTitleDark]}>{title}</Text>
        <View style={styles.bulletList}>
          {bullets.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <Text style={styles.bulletMark}>—</Text>
              <Text style={[styles.bulletText, dark && styles.bulletTextDark]}>{bullet}</Text>
            </View>
          ))}
        </View>
        <PrimaryButton label={`Request ${title.toLowerCase()}`} onPress={onPress} variant={dark ? 'gold' : 'outline'} />
      </View>
    </View>
  );
}

function ValuePoint({ index, title, copy }: { index: string; title: string; copy: string }) {
  return (
    <View style={styles.valuePoint}>
      <Text style={styles.valueIndex}>{index}</Text>
      <Text style={styles.valueTitle}>{title}</Text>
      <Text style={styles.valueCopy}>{copy}</Text>
    </View>
  );
}

function ContactLink({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.contactLink, pressed && styles.pressed]}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text style={styles.contactValue}>{value}</Text>
      <Text style={styles.contactArrow}>↗</Text>
    </Pressable>
  );
}

function SocialLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)}>
      <Text style={styles.socialLink}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  scrollContent: {
    backgroundColor: colors.ink,
  },
  hero: {
    minHeight: 760,
    backgroundColor: colors.ink,
  },
  heroImage: {
    opacity: 0.78,
  },
  heroShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  heroSafe: {
    minHeight: 760,
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.22)',
  },
  logo: {
    width: 148,
    height: 52,
  },
  headerCall: {
    alignItems: 'flex-end',
    paddingVertical: spacing.xs,
  },
  headerCallSmall: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  headerCallNumber: {
    marginTop: 3,
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  heroCopy: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  heroTitle: {
    marginTop: spacing.md,
    color: colors.white,
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: -3.2,
    lineHeight: 57,
    textTransform: 'uppercase',
  },
  heroLead: {
    maxWidth: 500,
    marginTop: spacing.lg,
    color: colors.cream,
    fontSize: 17,
    lineHeight: 26,
  },
  heroActions: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  launchCard: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 3,
    backgroundColor: 'rgba(5,5,5,0.76)',
    padding: spacing.md,
  },
  launchCardAccent: {
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  launchIndex: {
    alignSelf: 'flex-start',
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  launchCopy: {
    flex: 1,
    gap: 5,
  },
  launchTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
  },
  launchDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  launchDetailDark: {
    color: '#4A360C',
  },
  launchArrow: {
    color: colors.gold,
    fontSize: 24,
  },
  launchDark: {
    color: colors.ink,
  },
  heroFooter: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  heroFooterText: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  trustStrip: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.inkSoft,
    paddingVertical: spacing.md,
  },
  trustItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  trustIndex: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
  },
  trustText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  maxWidth: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  lightSection: {
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.lg,
    paddingVertical: 64,
  },
  sectionTitleDark: {
    marginTop: spacing.md,
    color: colors.ink,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.8,
    lineHeight: 40,
    textTransform: 'uppercase',
  },
  sectionLeadDark: {
    marginTop: spacing.lg,
    color: colors.mutedDark,
    fontSize: 16,
    lineHeight: 25,
  },
  serviceList: {
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  serviceCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.lineLight,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  serviceCardDark: {
    borderColor: colors.line,
    backgroundColor: colors.inkSoft,
  },
  serviceImage: {
    width: '100%',
    height: 230,
  },
  serviceBody: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  serviceTitle: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
    textTransform: 'uppercase',
  },
  serviceTitleDark: {
    color: colors.white,
  },
  bulletList: {
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bulletMark: {
    color: colors.goldDark,
    fontWeight: '900',
  },
  bulletText: {
    flex: 1,
    color: colors.mutedDark,
    fontSize: 14,
    lineHeight: 20,
  },
  bulletTextDark: {
    color: colors.muted,
  },
  whySection: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: 64,
  },
  sectionTitleLight: {
    marginTop: spacing.md,
    color: colors.white,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.8,
    lineHeight: 40,
    textTransform: 'uppercase',
  },
  sectionLeadLight: {
    marginTop: spacing.lg,
    color: colors.muted,
    fontSize: 16,
    lineHeight: 25,
  },
  whyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.line,
  },
  valuePoint: {
    width: '50%',
    minHeight: 170,
    gap: spacing.sm,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  valueIndex: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  valueTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  valueCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  contactSection: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingTop: 64,
    paddingBottom: 48,
  },
  contactTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    color: colors.ink,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 43,
    textTransform: 'uppercase',
  },
  contactLinks: {
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderColor: 'rgba(5,5,5,0.28)',
  },
  contactLink: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderColor: 'rgba(5,5,5,0.28)',
  },
  contactLabel: {
    width: 72,
    color: '#5B4210',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  contactValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  contactArrow: {
    color: colors.ink,
    fontSize: 20,
  },
  socialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  socialLink: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    textDecorationLine: 'underline',
    textTransform: 'uppercase',
  },
  footerText: {
    marginTop: spacing.xl,
    color: '#5B4210',
    fontSize: 11,
  },
  pressed: {
    opacity: 0.72,
  },
});
