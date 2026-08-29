import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatAustralianDateTime } from '@/lib/australian-date';
import { CUSTOMER_PREVIEW, type PreviewAlert } from '@/lib/customer-preview';
import { CUSTOMER_AUTH } from '@/lib/customer-auth';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import type { NotificationEventRow } from '@/lib/database.types';
import { useNotifications } from '@/lib/notifications';
import { ThemePreference, useThemePreference } from '@/lib/theme-preference';

const THEME_PREFERENCES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'bright', label: 'Bright' },
  { value: 'automatic', label: 'Automatic' },
];

const BOOKING_ALERT_IMAGE = require('../../../assets/images/dashboard/tile-my-bookings-blue-silver.jpg');

type AlertPreference = 'booking' | 'reminder' | 'vehicle';

export default function AlertsScreen() {
  const router = useRouter();
  const { compact, horizontalPadding } = useResponsiveLayout();
  const { setThemePreference, theme, themePreference } = useThemePreference();
  const auth = useCustomerAuth();
  const notifications = useNotifications();
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(CUSTOMER_PREVIEW.alerts.filter((alert) => alert.read).map((alert) => alert.id)),
  );
  const [preferences, setPreferences] = useState<Record<AlertPreference, boolean>>({ booking: true, reminder: true, vehicle: true });
  const [notificationFeedback, setNotificationFeedback] = useState('');

  const privateMode = CUSTOMER_AUTH.enabled;
  const signedIn = auth.status === 'signed_in';
  const staffMode = signedIn && auth.user?.email?.toLowerCase() === 'matt@psiperformance.com.au';
  const previewUnreadCount = useMemo(
    () => CUSTOMER_PREVIEW.alerts.filter((alert) => !readIds.has(alert.id)).length,
    [readIds],
  );
  const unreadCount = privateMode ? notifications.unreadCount : previewUnreadCount;

  const markRead = (id: string) => {
    setReadIds((current) => new Set([...current, id]));
  };

  const togglePreference = (key: AlertPreference) => {
    if (privateMode && signedIn) {
      const secureKey = key === 'booking' ? 'booking_updates_enabled' : key === 'reminder' ? 'booking_reminders_enabled' : 'workshop_alerts_enabled';
      const current = notifications.preferences?.[secureKey] ?? true;
      void notifications.setPreference(secureKey, !current);
      return;
    }
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  };

  const securePreference = (key: AlertPreference) => {
    if (!privateMode || !signedIn) return preferences[key];
    const secureKey = key === 'booking' ? 'booking_updates_enabled' : key === 'reminder' ? 'booking_reminders_enabled' : 'workshop_alerts_enabled';
    return notifications.preferences?.[secureKey] ?? true;
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
          <View accessibilityLabel={`${unreadCount} unread notifications`} style={styles.countBadge}>
            <Ionicons color={colors.ink} name="notifications" size={18} />
            <Text style={styles.countNumber}>{unreadCount}</Text>
          </View>
        </View>

        <View accessibilityRole="alert" style={styles.previewNotice}>
          <Text style={styles.previewNoticeTitle}>{privateMode ? 'Protected notification centre' : 'Notification preview'}</Text>
          <Text style={styles.previewNoticeCopy}>
            {privateMode
              ? signedIn
                ? 'Your own booking updates appear here. Native alerts, sound and app-icon badges activate only after you choose Enable device notifications below.'
                : 'Sign in to load your private booking updates and notification preferences. No other customer records are shown.'
              : 'These alerts and controls are synthetic and stay in memory. This public demo does not ask for notification permission, register a device or send messages.'}
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
                    <Text
                      adjustsFontSizeToFit
                      maxFontSizeMultiplier={1.2}
                      minimumFontScale={0.72}
                      numberOfLines={1}
                      style={[styles.themeModeOptionText, { color: selected ? theme.textInverse : theme.text }]}
                    >
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
            accessibilityLabel="Mark all notifications as read"
            accessibilityRole="button"
            onPress={() => privateMode ? void notifications.markAllRead() : setReadIds(new Set(CUSTOMER_PREVIEW.alerts.map((alert) => alert.id)))}
          >
            <Text style={styles.sectionAction}>Mark all read</Text>
          </Pressable>
        </View>
        <View style={styles.alertList}>
          {privateMode
            ? signedIn
              ? notifications.events.length
                ? notifications.events.map((event) => <SecureAlertCard event={event} key={event.id} onPress={() => void notifications.markRead(event.id)} />)
                : <View style={styles.emptyState}><Text style={styles.bodyCopy}>No private notifications yet.</Text></View>
              : <View style={styles.emptyState}><Text style={styles.bodyCopy}>Sign in through Account to see your protected notifications.</Text></View>
            : CUSTOMER_PREVIEW.alerts.map((alert) => (
              <AlertCard alert={alert} key={alert.id} onPress={() => markRead(alert.id)} read={readIds.has(alert.id)} />
            ))}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{privateMode ? 'Notification preferences' : 'What you could receive'}</Text>
          <Text style={styles.sectionMeta}>{privateMode ? 'Private account' : 'Demo controls'}</Text>
        </View>
        <View style={styles.preferenceCard}>
          <PreferenceRow
            copy="Confirmation, PSI review and approved date changes for your own visits."
            enabled={securePreference('booking')}
            icon="calendar-outline"
            label="Booking updates"
            onPress={() => togglePreference('booking')}
            previewOnly={!privateMode}
          />
          <PreferenceRow
            copy="Useful check-ins before an upcoming visit or service milestone."
            enabled={securePreference('reminder')}
            icon="time-outline"
            label="Visit reminders"
            onPress={() => togglePreference('reminder')}
            previewOnly={!privateMode}
          />
          {!privateMode || staffMode ? (
            <PreferenceRow
              copy={privateMode ? 'New customer requests ready for protected workshop review.' : 'A PSI-published dyno result, report or build-plan stage is ready.'}
              enabled={securePreference('vehicle')}
              icon={privateMode ? 'construct-outline' : 'car-sport-outline'}
              label={privateMode ? 'Workshop alerts' : 'Vehicle records'}
              onPress={() => togglePreference('vehicle')}
              previewOnly={!privateMode}
              last={!privateMode}
            />
          ) : null}
          {privateMode && signedIn ? (
            <PreferenceRow
              copy="Play the PSI notification sound when device alerts are permitted."
              enabled={notifications.preferences?.sound_enabled ?? true}
              icon="volume-high-outline"
              label="Notification sound"
              onPress={() => void notifications.setPreference('sound_enabled', !(notifications.preferences?.sound_enabled ?? true))}
              previewOnly={false}
              last
            />
          ) : null}
        </View>

        {privateMode && signedIn ? (
          <View style={styles.howItWorks}>
            <Ionicons color={colors.accent} name="phone-portrait-outline" size={30} />
            <View style={styles.howItWorksCopy}>
              <Text style={styles.howItWorksTitle}>Device alerts</Text>
              <Text style={styles.bodyCopy}>{notifications.pushStatus === 'ready'
                ? 'This device is registered for PSI banners, sound and app-icon badges.'
                : 'Enable notifications on this installed device. Your in-app notification centre remains available if device alerts are off.'}</Text>
            </View>
            {notificationFeedback ? <Text accessibilityRole="alert" style={styles.notificationFeedback}>{notificationFeedback}</Text> : null}
            <Pressable accessibilityRole="button" onPress={() => {
              setNotificationFeedback('');
              void notifications.enablePush()
                .then(() => setNotificationFeedback('Device notifications are enabled.'))
                .catch((error) => setNotificationFeedback(notificationErrorMessage(error)));
            }} style={({ pressed }) => [styles.openBookings, pressed && styles.pressed]}>
              <Text style={styles.openBookingsText}>{notifications.pushStatus === 'ready' ? 'Device notifications enabled' : 'Enable device notifications'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.howItWorks}>
          <Ionicons color={colors.accent} name="shield-checkmark-outline" size={30} />
          <View style={styles.howItWorksCopy}>
            <Text style={styles.howItWorksTitle}>Controlled by the customer</Text>
            <Text style={styles.bodyCopy}>
              {privateMode
                ? 'Choose how PSI keeps you updated. Booking changes come only from PSI—not another customer or a public calendar.'
                : 'A customer account can offer in-app, email and push preferences. Booking changes still come from PSI—not another customer or a public calendar.'}
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
        {alert.type === 'booking' ? (
          <Image accessible={false} resizeMode="cover" source={BOOKING_ALERT_IMAGE} style={styles.alertArtwork} />
        ) : (
          <Ionicons color={!read ? colors.ink : colors.accent} name={icon} size={23} />
        )}
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

function SecureAlertCard({ event, onPress }: { event: NotificationEventRow; onPress: () => void }) {
  const read = Boolean(event.read_at);
  const staffNotification = event.deep_link === '/staff';
  return (
    <Pressable
      accessibilityHint={read ? 'This notification is marked as read' : 'Marks this notification as read'}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.alertCard, !read && styles.alertCardUnread, pressed && styles.pressed]}
    >
      <View style={[styles.alertIcon, !read && styles.alertIconUnread]}>
        {staffNotification
          ? <Ionicons color={!read ? colors.ink : colors.accent} name="construct-outline" size={23} />
          : <Image accessible={false} resizeMode="cover" source={BOOKING_ALERT_IMAGE} style={styles.alertArtwork} />}
      </View>
      <View style={styles.alertCopy}>
        <View style={styles.alertTopline}>
          <Text style={styles.alertType}>{staffNotification ? 'Workshop' : 'Booking'}</Text>
          {!read ? <View accessibilityLabel="Unread" style={styles.unreadDot} /> : <Text style={styles.readLabel}>Read</Text>}
        </View>
        <Text style={styles.alertTitle}>{event.title}</Text>
        <Text style={styles.bodyCopy}>{event.body}</Text>
        <Text style={styles.eventDate}>{formatAustralianDateTime(event.created_at, true)}</Text>
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
  previewOnly,
}: {
  copy: string;
  enabled: boolean;
  icon: 'calendar-outline' | 'time-outline' | 'car-sport-outline' | 'construct-outline' | 'volume-high-outline';
  label: string;
  last?: boolean;
  onPress: () => void;
  previewOnly: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}, ${enabled ? 'on' : 'off'}${previewOnly ? ', demo only' : ''}`}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={onPress}
      style={({ pressed }) => [styles.preference, last && styles.preferenceLast, pressed && styles.pressed]}
    >
      <Ionicons color={colors.accent} name={icon} size={23} />
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
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 39, fontWeight: '900', letterSpacing: -1.5, lineHeight: 41, textTransform: 'uppercase' },
  titleCompact: { fontSize: 33, lineHeight: 35 },
  countBadge: { ...mobileFrame, minWidth: 62, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.silver, padding: spacing.sm },
  countNumber: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  previewNotice: { ...mobileFrame, gap: spacing.xs, backgroundColor: colors.silver, padding: spacing.md },
  previewNoticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  previewNoticeCopy: { color: '#464646', fontSize: 11, lineHeight: 17 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: .8, textTransform: 'uppercase' },
  sectionAction: { color: colors.accent, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  sectionMeta: { color: colors.muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  themePanel: { ...mobileFrame, gap: spacing.sm, backgroundColor: colors.panel, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line },
  themeModeControls: { flexDirection: 'row', gap: spacing.xs },
  themeModeOption: { minHeight: 36, minWidth: 82, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 4 },
  themeModeCheckboxRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  themeModeCheckbox: { width: 15, height: 15, borderRadius: 2.5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  themeModeCheckboxSelected: {},
  themeModeCheckboxInner: { width: 7, height: 7, borderRadius: 1, backgroundColor: colors.ink },
  themeModeOptionText: { flexShrink: 1, fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .2 },
  themeModeTitle: { color: colors.white, fontSize: 10, fontWeight: '900', letterSpacing: .9, textTransform: 'uppercase' },
  themeModeNotice: { fontSize: 10, lineHeight: 16, fontStyle: 'italic' },
  alertList: { gap: spacing.sm },
  emptyState: { ...mobileFrame, backgroundColor: colors.panel, padding: spacing.md },
  alertCard: { ...mobileFrame, minHeight: 116, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.panel, padding: spacing.md },
  alertCardUnread: { backgroundColor: colors.inkSoft },
  alertIcon: { ...mobileFrame, width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  alertIconUnread: { backgroundColor: colors.silver },
  alertArtwork: { width: '100%', height: '100%' },
  alertCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  alertTopline: { minHeight: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  alertType: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: .6, textTransform: 'uppercase' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  readLabel: { color: colors.mutedDark, fontSize: 8, fontWeight: '900', textTransform: 'uppercase' },
  alertTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  bodyCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  eventDate: { color: colors.mutedDark, fontSize: 9, marginTop: 2 },
  preferenceCard: { ...mobileFrame, backgroundColor: colors.panel, paddingHorizontal: spacing.md },
  preference: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: spacing.md },
  preferenceLast: { borderBottomWidth: 0 },
  preferenceCopy: { flex: 1, minWidth: 0, gap: 3 },
  preferenceTitle: { color: colors.white, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  preferenceText: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  switchTrack: { width: 46, height: 28, flexShrink: 0, justifyContent: 'center', borderWidth: 2, borderColor: colors.white, borderRadius: 14, backgroundColor: colors.ink, padding: 2 },
  switchTrackEnabled: { backgroundColor: colors.silver },
  switchThumb: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.muted },
  switchThumbEnabled: { alignSelf: 'flex-end', backgroundColor: colors.ink },
  howItWorks: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.lg },
  howItWorksCopy: { gap: spacing.xs },
  howItWorksTitle: { color: colors.white, fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  openBookings: { ...mobileFrame, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.ink, padding: spacing.md },
  openBookingsText: { color: colors.white, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  notificationFeedback: { color: colors.silver, fontSize: 10, fontWeight: '700', lineHeight: 16 },
  pressed: { opacity: .72 },
});

function notificationErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : '';
  if (detail.includes('NATIVE_DEVICE_REQUIRED')) return 'External push alerts require the installed iPhone or Android app. This web view still receives private in-app notifications.';
  if (detail.includes('PERMISSION_DENIED')) return 'Notification permission was not granted. You can enable PSI notifications later in your phone settings.';
  return 'This device could not be registered yet. Your in-app notification centre and email updates still work.';
}
