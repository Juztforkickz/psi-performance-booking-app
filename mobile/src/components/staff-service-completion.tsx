import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { todayAustralianDate } from '@/lib/australian-date';
import type { BookingRequestRow } from '@/lib/database.types';
import { completePsiService } from '@/lib/staff-record-publishing';
import { useStaffDiscardConfirmation } from '@/hooks/use-staff-discard-confirmation';

type Props = {
  booking: BookingRequestRow;
  customerLabel: string;
  onRefresh: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  vehicleLabel: string;
};

export function StaffServiceCompletion({ booking, customerLabel, onRefresh, vehicleLabel, onDirtyChange, onBusyChange }: Props) {
  const { confirmDiscard, discardDialog } = useStaffDiscardConfirmation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [initialCompletedDate] = useState(todayInSydney);
  const [completedDate, setCompletedDate] = useState(initialCompletedDate);
  const [odometerKm, setOdometerKm] = useState('');
  const [summary, setSummary] = useState('');
  const [nextCheckInDate, setNextCheckInDate] = useState('');
  const [nextCheckInOdometerKm, setNextCheckInOdometerKm] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const values = JSON.stringify([completedDate, odometerKm, summary, nextCheckInDate, nextCheckInOdometerKm]);
  const [savedValues, setSavedValues] = useState(() => JSON.stringify([initialCompletedDate, '', '', '', '']));
  const dirty = values !== savedValues || confirmed;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onBusyChange?.(false); }, [onDirtyChange, onBusyChange]);

  const close = () => {
    if (busy) return;
    const discard = () => {
      setCompletedDate(initialCompletedDate);
      setOdometerKm(''); setSummary(''); setNextCheckInDate(''); setNextCheckInOdometerKm('');
      setConfirmed(false); setFeedback(null); setOpen(false);
      setSavedValues(JSON.stringify([initialCompletedDate, '', '', '', '']));
    };
    if (!dirty) { discard(); return; }
    confirmDiscard(discard);
  };

  if (booking.booking_type !== 'service' || booking.state !== 'confirmed') return null;

  const completeService = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await completePsiService({
        bookingId: booking.id,
        completedDate,
        customerId: booking.customer_id,
        nextCheckInDate,
        nextCheckInOdometerKm,
        odometerKm,
        summary,
        vehicleId: booking.vehicle_id,
      });
      setConfirmed(false);
      setSavedValues(values);
      setFeedback({
        kind: 'success',
        text: 'Service completed. Booking closed and customer service history updated.',
      });
    } catch (error) {
      setFeedback({ kind: 'error', text: completionErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <View style={styles.launch}>
        <PrimaryButton label="Complete service" onPress={() => setOpen(true)} />
      </View>
    );
  }

  return (
    <View style={styles.workspace}>
      {discardDialog}
      <View style={styles.heading}>
        <Text style={styles.title}>{feedback?.kind === 'success' ? 'Service completed' : 'Complete service'}</Text>
        {!feedback || feedback.kind === 'error' ? (
          <Pressable accessibilityLabel="Close service completion" accessibilityRole="button" disabled={busy} onPress={close} style={styles.close}>
            <Ionicons color={colors.white} name="close" size={20} />
          </Pressable>
        ) : null}
      </View>

      {feedback?.kind !== 'success' ? (
        <View pointerEvents={busy ? 'none' : 'auto'} style={styles.actions}>
          <View style={styles.identityBlock}>
            <Text style={styles.identity}>{customerLabel}</Text>
            <Text style={styles.vehicle}>{vehicleLabel}</Text>
          </View>
          <Text style={styles.warning}>Creates a permanent service record and closes this booking.</Text>
          <Field hint="DD/MM/YYYY" label="Completed date">
            <FormInput editable={!busy} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(value) => { setCompletedDate(value); setConfirmed(false); }} value={completedDate} />
          </Field>
          <Field hint="Optional · whole kilometres" label="Odometer">
            <FormInput editable={!busy} keyboardType="number-pad" maxLength={8} onChangeText={(value) => { setOdometerKm(value.replace(/\D/gu, '')); setConfirmed(false); }} placeholder="84210" value={odometerKm} />
          </Field>
          <Field label="Work completed">
            <FormInput editable={!busy} multiline numberOfLines={4} onChangeText={(value) => { setSummary(value); setConfirmed(false); }} placeholder="Work completed, inspections and workshop findings" style={styles.notes} textAlignVertical="top" value={summary} />
          </Field>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <Field hint="Optional · DD/MM/YYYY" label="Next check-in date">
                <FormInput editable={!busy} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(value) => { setNextCheckInDate(value); setConfirmed(false); }} placeholder="DD/MM/YYYY" value={nextCheckInDate} />
              </Field>
            </View>
            <View style={styles.column}>
              <Field hint="Optional · whole kilometres" label="Next check-in odometer">
                <FormInput editable={!busy} keyboardType="number-pad" maxLength={8} onChangeText={(value) => { setNextCheckInOdometerKm(value.replace(/\D/gu, '')); setConfirmed(false); }} placeholder="94210" value={nextCheckInOdometerKm} />
              </Field>
            </View>
          </View>

          <Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: busy }} onPress={() => setConfirmed((value) => !value)} style={styles.confirmRow}>
            <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>{confirmed ? <Ionicons color={colors.ink} name="checkmark" size={16} /> : null}</View>
            <Text style={styles.confirmText}>I checked the customer, vehicle, date, odometer and work summary. Corrections must be recorded separately.</Text>
          </Pressable>
          {feedback ? <Text accessibilityRole="alert" style={styles.error}>{feedback.text}</Text> : null}
          <PrimaryButton disabled={!confirmed || !summary.trim()} label="Complete service" loading={busy} onPress={() => void completeService()} />
        </View>
      ) : (
        <View style={styles.successBox}>
          <Text accessibilityRole="alert" style={styles.success}>{feedback.text}</Text>
          <PrimaryButton label="Refresh booking" onPress={onRefresh} />
        </View>
      )}
    </View>
  );
}

