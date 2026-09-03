import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { formatAustralianDateTime } from '@/lib/australian-date';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import type { PsiEventRow } from '@/lib/database.types';
import { loadPublishedPsiEvents } from '@/lib/psi-events';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { useThemePreference } from '@/lib/theme-preference';

export default function PsiEventsScreen() {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { compact, horizontalPadding } = useResponsiveLayout();
  const { activeTheme, theme } = useThemePreference();
  const [events, setEvents] = useState<PsiEventRow[]>([]);
  const [referenceNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (auth.status !== 'signed_in') {
      setEvents([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setEvents(await loadPublishedPsiEvents());
    } catch {
      setError('PSI Events could not be refreshed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [auth.status]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh, auth.sessionRevision]);

  const upcomingEvents = useMemo(
    () => events.filter((event) => new Date(event.starts_at).getTime() >= referenceNow - 24 * 60 * 60 * 1000),
    [events, referenceNow],
  );

  const scheduleReminder = async (event: PsiEventRow) => {
    setMessage('');
    if (REVIEW_ENVIRONMENT.enabled) { setMessage('Device reminders are disabled for fictional demonstration events.'); return; }
    if (Platform.OS === 'web') {
      setMessage('Event reminders are available in the installed iPhone or Android app.');
      return;
    }
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) {
      setMessage('Allow notifications in your phone settings to use event reminders.');
      return;
    }
    const startsAt = new Date(event.starts_at);
    const reminderAt = new Date(startsAt.getTime() - event.reminder_minutes_before * 60 * 1000);
    if (Number.isNaN(reminderAt.getTime()) || reminderAt <= new Date()) {
      setMessage('This event is too close to schedule its reminder.');
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        body: `${event.title} starts in ${event.reminder_minutes_before} minutes.`,
        data: { eventId: event.id, url: '/events' },
        sound: 'default',
        subtitle: event.location ?? undefined,
        title: 'PSI Event reminder',
      },
      trigger: { date: reminderAt, type: Notifications.SchedulableTriggerInputTypes.DATE },
    });
    setMessage(`Reminder set for ${event.title}.`);
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.screen }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { borderColor: theme.frame }, pressed && styles.pressed]}>
            <Text style={[styles.backIcon, { color: theme.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>PSI Events</Text>
          <View style={styles.headerBalance} />
        </View>

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: activeTheme === 'dark' ? theme.accent : theme.accentAlt }]}>Workshop calendar</Text>
          <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}>PSI Events</Text>
          <Text style={[styles.lead, { color: theme.textMuted }]}>Upcoming PSI events and reminders.</Text>
        </View>

        {auth.status !== 'signed_in' ? (
          <View style={styles.callout}>
            <Image source={require('../../assets/images/psi-logo.png')} style={styles.logoMini} />
            <Text style={styles.calloutTitle}>Sign in to see PSI Events</Text>
            <Text style={styles.calloutCopy}>Sign in to view event details and set reminders.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Open account</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Upcoming events</Text>
              <Pressable accessibilityLabel="Refresh PSI Events" accessibilityRole="button" disabled={loading} onPress={() => void refresh()} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
                {loading ? <ActivityIndicator color={colors.accent} size="small" /> : <Ionicons color={colors.accent} name="refresh" size={18} />}
              </Pressable>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {!loading && upcomingEvents.length === 0 ? <Text style={styles.emptyState}>No events are currently scheduled. New PSI events will appear here automatically.</Text> : null}
            <View style={styles.eventsList}>
              {upcomingEvents.map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventHeading}>
                    <Ionicons color={colors.accent} name="flag" size={18} />
                    <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
                  </View>
                  <Text style={[styles.eventTime, { color: colors.accent }]}>{formatAustralianDateTime(event.starts_at)}</Text>
                  {event.location ? <Text style={[styles.eventLocation, { color: theme.text }]}>{event.location}</Text> : null}
                  {event.description ? <Text style={[styles.eventDescription, { color: theme.textMuted }]}>{event.description}</Text> : null}
                  <Pressable accessibilityLabel={`Set reminder for ${event.title}`} accessibilityRole="button" onPress={() => void scheduleReminder(event)} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
                    <Text style={[styles.linkButtonText, { color: theme.accent }]}>Set {event.reminder_minutes_before} min reminder</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            {message ? <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: theme.accent }]}>{message}</Text> : null}
          </View>
        )}

        <View style={styles.callout}>
          <Image source={require('../../assets/images/psi-logo.png')} style={styles.logoMini} />
          <Text style={styles.calloutTitle}>Event updates</Text>
          <Text style={styles.calloutCopy}>New or changed events appear here and can notify your device.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, paddingBottom: spacing.sm },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  backIcon: { fontSize: 22, fontWeight: '900' },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '900', letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase' },
  headerBalance: { width: 44 },
  hero: { gap: spacing.xs },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { fontSize: 38, fontWeight: '900', letterSpacing: -1.3, lineHeight: 40, textTransform: 'uppercase' },
  titleCompact: { fontSize: 31, lineHeight: 34 },
  lead: { maxWidth: 660, fontSize: 14, lineHeight: 21 },
  sectionCard: { ...mobileFrame, gap: spacing.md, backgroundColor: colors.inkSoft, padding: spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  refreshButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  eventsList: { gap: spacing.sm },
  eventCard: { ...mobileFrame, borderColor: colors.line, backgroundColor: colors.panel, padding: spacing.md, gap: spacing.xs },
  eventHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eventTitle: { flex: 1, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  eventTime: { fontSize: 12, fontWeight: '900' },
  eventLocation: { fontSize: 12, fontWeight: '800' },
  eventDescription: { fontSize: 11, lineHeight: 17 },
  linkButton: { alignSelf: 'flex-start', minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  linkButtonText: { fontWeight: '900', textTransform: 'uppercase', fontSize: 9 },
  emptyState: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  callout: { ...mobileFrame, gap: spacing.sm, backgroundColor: colors.inkSoft, padding: spacing.md },
  logoMini: { width: 54, height: 20 },
  calloutTitle: { color: colors.white, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  calloutCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  secondaryButton: { minHeight: 44, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  secondaryButtonText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: colors.white },
  feedback: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  error: { color: colors.danger, fontSize: 11, fontWeight: '800', lineHeight: 17 },
  pressed: { opacity: 0.72 },
});
