import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/brand';
import { addCustomerVehicleNote, loadCustomerVehicleNotes, type CustomerVehicleNote } from '@/lib/customer-vehicle-notes';

// Callers key this component by authenticated identity and vehicle.
export function CustomerVehicleNotes({ vehicleId, readOnly = false, previewMode = false }: {
  vehicleId: string; readOnly?: boolean; previewMode?: boolean;
}) {
  const [notes, setNotes] = useState<CustomerVehicleNote[] | null>(null);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    if (previewMode) return;
    let active = true;
    loadCustomerVehicleNotes(vehicleId).then(value => {
      if (active) { setNotes(value); setMessage(''); }
    }).catch(() => { if (active) setMessage('Notes could not be loaded. Please refresh.'); });
    return () => { active = false; };
  }, [vehicleId, previewMode, revision]);
  const save = async () => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setMessage('');
    try {
      const note = await addCustomerVehicleNote(vehicleId, draft);
      setNotes(previous => [note, ...(previous ?? []).filter(item => item.id !== note.id)]);
      setDraft(''); setMessage('Saved. PSI can now read this note.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save. Please try again.'); }
    finally { saving.current = false; setBusy(false); }
  };
  return <View style={styles.section}>
    <Text style={styles.title}>{readOnly ? 'Customer notes' : 'Your notes · free'}</Text>
    <Text style={styles.copy}>{readOnly
      ? 'Customer-supplied information · unverified. These notes do not change PSI workshop records.'
      : 'Share information about this vehicle with PSI. Notes are free and stay separate from verified workshop records. For a booking or an urgent concern, contact PSI directly.'}</Text>
    {previewMode ? <Text style={styles.copy}>Sign in to save and view vehicle notes.</Text> : <>
      {!readOnly ? <>
        <Field label="Add a note for PSI"><FormInput multiline maxLength={4000} value={draft} editable={!busy} onChangeText={setDraft} placeholder="For example: a noise when the engine is cold…" style={{ minHeight: 100, textAlignVertical: 'top' }} /></Field>
        <PrimaryButton label={busy ? 'Saving note…' : 'Save note'} disabled={busy || !draft.trim()} onPress={() => void save()} />
      </> : null}
      {!notes && !message ? <ActivityIndicator color={colors.accent} /> : null}
      {notes?.length === 0 ? <Text style={styles.copy}>No customer notes for this vehicle yet.</Text> : null}
      {notes?.map(note => <View key={note.id} style={styles.note}>
        <Text style={styles.label}>CUSTOMER NOTE · UNVERIFIED</Text>
        <Text style={styles.date}>{new Date(note.created_at).toLocaleString('en-AU')}</Text>
        <Text selectable style={styles.copy}>{note.body}</Text>
      </View>)}
      {message ? <Text accessibilityRole="alert" style={styles.copy}>{message}</Text> : null}
      <PrimaryButton label="Refresh notes" variant="outline" disabled={busy} onPress={() => setRevision(value => value + 1)} />
    </>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 14 }, title: { color: colors.white, fontSize: 21, fontWeight: '800' },
  copy: { color: colors.silver, fontSize: 15, lineHeight: 23 },
  note: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 16, gap: 8 },
  label: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  date: { color: colors.muted, fontSize: 12 },
});
