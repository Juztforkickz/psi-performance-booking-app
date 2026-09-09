import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { formatAustralianDateTime } from '@/lib/australian-date';
import type { PsiEventRow } from '@/lib/database.types';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { cancelPsiEvent, createPsiEvent, loadStaffPsiEvents, publishPsiEvent, updatePsiEvent } from '@/lib/psi-events';
import { useStaffDiscardConfirmation } from '@/hooks/use-staff-discard-confirmation';

function initialStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

export function StaffEventsManager({ onDirtyChange, onBusyChange }: {
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
} = {}) {
  const { confirmDiscard, discardDialog } = useStaffDiscardConfirmation();
  const [events, setEvents] = useState<PsiEventRow[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [initialDate] = useState(initialStart);
  const [startsAt, setStartsAt] = useState(initialDate);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReferenceTime] = useState(Date.now);
  const values = JSON.stringify([title, description, location, startsAt.toISOString()]);
  const [savedValues, setSavedValues] = useState(() => JSON.stringify(['', '', '', initialDate.toISOString()]));
  const dirty = formOpen && values !== savedValues;
  const busy = !!busyAction;
  const editingEvent = events.find(event => event.id === editingId);
  const currentEvents = events.filter((event) => !eventIsArchived(event, archiveReferenceTime));
  const archivedEvents = events.filter((event) => eventIsArchived(event, archiveReferenceTime)).sort((left, right) => right.starts_at.localeCompare(left.starts_at));

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onBusyChange?.(false); }, [onDirtyChange, onBusyChange]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await loadStaffPsiEvents());
    } catch {
      setFeedback({ error: true, text: 'Events could not be loaded. Try refreshing.' });
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
      setFeedback({ error: false, text: publish ? 'Event published. Customer alerts queued.' : 'Draft saved.' });
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
      setFeedback({ error: false, text: 'Changes saved. Customer updates queued where needed.' });
      await refresh();
    } catch (error) {
      setFeedback({ error: true, text: eventErrorMessage(error) });
    } finally {
      setBusyAction('');
    }
  };

  const edit = (event: PsiEventRow) => {
    if (busy) return;
    setFormOpen(true);
    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description ?? '');
    setLocation(event.location ?? '');
    setStartsAt(new Date(event.starts_at));
    setSavedValues(JSON.stringify([event.title, event.description ?? '', event.location ?? '', new Date(event.starts_at).toISOString()]));
    setFeedback(null);
  };

  const resetForm = () => {
    const nextDate = initialStart();
    setFormOpen(false);
    setEditingId('');
    setTitle('');
    setDescription('');
    setLocation('');
    setStartsAt(nextDate);
    setSavedValues(JSON.stringify(['', '', '', nextDate.toISOString()]));
    setShowDatePicker(false); setShowTimePicker(false);
  };

  const closeForm = () => {
    if (busy) return;
    const discard = () => { resetForm(); setFeedback(null); };
    if (!dirty) { discard(); return; }
    confirmDiscard(discard);
  };

  const changeStatus = async (event: PsiEventRow, action: 'cancel' | 'publish') => {
    if (busyAction) return;
    setBusyAction(`${action}:${event.id}`);
    setFeedback(null);
    try {
      if (action === 'publish') await publishPsiEvent(event.id);
      else await cancelPsiEvent(event.id);
      resetForm();
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
      {discardDialog}
      {feedback ? <Text accessibilityRole={feedback.error ? 'alert' : undefined} style={feedback.error ? styles.error : styles.success}>{feedback.text}</Text> : null}
      {formOpen ? <View style={styles.formCard}>
        <View style={styles.headingRow}>
          <View style={styles.flex}>
            <Text style={styles.heading}>{editingId ? 'Edit event' : 'New event'}</Text>
            <Text style={styles.copy}>{REVIEW_ENVIRONMENT.enabled ? 'Demo event. Customer notifications are off.' : editingEvent?.status === 'published' ? 'Saving changes notifies customers.' : 'Drafts stay private. Publishing notifies customers.'}</Text>
          </View>
          <Pressable disabled={busy} accessibilityLabel="Back to events" accessibilityRole="button" onPress={closeForm} style={styles.refresh}><Ionicons color={colors.muted} name="close" size={21} /></Pressable>
        </View>

        <Field label="Event title">
          <FormInput editable={!busy} maxLength={80} onChangeText={setTitle} placeholder="Cars & Coffee" value={title} />
        </Field>
        <Field label="Location" hint="Optional">
          <FormInput editable={!busy} maxLength={160} onChangeText={setLocation} placeholder="PSI Performance workshop" value={location} />
        </Field>
        <Field label="Details" hint="Optional">
          <FormInput editable={!busy} maxLength={1000} multiline onChangeText={setDescription} placeholder="Customer event details" style={styles.textArea} textAlignVertical="top" value={description} />
        </Field>

        <View style={styles.dateRow}>
          <Pressable disabled={busy} accessibilityLabel="Choose event date" accessibilityRole="button" onPress={() => setShowDatePicker(true)} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
            <Ionicons color={colors.accent} name="calendar" size={18} />
            <Text style={styles.dateButtonText}>{new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(startsAt)}</Text>
          </Pressable>
          <Pressable disabled={busy} accessibilityLabel="Choose event time" accessibilityRole="button" onPress={() => setShowTimePicker(true)} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}>
            <Ionicons color={colors.accent} name="time" size={18} />
            <Text style={styles.dateButtonText}>{new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit' }).format(startsAt)}</Text>
          </Pressable>
        </View>

        {showDatePicker && !busy ? (
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
        {showTimePicker && !busy ? (
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
            <PrimaryButton disabled={busy || !dirty} label="Save changes" loading={busyAction === 'save-edit'} onPress={() => void saveChanges()} />
            {editingEvent?.status === 'draft' ? <PrimaryButton disabled={busy || dirty} label="Publish & notify customers" loading={busyAction === `publish:${editingId}`} onPress={() => void changeStatus(editingEvent, 'publish')} variant="outline" /> : null}
            {dirty ? <Text style={styles.copy}>Save changes before publishing or cancelling the event.</Text> : null}
            {editingEvent && editingEvent.status !== 'cancelled' ? <PrimaryButton disabled={busy || dirty} label="Cancel & notify customers" loading={busyAction === `cancel:${editingId}`} onPress={() => void changeStatus(editingEvent, 'cancel')} variant="outline" /> : null}
          </View>
        ) : (
          <View style={styles.actions}>
            <PrimaryButton disabled={busy} label="Save draft" loading={busyAction === 'create-draft'} onPress={() => void create(false)} />
            <PrimaryButton disabled={busy} label="Publish & notify customers" loading={busyAction === 'create-publish'} onPress={() => void create(true)} variant="outline" />
          </View>
        )}
      </View> : <>

      <PrimaryButton disabled={busy} label="Create event" onPress={() => { resetForm(); setFeedback(null); setFormOpen(true); }} />

      <View style={styles.listHeader}>
        <Text style={styles.heading}>Current events</Text>
        <Pressable disabled={loading || busy} accessibilityLabel="Refresh PSI events" accessibilityRole="button" onPress={() => void refresh()} style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
          {loading ? <ActivityIndicator color={colors.accent} size="small" /> : <Ionicons color={colors.accent} name="refresh" size={18} />}
        </Pressable>
      </View>
      {!loading && currentEvents.length === 0 ? <Text style={styles.empty}>{events.length ? 'No current events. Past events are below.' : 'No events yet.'}</Text> : null}
      {currentEvents.map((event) => (
        <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Open event ${event.title}`} key={event.id} onPress={() => edit(event)} style={({ pressed }) => [styles.eventCard, pressed && styles.pressed]}>
          <View style={styles.headingRow}>
            <View style={styles.flex}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventDate}>{formatAustralianDateTime(event.starts_at)}</Text>
              <Text style={styles.eventLocation}>{event.status === 'published' ? 'Published' : 'Draft'}{event.location ? ` · ${event.location}` : ''}</Text>
            </View>
            <Ionicons color={colors.accent} name="chevron-forward" size={20} />
          </View>
        </Pressable>
      ))}

      {archivedEvents.length ? <View style={styles.archivePanel}>
        <Pressable
          accessibilityLabel={`Event archive, ${archivedEvents.length} events`}
          accessibilityRole="button"
          accessibilityState={{ expanded: archiveOpen }}
          onPress={() => setArchiveOpen((current) => !current)}
          style={({ pressed }) => [styles.archiveHeading, pressed && styles.pressed]}
        >
          <View style={styles.flex}>
            <Text style={styles.heading}>Past events</Text>
            <Text style={styles.archiveMeta}>{archivedEvents.length} finished or cancelled</Text>
          </View>
          <Ionicons color={colors.accent} name={archiveOpen ? 'chevron-up' : 'chevron-down'} size={22} />
        </Pressable>
        {archiveOpen ? archivedEvents.length ? archivedEvents.map((event) => (
          <View key={event.id} style={styles.archivedEventRow}>
            <Ionicons color={event.status === 'cancelled' ? colors.muted : colors.success} name={event.status === 'cancelled' ? 'close-circle-outline' : 'checkmark-circle-outline'} size={19} />
            <View style={styles.flex}>
              <Text style={styles.archivedEventTitle}>{event.title}</Text>
              <Text style={styles.archiveMeta}>{event.status === 'cancelled' ? 'Cancelled' : 'Finished'} · {formatAustralianDateTime(event.starts_at)}</Text>
            </View>
          </View>
        )) : <Text style={styles.archiveEmpty}>No events are archived yet.</Text> : null}
      </View> : null}
      </>}
    </View>
  );
}

function eventIsArchived(event: PsiEventRow, referenceTime: number) {
  if (event.status === 'cancelled') return true;
  const finishTime = event.ends_at ? new Date(event.ends_at).getTime() : new Date(event.starts_at).getTime() + 3 * 60 * 60 * 1000;
  return finishTime < referenceTime;
}

function eventErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'PSI_EVENT_TITLE_INVALID') return 'Add an event title of 80 characters or fewer.';
  if (message === 'PSI_EVENT_DATE_PAST') return 'Choose a future date and time.';
  return 'The event was not saved. Check the details and try again.';
}

const styles = StyleSheet.create({
  workspace: { gap: spacing.md },
  formCard: { gap: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  heading: { color: colors.white, fontSize: 16, fontWeight: '700' },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  textArea: { minHeight: 94, paddingTop: spacing.sm },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateButton: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, minHeight: 46, flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dateButtonText: { color: colors.white, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  actions: { gap: spacing.sm },
  success: { color: colors.success, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refresh: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingVertical: spacing.sm },
  eventCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.panel, padding: spacing.md },
  eventTitle: { color: colors.white, fontSize: 15, fontWeight: '600' },
  eventDate: { color: colors.accent, fontSize: 12, marginTop: 4 },
  eventLocation: { color: colors.muted, fontSize: 12, marginTop: 4 },
  archivePanel: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  archiveHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  archiveMeta: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  archivedEventRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: spacing.sm },
  archivedEventTitle: { color: colors.white, fontSize: 13, fontWeight: '600' },
  archiveEmpty: { color: colors.muted, fontSize: 11, lineHeight: 17, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  pressed: { opacity: 0.72 },
});
