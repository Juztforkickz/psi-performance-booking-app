import { useRouter } from 'expo-router';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, PrimaryButton } from '@/components/ui';
import { colors, contact, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function PartsScreen() {
  const router = useRouter();
  const { compact, horizontalPadding, short } = useResponsiveLayout();
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
          <Text maxFontSizeMultiplier={1.3} style={styles.backArrow}>←</Text>
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
        <View style={styles.heroNumber}>
          <Text maxFontSizeMultiplier={1.4} style={styles.heroNumberText}>03</Text>
        </View>
        <Eyebrow>PSI Performance parts</Eyebrow>
        <Text maxFontSizeMultiplier={2} style={[styles.title, compact && styles.titleCompact]}>The right parts.{`\n`}Properly selected.</Text>
        <Text style={styles.lead}>
          PSI’s dedicated parts catalogue is the next stage of this app. It will focus on workshop-selected performance hardware—not a generic parts feed.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusKicker}>Page reserved</Text>
          <Text style={styles.statusTitle}>Parts store in development</Text>
          <Text style={styles.statusCopy}>
            No order or payment is taken on this preview page. Speak with the workshop now for fitment advice, availability and pricing.
          </Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label={`Call ${contact.phoneDisplay}`} onPress={() => void Linking.openURL(contact.phoneUrl)} />
          <PrimaryButton label="Email parts enquiry" onPress={() => void Linking.openURL(contact.emailUrl)} variant="outline" />
        </View>

        <View style={styles.capabilities}>
          <Capability index="01" title="Workshop matched" copy="Parts considered in the context of the complete vehicle and its goals." />
          <Capability index="02" title="Fitment advice" copy="Confirm compatibility before committing to the wrong component." />
          <Capability index="03" title="Install & tune" copy="Plan supply, installation and calibration together with PSI." />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Capability({ index, title, copy }: { index: string; title: string; copy: string }) {
  return (
    <View style={styles.capability}>
      <Text maxFontSizeMultiplier={1.5} style={styles.capabilityIndex}>{index}</Text>
      <View style={styles.capabilityCopy}>
        <Text style={styles.capabilityTitle}>{title}</Text>
        <Text style={styles.capabilityText}>{copy}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: {
    width: '100%',
    maxWidth: 760,
    minHeight: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerCompact: { minHeight: 62 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backArrow: { color: colors.gold, fontSize: 22 },
  backText: { color: colors.white, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  logo: { width: 106, height: 38 },
  scroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: 64,
  },
  scrollShort: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  heroNumber: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderRadius: 26,
    backgroundColor: colors.gold,
  },
  heroNumberText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  title: {
    marginTop: spacing.md,
    color: colors.white,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 44,
    textTransform: 'uppercase',
  },
  titleCompact: { fontSize: 34, letterSpacing: -1.3, lineHeight: 37 },
  lead: { maxWidth: 620, marginTop: spacing.lg, color: colors.muted, fontSize: 16, lineHeight: 25 },
  statusCard: { gap: spacing.sm, marginTop: spacing.xl, borderLeftWidth: 3, borderLeftColor: colors.gold, backgroundColor: colors.panel, padding: spacing.lg },
  statusKicker: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  statusTitle: { color: colors.white, fontSize: 20, fontWeight: '900', textTransform: 'uppercase' },
  statusCopy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  capabilities: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.line },
  capability: { minHeight: 100, flexDirection: 'row', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing.lg },
  capabilityIndex: { color: colors.gold, fontSize: 10, fontWeight: '900' },
  capabilityCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  capabilityTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  capabilityText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  pressed: { opacity: 0.72 },
});
