import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { useThemePreference } from '@/lib/theme-preference';

type PsiEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  reminderMinutesBefore: number;
};

const EVENT_STORAGE_KEY = 'psi-events/list/v1';

export default function PsiEventsScreen() {
  const router = useRouter();
  const { compact, horizontalPadding } = useResponsiveLayout();
  const { activeTheme, theme } = useThemePreference();

  const [events, setEvents] = useState<PsiEvent[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStart, setNewStart] = useState<Date>(new Date());
  const [referenceNow] = useState(() => Date.now());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(EVENT_STORAGE_KEY).then((raw) => {
      if (!active || !raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const next = parsed.filter(
        (item): item is PsiEvent =>
          typeof item?.id === 'string' &&
          typeof item?.title === 'string' &&
          typeof item?.description === 'string' &&
          typeof item?.startsAt === 'string'
      );
      setEvents(next.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    }).catch(() => {
      // Keep local event cache failure non-blocking.
    });
    return () => {
      active = false;
    };
  }, []);

  const saveEvents = useCallback(async (nextEvents: PsiEvent[]) => {
    setEvents(nextEvents);
    try {
      await AsyncStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(nextEvents));
    } catch {
      // persistence failures should not block use of the screen.
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (Platform.OS === 'web') return false;
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }

    const request = await Notifications.requestPermissionsAsync();
    return request.granted;
  };

  const scheduleReminder = async (event: PsiEvent) => {
    if (Platform.OS === 'web') return;
    const enabled = await requestNotificationPermission();
    if (!enabled) return;

    const trigger = new Date(event.startsAt);
    if (Number.isNaN(trigger.getTime())) return;
    const withPadding = new Date(trigger.getTime() - event.reminderMinutesBefore * 60 * 1000);
    if (withPadding <= new Date()) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          body: `${event.title} starts in ${event.reminderMinutesBefore} minutes at ${new Intl.DateTimeFormat('en-AU', {
            hour: 'numeric',
            minute: '2-digit',
          }).format(trigger)}.`,
          title: 'PSI Event reminder',
          subtitle: event.title,
          data: { eventId: event.id },
        },
        trigger: {
          date: withPadding,
          type: Notifications.SchedulableTriggerInputTypes.DATE,
        },
      });
    } catch {
      // Silent fallback: reminders may be blocked by platform settings.
    }
  };

  const addEvent = async () => {
    if (!newTitle.trim()) {
      setMessage('Please add an event title before saving.');
      return;
    }

    const event: PsiEvent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      title: newTitle.trim(),
      description: newDescription.trim(),
      startsAt: newStart.toISOString(),
      reminderMinutesBefore: 90,
    };

    const next = [event, ...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    await saveEvents(next);
    setMessage('Event added.');
    setNewTitle('');
    setNewDescription('');
    void scheduleReminder(event);
  };

  const clearEvents = async () => {
    await saveEvents([]);
    setMessage('All PSI Events cleared from this device.');
  };

  const upcomingEvents = events.filter((event) => new Date(event.startsAt).getTime() >= referenceNow - 24 * 60 * 60 * 1000);

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.screen }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, { borderColor: theme.frame }, pressed && styles.pressed]}
          >
            <Text style={[styles.backIcon, { color: theme.text }]}>←</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>PSI Events</Text>
          <View style={styles.headerBalance} />
        </View>

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: activeTheme === 'dark' ? theme.accent : theme.accentAlt }]}>Events center</Text>
          <Text style={[styles.title, compact && styles.titleCompact, { color: theme.text }]}>PSI Events</Text>
          <Text style={[styles.lead, { color: theme.textMuted }]}>
            Add workshop dates and times in one place. Reminder notifications are local to this device for now.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Add an event</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={setNewTitle}
            placeholder="Event title"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, { color: theme.text, borderColor: theme.frame, backgroundColor: theme.surfaceRaised }]}
            value={newTitle}
          />
          <TextInput
            multiline
            onChangeText={setNewDescription}
            placeholder="Description (optional)"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              styles.textArea,
              { color: theme.text, borderColor: theme.frame, backgroundColor: theme.surfaceRaised },
            ]}
            value={newDescription}
          />

          <View style={styles.timeRow}>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={({ pressed }) => [styles.timeButton, pressed && styles.pressed, { borderColor: theme.accent, backgroundColor: theme.surface }]}
            >
              <Text style={[styles.timeButtonText, { color: theme.text }]}>
                {new Intl.DateTimeFormat('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  weekday: 'short',
                }).format(newStart)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={({ pressed }) => [styles.timeButton, pressed && styles.pressed, { borderColor: theme.accent, backgroundColor: theme.surface }]}
            >
              <Text style={[styles.timeButtonText, { color: theme.text }]}>
                {new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' }).format(newStart)}
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add this PSI event"
            onPress={() => void addEvent()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.primaryButtonText}>Add to events</Text>
          </Pressable>

          {message ? <Text style={[styles.feedback, { color: theme.accent }]}>{message}</Text> : null}

          {showDatePicker ? (
            <DateTimePicker
              value={newStart}
              mode="date"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              onChange={(_, selected) => {
                if (selected) setNewStart(selected);
                setShowDatePicker(false);
              }}
            />
          ) : null}

          {showTimePicker ? (
            <DateTimePicker
              value={newStart}
              mode="time"
              is24Hour={false}
              onChange={(_, selected) => {
                if (selected) {
                  const merged = new Date(newStart);
                  merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                  setNewStart(merged);
                }
                setShowTimePicker(false);
              }}
            />
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Upcoming events</Text>
          {upcomingEvents.length === 0 ? (
            <Text style={styles.emptyState}>No events are currently scheduled.</Text>
          ) : (
            <View style={styles.eventsList}>
              {upcomingEvents.map((event) => {
                const start = new Date(event.startsAt);
                return (
                  <View key={event.id} style={styles.eventCard}>
                    <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
                    <Text style={[styles.eventTime, { color: colors.accent }]}>
                      {new Intl.DateTimeFormat('en-AU', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(start)}
                    </Text>
                    <Text style={[styles.eventDescription, { color: theme.textMuted }]}>
                      {event.description || 'No description.'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        void scheduleReminder(event);
                        setMessage(`Reminder queued for ${event.title}`);
                      }}
                      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
                    >
                      <Text style={[styles.linkButtonText, { color: theme.accent }]}>Set 90 min reminder</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.callout}>
          <Image source={require('../../assets/images/psi-logo.png')} style={styles.logoMini} />
          <Text style={styles.calloutTitle}>Notifications are local-only right now</Text>
          <Text style={styles.calloutCopy}>
            These events are saved on this device only and are useful for test rollout. We can connect them to admin-managed alerts when you confirm the source list.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void clearEvents()}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Clear all events</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
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
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { ...mobileFrame, minHeight: 46, borderWidth: 2, borderRadius: 4, paddingHorizontal: spacing.sm, color: colors.white, fontSize: 14 },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.sm },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeButton: { ...mobileFrame, flex: 1, minHeight: 46, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  timeButtonText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  primaryButtonText: { color: colors.ink, fontWeight: '900', textTransform: 'uppercase' },
  secondaryButton: { minHeight: 44, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  secondaryButtonText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: colors.white },
  feedback: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  eventsList: { gap: spacing.sm },
  eventCard: { ...mobileFrame, borderColor: colors.line, backgroundColor: colors.panel, padding: spacing.md, gap: spacing.xs },
  eventTitle: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  eventTime: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  eventDescription: { fontSize: 11, lineHeight: 17 },
  linkButton: { alignSelf: 'flex-start', minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  linkButtonText: { fontWeight: '900', textTransform: 'uppercase', fontSize: 9 },
  emptyState: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  callout: { ...mobileFrame, gap: spacing.sm, backgroundColor: colors.inkSoft, padding: spacing.md },
  logoMini: { width: 54, height: 20 },
  calloutTitle: { color: colors.white, fontSize: 17, fontWeight: '900', textTransform: 'uppercase' },
  calloutCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.72 },
});
