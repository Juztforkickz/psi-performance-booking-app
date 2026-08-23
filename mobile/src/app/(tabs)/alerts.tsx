import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { CUSTOMER_PREVIEW, type PreviewAlert } from '@/lib/customer-preview';
import { ThemePreference, useThemePreference } from '@/lib/theme-preference';

const THEME_PREFERENCES: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'dark', label: 'Dark' },
  { value: 'bright', label: 'Bright' },
  { value: 'automatic', label: 'Automatic' },
];

type AlertPreference = 'booking' | 'reminder' | 'vehicle';

export default function AlertsScreen() {
  const router = useRouter();
  const { compact, horizontalPadding } = useResponsiveLayout();
  const { setThemePreference, theme, themePreference } = useThemePreference();
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(CUSTOMER_PREVIEW.alerts.filter((alert) => alert.read).map((alert) => alert.id)),
  );
  const [preferences, setPreferences] = useState<Record<AlertPreference, boolean>>({ booking: true, reminder: true, vehicle: true });

  const unreadCount = useMemo(
    () => CUSTOMER_PREVIEW.alerts.filter((alert) => !readIds.has(alert.id)).length,
    [readIds],
  );

  const markRead = (id: string) => {
    setReadIds((current) => new Set([...current, id]));
  };

  const togglePreference = (key: AlertPreference) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Settings & Notifications</Text>
            <Text maxFontSizeMultiplier={1.8} style={[styles.title, compact && styles.titleCompact]}>Settings & Notifications</Text>
          </View>
          <View accessibilityLabel={`${unreadCount} unread example alerts`} style={styles.countBadge}>
            <Ionicons color={colors.ink} name="notifications" size={18} />
            <Text style={styles.countNumber}>{unreadCount}</Text>
          </View>
        </View>

        <View accessibilityRole="alert" style={styles.previewNotice}>
          <Text style={styles.previewNoticeTitle}>Notification preview</Text>
          <Text style={styles.previewNoticeCopy}>
            These alerts and controls are synthetic and stay in memory. This demo does not ask for notification permission, register a device or send messages.
          </Text>
        </View>

        <View style={[styles.themePanel, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          <Text style={[styles.themeModeTitle, { color: theme.text }]}>Theme preference</Text>
          <View style={styles.themeModeControls}>
            {THEME_PREFERENCES.map((item) => {
              const selected = themePreference === item.value;
              return (
                <Pressable
                  accessibilityHint="Switch app theme"
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={item.value}
                  onPress={() => setThemePreference(item.value)}
                  style={({ pressed }) => [
                    styles.themeModeOption,
                    {
                      backgroundColor: selected ? theme.accent : theme.surfaceRaised,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    pointerEvents="none"
                    style={styles.themeModeCheckboxRow}
                  >
                    <View
                      style={[
                        styles.themeModeCheckbox,
                        selected && styles.themeModeCheckboxSelected,
                          { borderColor: selected ? theme.textInverse : theme.text },
                      ]}
                    >
                      {selected ? <View style={[styles.themeModeCheckboxInner, { backgroundColor: theme.textInverse }]} /> : null}
                    </View>
                    <Text style={[styles.themeModeOptionText, { color: selected ? theme.textInverse : theme.text }]}>
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {themePreference === 'automatic' ? (
            <Text style={[styles.themeModeNotice, { color: theme.textMuted }]}>
              Automatic follows your device setting for dark and bright.
            </Text>
          ) : null}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Latest</Text>
          <Pressable
            accessibilityLabel="Mark all example alerts as read"
            accessibilityRole="button"
            onPress={() => setReadIds(new Set(CUSTOMER_PREVIEW.alerts.map((alert) => alert.id)))}
          >
            <Text style={styles.sectionAction}>Mark all read</Text>
          </Pressable>
        </View>
        <View style={styles.alertList}>
          {CUSTOMER_PREVIEW.alerts.map((alert) => (
            <AlertCard
              alert={alert}
              key={alert.id}
              onPress={() => markRead(alert.id)}
              read={readIds.has(alert.id)}
            />
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>What you could receive</Text>
          <Text style={styles.sectionMeta}>Demo controls</Text>
        </View>
        <View style={styles.preferenceCard}>
          <PreferenceRow
            copy="Confirmation, PSI review and approved date changes for your own visits."
            enabled={preferences.booking}
            icon="calendar-outline"
            label="Booking updates"
            onPress={() => togglePreference('booking')}
          />
          <PreferenceRow
            copy="Useful check-ins before an upcoming visit or service milestone."
            enabled={preferences.reminder}
            icon="time-outline"
            label="Visit reminders"
            onPress={() => togglePreference('reminder')}
          />
          <PreferenceRow
            copy="A PSI-published dyno result, report or build-plan stage is ready."
            enabled={preferences.vehicle}
            icon="car-sport-outline"
            label="Vehicle records"
            onPress={() => togglePreference('vehicle')}
            last
          />
        </View>

        <View style={styles.howItWorks}>
          <Ionicons color={colors.gold} name="shield-checkmark-outline" size={30} />
          <View style={styles.howItWorksCopy}>
            <Text style={styles.howItWorksTitle}>Controlled by the customer</Text>
            <Text style={styles.bodyCopy}>
              A finished version can offer in-app, email and push preferences. Booking changes still come from PSI—not another customer or a public calendar.
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Open example bookings"
            accessibilityRole="button"
            onPress={() => router.push('/bookings')}
            style={({ pressed }) => [styles.openBookings, pressed && styles.pressed]}
          >
            <Text style={styles.openBookingsText}>Open bookings</Text>
            <Ionicons color={colors.white} name="arrow-forward" size={18} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AlertCard({
  alert,
  onPress,
  read,
}: {
  alert: PreviewAlert;
  onPress: () => void;
  read: boolean;
}) {
  const icon = alert.type === 'booking'
    ? 'calendar-outline'
    : alert.type === 'reminder'
      ? 'time-outline'
      : 'car-sport-outline';

  return (
    <Pressable
      accessibilityHint={read ? 'This alert is marked as read' : 'Marks this example alert as read'}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.alertCard, !read && styles.alertCardUnread, pressed && styles.pressed]}
    >
      <View style={[styles.alertIcon, !read && styles.alertIconUnread]}>
        <Ionicons color={!read ? colors.ink : colors.gold} name={icon} size={23} />
      </View>
      <View style={styles.alertCopy}>
        <View style={styles.alertTopline}>
          <Text style={styles.alertType}>{alert.type}</Text>
          {!read ? <View accessibilityLabel="Unread" style={styles.unreadDot} /> : <Text style={styles.readLabel}>Read</Text>}
        </View>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.bodyCopy}>{alert.message}</Text>
      </View>
    </Pressable>
  );
}

function PreferenceRow({
  copy,
  enabled,
  icon,
  label,
  last = false,
  onPress,
}: {
  copy: string;
  enabled: boolean;
  icon: 'calendar-outline' | 'time-outline' | 'car-sport-outline';
  label: string;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${enabled ? 'on' : 'off'}, demo only`}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={onPress}
      style={({ pressed }) => [styles.preference, last && styles.preferenceLast, pressed && styles.pressed]}
    >
      <Ionicons color={colors.gold} name={icon} size={23} />
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceTitle}>{label}</Text>
        <Text style={styles.preferenceText}>{copy}</Text>
      </View>
      <View style={[styles.switchTrack, enabled && styles.switchTrackEnabled]}>
        <View style={[styles.switchThumb, enabled && styles.switchThumbEnabled]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  scroll: { width: '100%', maxWidth: 880, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 39, fontWeight: '900', letterSpacing: -1.5, lineHeight: 41, textTransform: 'uppercase' },
  titleCompact: { fontSize: 33, lineHeight: 35 },
  countBadge: { ...mobileFrame, minWidth: 62, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.cream, padding: spacing.sm },
  countNumber: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  previewNotice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.cream, padding: spacing.md },
  previewNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  previewNoticeCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  sectionAction: { color: colors.gold, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  sectionMeta: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  themePanel: { ...mobileFrame, gap: spacing.sm, backgroundColor: colors.panel, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line },
  themeModeControls: { flexDirection: 'row', gap: spacing.xs },
  themeModeOption: { minHeight: 36, minWidth: 82, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm },
  themeModeCheckboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  themeModeCheckbox: { width: 15, height: 15, borderRadius: 2.5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  themeModeCheckboxSelected: {},
  themeModeCheckboxInner: { width: 7, height: 7, borderRadius: 1, backgroundColor: colors.ink },
  themeModeOptionText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .4 },
  themeModeTitle: { color: colors.white, fontSize: 10, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase' },
  themeModeNotice: { fontSize: 10, lineHeight: 16, fontStyle: 'italic' },
  alertList: { gap: spacing.sm },
  alertCard: { ...mobileFrame, minHeight: 116, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  alertCardUnread: { backgroundColor: colors.inkSoft },
  alertIcon: { ...mobileFrame, width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  alertIconUnread: { backgroundColor: colors.cream },
  alertCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  alertTopline: { minHeight: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  alertType: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: .6, textTransform: 'uppercase' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.gold },
  readLabel: { color: colors.mutedDark, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  alertTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  bodyCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  preferenceCard: { ...mobileFrame, backgroundColor: colors.panel, paddingHorizontal: spacing.md },
  preference: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing.md },
  preferenceLast: { borderBottomWidth: 0 },
  preferenceCopy: { flex: 1, minWidth: 0, gap: 3 },
  preferenceTitle: { color: colors.white, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  preferenceText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  switchTrack: { width: 46, height: 28, flexShrink: 0, justifyContent: 'center', borderWidth: 2, borderColor: colors.white, borderRadius: 14, backgroundColor: colors.ink, padding: 2 },
  switchTrackEnabled: { backgroundColor: colors.cream },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.muted },
  switchThumbEnabled: { alignSelf: 'flex-end', backgroundColor: colors.ink },
  howItWorks: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  howItWorksCopy: { gap: spacing.xs },
  howItWorksTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  openBookings: { ...mobileFrame, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.ink, padding: spacing.md },
  openBookingsText: { color: colors.white, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  pressed: { opacity: .72 },
});
