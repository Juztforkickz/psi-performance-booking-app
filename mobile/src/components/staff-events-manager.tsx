import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { formatAustralianDateTime } from '@/lib/australian-date';
import type { PsiEventRow } from '@/lib/database.types';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { cancelPsiEvent, createPsiEvent, loadStaffPsiEvents, publishPsiEvent, updatePsiEvent } from '@/lib/psi-events';

function initialStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

export function StaffEventsManager() {
  const [events, setEvents] = useState<PsiEventRow[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState(initialStart);
  const [editingId, setEditingId] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await loadStaffPsiEvents());
    } catch {
      setFeedback({ error: true, text: 'PSI Events could not be loaded. Staff access remains protected.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const create = async (publish: boolean) => {
    if (busyAction) return;
    setBusyAction(publish ? 'create-publish' : 'create-draft');
    setFeedback(null);
    try {
      await createPsiEvent({ description, location, startsAt: startsAt.toISOString(), title }, publish);
      resetForm();
      setFeedback({ error: false, text: publish ? 'Event published and customer alerts queued.' : 'Draft event saved privately.' });
      await refresh();
    } catch (error) {
      setFeedback({ error: true, text: eventErrorMessage(error) });
    } finally {
      setBusyAction('');
    }
  };

  const saveChanges = async () => {
    if (!editingId || busyAction) return;
    setBusyAction('save-edit');
    setFeedback(null);
    try {
      await updatePsiEvent(editingId, { description, location, startsAt: startsAt.toISOString(), title });
      resetForm();
      setFeedback({ error: false, text: 'Event details saved. Published-event alerts were queued when required.' });
      await refresh();
    } catch (error) {
      setFeedback({ error: true, text: eventErrorMessage(error) });
    } finally {
      setBusyAction('');
    }
  };

  const edit = (event: PsiEventRow) => {
    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description ?? '');
    setLocation(event.location ?? '');
    setStartsAt(new Date(event.starts_at));
    setFeedback({ error: false, text: `Editing ${event.title}.` });
  };

  const resetForm = () => {
    setEditingId('');
    setTitle('');
    setDescription('');
    setLocation('');
    setStartsAt(initialStart());
  };

  const changeStatus = async (event: PsiEventRow, action: 'cancel' | 'publish') => {
    if (busyAction) return;
    setBusyAction(`${action}:${event.id}`);
    setFeedback(null);
    try {
      if (action === 'publish') await publishPsiEvent(event.id);
      else await cancelPsiEvent(event.id);
      setFeedback({ error: false, text: action === 'publish' ? 'Event published and customer alerts queued.' : 'Event cancelled and customer alerts queued.' });
      await refresh();
    } catch {
      setFeedback({ error: true, text: 'The event was not changed. Check the staff session and try again.' });
    } finally {
      setBusyAction('');
    }
  };

  return (
    <View style={styles.workspace}>
      <View style={styles.formCard}>
        <View style={styles.headingRow}>
          <View style={styles.flex}>
            <Text style={styles.heading}>{editingId ? 'Edit PSI Event' : 'Create PSI Event'}</Text>
            <Text style={styles.copy}>{REVIEW_ENVIRONMENT.enabled ? 'Save a fictional draft or publish to sandbox accounts. In-app alerts can be reviewed here; external push delivery is disabled.' : editingId ? 'Save the corrected details. Changes to a published event queue a customer update alert.' : 'Save privately as a draft or publish to every signed-in customer. Publishing queues app alerts and native push notifications.'}</Text>
          </View>
          <Ionicons color={colors.accent} name="flag" size={24} />
        </View>

        <Field label="Event title" hint="Required · max 80 characters">
          <FormInput maxLength={80} onChangeText={setTitle} placeholder="Cars & Coffee" value={title} />
        </Field>
        <Field label="Location" hint="Optional">
          <FormInput maxLength={160} onChangeText={setLocation} placeholder="PSI Performance workshop" value={location} />
        </Field>
        <Field label="Details" hint="Optional">
          <FormInput maxLength={1000} multiline onChangeText={setDescription} placeholder="Customer event details" style={styles.textArea} textAlignVertical="top" value={description} />
        </Field>

        <View style={styles.dateRow}>
          <Pressable accessibilityLabel="Choose event date" accessibilityRole="button" onPress={() => setShowDatePicker(true)} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
            <Ionicons color={colors.accent} name="calendar" size={18} />
            <Text style={styles.dateButtonText}>{new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(startsAt)}</Text>
          </Pressable>
          <Pressable accessibilityLabel="Choose event time" accessibilityRole="button" onPress={() => setShowTimePicker(true)} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
            <Ionicons color={colors.accent} name="time" size={18} />
            <Text style={styles.dateButtonText}>{new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' }).format(startsAt)}</Text>
          </Pressable>
        </View>

        {showDatePicker ? (
          <DateTimePicker
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            minimumDate={new Date()}
            mode="date"
            onChange={(_, selected) => {
              if (selected) {
                const merged = new Date(startsAt);
                merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                setStartsAt(merged);
              }
              setShowDatePicker(false);
            }}
            value={startsAt}
          />
        ) : null}
        {showTimePicker ? (
          <DateTimePicker
            is24Hour={false}
            mode="time"
            onChange={(_, selected) => {
              if (selected) {
                const merged = new Date(startsAt);
                merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                setStartsAt(merged);
              }
              setShowTimePicker(false);
            }}
            value={startsAt}
          />
        ) : null}

        {editingId ? (
          <View style={styles.actions}>
            <PrimaryButton label="Save event changes" loading={busyAction === 'save-edit'} onPress={() => void saveChanges()} />
            <PrimaryButton label="Cancel editing" onPress={resetForm} variant="outline" />
          </View>
        ) : (
          <View style={styles.actions}>
            <PrimaryButton label="Save private draft" loading={busyAction === 'create-draft'} onPress={() => void create(false)} variant="outline" />
            <PrimaryButton label="Publish & alert customers" loading={busyAction === 'create-publish'} onPress={() => void create(true)} />
          </View>
        )}
        {feedback ? <Text accessibilityRole={feedback.error ? 'alert' : undefined} style={feedback.error ? styles.error : styles.success}>{feedback.text}</Text> : null}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.heading}>Event list</Text>
        <Pressable accessibilityLabel="Refresh staff PSI Events" accessibilityRole="button" onPress={() => void refresh()} style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
          {loading ? <ActivityIndicator color={colors.accent} size="small" /> : <Ionicons color={colors.accent} name="refresh" size={18} />}
        </Pressable>
      </View>
      {!loading && events.length === 0 ? <Text style={styles.empty}>No PSI Events have been created.</Text> : null}
      {events.map((event) => (
        <View key={event.id} style={styles.eventCard}>
          <View style={styles.headingRow}>
            <View style={styles.flex}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDate}>{formatAustralianDateTime(event.starts_at)}</Text>
            </View>
            <Text style={[styles.badge, event.status === 'published' && styles.badgePublished]}>{event.status}</Text>
          </View>
          {event.location ? <Text style={styles.eventLocation}>{event.location}</Text> : null}
          {event.description ? <Text style={styles.copy}>{event.description}</Text> : null}
          {event.status !== 'cancelled' ? <PrimaryButton label="Edit event details" onPress={() => edit(event)} variant="outline" /> : null}
          {event.status === 'draft' ? <PrimaryButton label="Publish & alert customers" loading={busyAction === `publish:${event.id}`} onPress={() => void changeStatus(event, 'publish')} /> : null}
          {event.status !== 'cancelled' ? <PrimaryButton label="Cancel event" loading={busyAction === `cancel:${event.id}`} onPress={() => void changeStatus(event, 'cancel')} variant="outline" /> : null}
        </View>
      ))}
    </View>
  );
}

function eventErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'PSI_EVENT_TITLE_INVALID') return 'Add an event title of 80 characters or fewer.';
  if (message === 'PSI_EVENT_DATE_PAST') return 'Choose a future date and time.';
  return 'The event was not saved. Check the details and try again.';
}

const styles = StyleSheet.create({
  workspace: { gap: spacing.md },
  formCard: { ...mobileFrame, backgroundColor: colors.inkSoft, gap: spacing.md, padding: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  heading: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  copy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  textArea: { minHeight: 94, paddingTop: spacing.sm },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateButton: { ...mobileFrame, minHeight: 46, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderColor: colors.accent, paddingHorizontal: spacing.md },
  dateButtonText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  actions: { gap: spacing.sm },
  success: { color: colors.success, fontSize: 11, fontWeight: '800', lineHeight: 17 },
  error: { color: colors.danger, fontSize: 11, fontWeight: '800', lineHeight: 17 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refresh: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty: { ...mobileFrame, color: colors.muted, backgroundColor: colors.inkSoft, fontSize: 11, lineHeight: 17, padding: spacing.md },
  eventCard: { ...mobileFrame, backgroundColor: colors.inkSoft, gap: spacing.sm, padding: spacing.md },
  eventTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  eventDate: { color: colors.accent, fontSize: 11, fontWeight: '900', marginTop: 3 },
  eventLocation: { color: colors.white, fontSize: 11, fontWeight: '800' },
  badge: { color: colors.muted, borderColor: colors.line, borderWidth: 1, fontSize: 9, fontWeight: '900', paddingHorizontal: spacing.sm, paddingVertical: 5, textTransform: 'uppercase' },
  badgePublished: { color: colors.success, borderColor: colors.success },
  pressed: { opacity: 0.72 },
});