function todayInSydney() {
  return todayAustralianDate('Australia/Sydney');
}

function completionErrorMessage(error: unknown) {
  const detail = error instanceof Error
    ? error.message
    : `${(error as { code?: string; message?: string } | null)?.code ?? ''} ${(error as { message?: string } | null)?.message ?? ''}`;
  if (detail.includes('23505') || detail.toLowerCase().includes('duplicate')) return 'This booking already has a service completion. Refresh the queue before doing anything else.';
  if (detail.includes('AAL2') || detail.includes('JWT') || detail.toLowerCase().includes('staff session')) return 'Your protected staff session needs authenticator verification again. Re-open the staff portal before retrying.';
  if (detail.includes('DATE_INVALID') || detail.toLowerCase().includes('future') || detail.toLowerCase().includes('check-in')) return 'Check the completed date and next check-in date. Use real dates in DD/MM/YYYY format; the next check-in cannot be earlier than the service.';
  if (detail.includes('ODOMETER') || detail.toLowerCase().includes('odometer')) return 'Odometer values must be whole kilometres, and the next check-in odometer cannot be below the completed-service odometer.';
  if (detail.includes('SUMMARY_REQUIRED') || detail.toLowerCase().includes('summary')) return 'Add a completed work summary before closing the service.';
  if (detail.toLowerCase().includes('confirmed')) return 'This service booking is no longer confirmed. Refresh the queue and verify its current state.';
  return 'The service was not completed and no success is being claimed. Refresh the protected queue, check the details and try again.';
}

const styles = StyleSheet.create({
  launch: { alignItems: 'stretch', borderTopColor: colors.line, borderTopWidth: 1, gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md },
  workspace: { borderTopWidth: 1, borderTopColor: colors.line, gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.md },
  heading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  title: { flex: 1, color: colors.white, fontSize: 16, fontWeight: '700' },
  close: { alignItems: 'center', minHeight: 44, justifyContent: 'center', width: 44 },
  identityBlock: { gap: spacing.xs },
  identity: { color: colors.white, fontSize: 14, fontWeight: '600' },
  vehicle: { color: colors.muted, fontSize: 13 },
  warning: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  notes: { minHeight: 88 },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
  actions: { gap: spacing.md },
  confirmRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', borderColor: colors.accent, borderWidth: 1, borderRadius: 4, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.accent },
  confirmText: { color: colors.silver, flex: 1, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  successBox: { gap: spacing.md },
  success: { color: colors.success, fontSize: 13, lineHeight: 19 },
});
