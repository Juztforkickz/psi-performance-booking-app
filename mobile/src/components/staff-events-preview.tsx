import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/brand';
import { useStaffDiscardConfirmation } from '@/hooks/use-staff-discard-confirmation';

type EventDraft = { title: string; location: string; date: string; time: string; description: string };
type PreviewEvent = EventDraft & { id: string; status: 'Published' | 'Draft' };

const sampleEvents: PreviewEvent[] = [
  {
    id: 'preview-event-1',
    title: 'Open workshop morning',
    location: 'Sample workshop venue',
    date: '19/09/2026',
    time: '9:00 am',
    description: 'A relaxed morning to meet the workshop team, see customer builds and talk about your next project.',
    status: 'Published',
  },
  {
    id: 'preview-event-2',
    title: 'Dyno demonstration day',
    location: 'Sample dyno facility',
    date: '26/09/2026',
    time: '10:00 am',
    description: 'A draft event with dyno demonstrations and time for questions. Final details can be reviewed before publishing.',
    status: 'Draft',
  },
];

const emptyDraft: EventDraft = { title: '', location: '', date: '', time: '9:00 am', description: '' };

/** Interactive presentation only. There are no event service calls or writes. */
export function StaffEventsPreview({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void } = {}) {
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [initialDraft, setInitialDraft] = useState<EventDraft>(emptyDraft);
  const [editingTitle, setEditingTitle] = useState('');
  const { confirmDiscard, discardDialog } = useStaffDiscardConfirmation();
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(initialDraft);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

  const open = (event?: PreviewEvent) => {
    const next: EventDraft = event
      ? { title: event.title, location: event.location, date: event.date, time: event.time, description: event.description }
      : { ...emptyDraft };
    setInitialDraft(next);
    setDraft(next);
    setEditingTitle(event ? event.title : '');
  };
  const close = () => {
    const leave = () => { setDraft(null); setEditingTitle(''); };
    if (dirty) confirmDiscard(leave);
    else leave();
  };
  const update = (key: keyof EventDraft, value: string) => setDraft(current => current ? { ...current, [key]: value } : current);

  if (draft) return <View style={styles.workspace}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>{editingTitle ? 'Edit event' : 'New event'}</Text>
      <Pressable accessibilityRole="button" onPress={close} style={styles.closeButton}><Text style={styles.link}>Close</Text></Pressable>
    </View>
    <Text style={styles.copy}>Enter the details, then review the event before publishing.</Text>
    <View style={styles.card}>
      <Field label="Event title" hint="Required · up to 80 characters"><FormInput value={draft.title} onChangeText={value => update('title', value)} placeholder="Name your event" maxLength={80} /></Field>
      <Field label="Location" hint="Optional"><FormInput value={draft.location} onChangeText={value => update('location', value)} placeholder="Venue or meeting point" maxLength={180} /></Field>
      <View style={styles.dateRow}>
        <View style={styles.dateField}><Field label="Date" hint="DD/MM/YYYY"><FormInput value={draft.date} onChangeText={value => update('date', value)} placeholder="19/09/2026" maxLength={10} keyboardType="numbers-and-punctuation" /></Field></View>
        <View style={styles.timeField}><Field label="Time"><FormInput value={draft.time} onChangeText={value => update('time', value)} placeholder="9:00 am" maxLength={12} /></Field></View>
      </View>
      <Field label="Details" hint="Optional"><FormInput value={draft.description} onChangeText={value => update('description', value)} placeholder="What customers need to know" multiline textAlignVertical="top" style={styles.notes} maxLength={1200} /></Field>
    </View>
    <View style={styles.previewNote}><Ionicons name="information-circle-outline" color={colors.accent} size={20} /><Text style={styles.noteText}>Explore the form with sample details. Saving and customer alerts are unavailable in this preview.</Text></View>
    <PrimaryButton label={editingTitle ? 'Save changes · Preview only' : 'Save draft · Preview only'} disabled onPress={() => undefined} variant="outline" />
    <PrimaryButton label="Publish event · Preview only" disabled onPress={() => undefined} />
    {discardDialog}
  </View>;

  return <View style={styles.workspace}>
    <Text style={styles.copy}>Create and manage customer events. Open an event to see its details.</Text>
    <PrimaryButton label="Create event" onPress={() => open()} />
    <Text style={styles.sectionLabel}>Upcoming events</Text>
    {sampleEvents.map(event => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`Open ${event.title}`} onPress={() => open(event)} style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}>
      <View style={styles.eventIcon}><Ionicons name="calendar-outline" color={colors.accent} size={22} /></View>
      <View style={styles.eventBody}>
        <View style={styles.eventHeading}><Text style={styles.eventTitle}>{event.title}</Text><Text style={[styles.status, event.status === 'Published' && styles.published]}>{event.status}</Text></View>
        <Text style={styles.eventDate}>{event.date} · {event.time}</Text>
        <Text style={styles.eventLocation}>{event.location}</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.muted} size={18} />
    </Pressable>)}
    {discardDialog}
  </View>;
}

const styles = StyleSheet.create({
  workspace: { gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, color: colors.white, fontSize: 20, fontWeight: '800' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  closeButton: { minHeight: 44, minWidth: 52, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  card: { padding: 16, gap: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dateField: { flexGrow: 1, flexBasis: 155 },
  timeField: { flexGrow: 1, flexBasis: 105 },
  notes: { minHeight: 116 },
  previewNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noteText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },
  sectionLabel: { color: colors.silver, fontSize: 13, fontWeight: '800', marginTop: 4 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.panel },
  eventIcon: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  eventBody: { flex: 1, minWidth: 0, gap: 5 },
  eventHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  eventTitle: { flexGrow: 1, flexBasis: 150, color: colors.white, fontSize: 16, fontWeight: '800' },
  status: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  published: { color: colors.success },
  eventDate: { color: colors.accent, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  eventLocation: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});
