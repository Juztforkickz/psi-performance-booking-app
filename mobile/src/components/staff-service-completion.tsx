import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { todayAustralianDate } from '@/lib/australian-date';
import type { BookingRequestRow } from '@/lib/database.types';
import { completePsiService } from '@/lib/staff-record-publishing';

type Props = {
  booking: BookingRequestRow;
  customerLabel: string;
  onRefresh: () => void;
  vehicleLabel: string;
};

export function StaffServiceCompletion({ booking, customerLabel, onRefresh, vehicleLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [completedDate, setCompletedDate] = useState(todayInSydney());
  const [odometerKm, setOdometerKm] = useState('');
  const [summary, setSummary] = useState('');
  const [nextCheckInDate, setNextCheckInDate] = useState('');
  const [nextCheckInOdometerKm, setNextCheckInOdometerKm] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  if (booking.booking_type !== 'service') return null;
  if (booking.state !== 'confirmed') {
    return (
      <View style={styles.waiting}>
        <Ionicons color={colors.mutedDark} name="lock-closed" size={15} />
        <Text style={styles.waitingText}>Complete Service becomes available only after this service booking is confirmed.</Text>
      </View>
    );
  }

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
      setFeedback({
        kind: 'success',
        text: 'Service completed. The booking is closed and the official PSI service history, odometer and next check-in are now protected customer records.',
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
        <Text style={styles.launchCopy}>Confirmed service · ready for an authorised PSI completion record.</Text>
        <PrimaryButton label="Complete Service" onPress={() => setOpen(true)} variant="outline" />
      </View>
    );
  }

  return (
    <View style={styles.workspace}>
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>Protected PSI action</Text>
          <Text style={styles.title}>Complete Service</Text>
        </View>
        {!feedback || feedback.kind === 'error' ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setOpen(false)} style={styles.close}>
            <Ionicons color={colors.white} name="close" size={20} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.identity}>{customerLabel}</Text>
      <Text style={styles.vehicle}>{vehicleLabel}</Text>
      <Text style={styles.warning}>This creates one immutable PSI service completion and closes this confirmed booking. Corrections require a separately audited workflow.</Text>

      {feedback?.kind !== 'success' ? (
        <>
          <Field hint="DD/MM/YYYY" label="Completed date">
            <FormInput keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(value) => { setCompletedDate(value); setConfirmed(false); }} value={completedDate} />
          </Field>
          <Field hint="Optional · whole kilometres" label="Odometer at PSI">
            <FormInput keyboardType="number-pad" maxLength={8} onChangeText={(value) => { setOdometerKm(value.replace(/\D/gu, '')); setConfirmed(false); }} placeholder="84210" value={odometerKm} />
          </Field>
          <Field label="Completed work summary">
            <FormInput multiline numberOfLines={4} onChangeText={(value) => { setSummary(value); setConfirmed(false); }} placeholder="Work completed, inspections and workshop findings" style={styles.notes} textAlignVertical="top" value={summary} />
          </Field>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <Field hint="Optional · DD/MM/YYYY" label="Next PSI check-in date">
                <FormInput keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(value) => { setNextCheckInDate(value); setConfirmed(false); }} placeholder="24/02/2027" value={nextCheckInDate} />
              </Field>
            </View>
            <View style={styles.column}>
              <Field hint="Optional · whole kilometres" label="Next PSI check-in odometer">
                <FormInput keyboardType="number-pad" maxLength={8} onChangeText={(value) => { setNextCheckInOdometerKm(value.replace(/\D/gu, '')); setConfirmed(false); }} placeholder="94210" value={nextCheckInOdometerKm} />
              </Field>
            </View>
          </View>

          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed((value) => !value)} style={styles.confirmRow}>
            <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>{confirmed ? <Ionicons color={colors.ink} name="checkmark" size={16} /> : null}</View>
            <Text style={styles.confirmText}>I checked the customer, vehicle, completed date, odometer and work summary. Create the official read-only PSI history and close this booking.</Text>
          </Pressable>
          {feedback ? <Text accessibilityRole="alert" style={styles.error}>{feedback.text}</Text> : null}
          <PrimaryButton disabled={!confirmed || !summary.trim()} label="Confirm and Complete Service" loading={busy} onPress={() => void completeService()} />
        </>
      ) : (
        <View style={styles.successBox}>
          <Ionicons color={colors.success} name="checkmark-circle" size={26} />
          <Text accessibilityRole="alert" style={styles.success}>{feedback.text}</Text>
          <PrimaryButton label="Refresh booking queue" onPress={onRefresh} />
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
  flex: { flex: 1 },
  waiting: { alignItems: 'center', borderTopColor: colors.line, borderTopWidth: 1, flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, paddingTop: spacing.sm },
  waitingText: { color: colors.mutedDark, flex: 1, fontSize: 11, lineHeight: 17 },
  launch: { alignItems: 'stretch', borderTopColor: colors.line, borderTopWidth: 1, gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md },
  launchCopy: { color: colors.silver, fontSize: 12, lineHeight: 18 },
  workspace: { ...mobileFrame, backgroundColor: colors.inkSoft, gap: spacing.md, marginTop: spacing.md, padding: spacing.md },
  heading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 20, fontWeight: '900', marginTop: 2 },
  close: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  identity: { color: colors.white, fontSize: 14, fontWeight: '900' },
  vehicle: { color: colors.accent, fontSize: 12, fontWeight: '800', marginTop: -spacing.sm },
  warning: { color: colors.silver, fontSize: 11, lineHeight: 17 },
  notes: { minHeight: 104 },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  column: { flex: 1, minWidth: 220 },
  confirmRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', borderColor: colors.accent, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.accent },
  confirmText: { color: colors.silver, flex: 1, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  successBox: { alignItems: 'flex-start', gap: spacing.md },
  success: { color: colors.success, fontSize: 12, fontWeight: '800', lineHeight: 19 },
});
