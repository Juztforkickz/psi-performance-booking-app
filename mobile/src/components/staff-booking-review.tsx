import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import type { BookingRequestRow } from '@/lib/database.types';
import { reviewBookingRequest, type StaffBookingReviewInput } from '@/lib/staff-portal';

type ReviewAction = StaffBookingReviewInput['action'];

export function StaffBookingReview({ booking, onRefresh }: { booking: BookingRequestRow; onRefresh: () => void }) {
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [approvedDate, setApprovedDate] = useState(booking.approved_date ?? booking.preferred_date ?? todayInSydney());
  const [staffNote, setStaffNote] = useState(booking.staff_note ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  if (!['pending_staff_review', 'date_proposed', 'date_approved'].includes(booking.state)) return null;

  const chooseAction = (next: ReviewAction) => {
    setAction(next);
    setConfirmed(false);
    setFeedback(null);
  };

  const submit = async () => {
    if (!action || !confirmed || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await reviewBookingRequest({ action, approvedDate, bookingId: booking.id, staffNote });
      setConfirmed(false);
      setFeedback({
        kind: 'success',
        text: action === 'approve_date'
          ? 'Workshop date approved. No payment, confirmation email or Calendar event has been created yet.'
          : action === 'propose_date'
            ? 'Alternative workshop date recorded for customer contact. It is not a confirmed booking.'
            : 'Request cancelled in the protected queue. No customer email has been claimed.',
      });
    } catch (error) {
      setFeedback({ kind: 'error', text: reviewErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.workspace}>
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>MFA-protected review</Text>
          <Text style={styles.title}>Workshop decision</Text>
        </View>
        {action && feedback?.kind !== 'success' ? (
          <Pressable accessibilityLabel="Close booking review" accessibilityRole="button" onPress={() => setAction(null)} style={styles.close}>
            <Ionicons color={colors.white} name="close" size={20} />
          </Pressable>
        ) : null}
      </View>

      {!action ? (
        <View style={styles.actions}>
          <PrimaryButton label="Approve requested date" onPress={() => chooseAction('approve_date')} variant="outline" />
          <PrimaryButton label="Propose another date" onPress={() => chooseAction('propose_date')} variant="outline" />
          <PrimaryButton label="Cancel request" onPress={() => chooseAction('cancel')} variant="outline" />
        </View>
      ) : feedback?.kind === 'success' ? (
        <View style={styles.successBox}>
          <Ionicons color={colors.success} name="checkmark-circle" size={25} />
          <Text accessibilityRole="alert" style={styles.success}>{feedback.text}</Text>
          <PrimaryButton label="Refresh booking queue" onPress={onRefresh} />
        </View>
      ) : (
        <>
          {action !== 'cancel' ? (
            <Field hint="YYYY-MM-DD · PSI workshop date" label={action === 'approve_date' ? 'Approved date' : 'Proposed date'}>
              <FormInput keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(value) => { setApprovedDate(value); setConfirmed(false); }} value={approvedDate} />
            </Field>
          ) : null}
          <Field hint={action === 'cancel' ? 'Required for the audit record' : 'Optional · visible in the customer booking status'} label="PSI note">
            <FormInput multiline numberOfLines={3} onChangeText={(value) => { setStaffNote(value); setConfirmed(false); }} placeholder={action === 'cancel' ? 'Reason for cancellation' : 'Date or arrival details to discuss'} style={styles.notes} textAlignVertical="top" value={staffNote} />
          </Field>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed((value) => !value)} style={styles.confirmRow}>
            <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>{confirmed ? <Ionicons color={colors.ink} name="checkmark" size={16} /> : null}</View>
            <Text style={styles.confirmText}>{action === 'approve_date'
              ? 'I checked workshop capacity and this date. Record it as date approved, without claiming payment or final confirmation.'
              : action === 'propose_date'
                ? 'I checked this alternative date. Record it as a proposal that still requires customer contact.'
                : 'I checked the request and cancellation note. Cancel this request without claiming an email was sent.'}</Text>
          </Pressable>
          {feedback ? <Text accessibilityRole="alert" style={styles.error}>{feedback.text}</Text> : null}
          <PrimaryButton disabled={!confirmed || (action === 'cancel' && !staffNote.trim())} label={actionLabel(action)} loading={busy} onPress={() => void submit()} />
        </>
      )}
    </View>
  );
}

function actionLabel(action: ReviewAction) {
  if (action === 'approve_date') return 'Confirm date approval';
  if (action === 'propose_date') return 'Record proposed date';
  return 'Confirm cancellation';
}

function reviewErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : `${(error as { message?: string } | null)?.message ?? ''}`;
  if (detail.includes('AAL2') || detail.toLowerCase().includes('staff')) return 'Your protected staff session needs authenticator verification again. Re-open the staff portal.';
  if (detail.includes('DATE_INVALID') || detail.toLowerCase().includes('date') || detail.toLowerCase().includes('monday')) return 'Choose a valid future workshop date. Service uses Monday–Friday; dyno uses Monday, Wednesday or Thursday.';
  if (detail.includes('CANCELLATION_NOTE_REQUIRED')) return 'Add a reason before cancelling this request.';
  if (detail.toLowerCase().includes('transition')) return 'This request changed or can no longer take that action. Refresh the queue before retrying.';
  return 'The booking was not changed and no notification is being claimed. Refresh the protected queue and try again.';
}

function todayInSydney() {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Australia/Sydney',
    year: 'numeric',
  }).format(new Date());
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  workspace: { ...mobileFrame, backgroundColor: colors.inkSoft, gap: spacing.md, marginTop: spacing.md, padding: spacing.md },
  heading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  kicker: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 18, fontWeight: '900', marginTop: 2 },
  close: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  actions: { gap: spacing.sm },
  notes: { minHeight: 88 },
  confirmRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', borderColor: colors.gold, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.gold },
  confirmText: { color: colors.cream, flex: 1, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  successBox: { alignItems: 'flex-start', gap: spacing.md },
  success: { color: colors.success, fontSize: 12, fontWeight: '800', lineHeight: 19 },
});
