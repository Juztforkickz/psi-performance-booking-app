import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, mobileFrame, spacing } from '@/constants/brand';
import { isoDateToAustralian, todayAustralianDate } from '@/lib/australian-date';
import type { BookingRequestRow } from '@/lib/database.types';
import { confirmBankTransferPayment, reviewBookingRequest, type StaffBookingReviewInput } from '@/lib/staff-portal';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { useStaffDiscardConfirmation } from '@/hooks/use-staff-discard-confirmation';

type ReviewAction = StaffBookingReviewInput['action'];

export function StaffBookingReview({ booking, onRefresh, onDirtyChange, onBusyChange }: {
  booking: BookingRequestRow;
  onRefresh: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { confirmDiscard, discardDialog } = useStaffDiscardConfirmation();
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [approvedDate, setApprovedDate] = useState(isoDateToAustralian(booking.approved_date ?? booking.preferred_date) || todayInSydney());
  const [staffNote, setStaffNote] = useState(booking.staff_note ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [bankReference, setBankReference] = useState('');
  const [bankChecked, setBankChecked] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [savedReview, setSavedReview] = useState(() => ({ approvedDate, staffNote }));
  const reviewDirty = approvedDate !== savedReview.approvedDate || staffNote !== savedReview.staffNote || confirmed;
  const bankDirty = !!bankReference || bankChecked;
  const dirty = reviewDirty || bankDirty;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onBusyChange?.(false); }, [onDirtyChange, onBusyChange]);

  if (!['pending_staff_review', 'date_proposed', 'date_approved'].includes(booking.state)) return null;

  const chooseAction = (next: ReviewAction) => {
    if (busy) return;
    setAction(next);
    setConfirmed(false);
    setFeedback(null);
  };

  const close = () => {
    if (busy) return;
    const discard = () => {
      if (bankOpen) { setBankReference(''); setBankChecked(false); setBankOpen(false); }
      else {
        setApprovedDate(savedReview.approvedDate); setStaffNote(savedReview.staffNote);
        setConfirmed(false); setAction(null);
      }
      setFeedback(null);
    };
    if (!(bankOpen ? bankDirty : reviewDirty)) { discard(); return; }
    confirmDiscard(discard);
  };

  const submit = async () => {
    if (!action || !confirmed || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await reviewBookingRequest({ action, approvedDate, bookingId: booking.id, staffNote });
      setConfirmed(false);
      setSavedReview({ approvedDate, staffNote });
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

  const confirmBankTransfer = async () => {
    if (!bankChecked || busy || REVIEW_ENVIRONMENT.enabled) return;
    setBusy(true);
    setFeedback(null);
    try {
      await confirmBankTransferPayment(booking.id, bankReference);
      setFeedback({ kind: 'success', text: 'Cleared bank transfer verified. The booking is confirmed and confirmation delivery has been queued.' });
      setBankChecked(false);
      setBankReference('');
      setBankOpen(false);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      setFeedback({ kind: 'error', text: detail.includes('not_found')
        ? 'This customer has not selected bank transfer for this booking.'
        : 'The transfer was not recorded. Recheck the bank statement, reference and protected staff session.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.workspace}>
      {discardDialog}
      <View style={styles.heading}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>{REVIEW_ENVIRONMENT.enabled ? 'Sandbox booking' : 'Booking actions'}</Text>
          <Text style={styles.title}>Workshop decision</Text>
        </View>
        {(action || bankOpen) && feedback?.kind !== 'success' ? (
          <Pressable accessibilityLabel="Close booking review" accessibilityRole="button" disabled={busy} onPress={close} style={styles.close}>
            <Ionicons color={colors.white} name="close" size={20} />
          </Pressable>
        ) : null}
      </View>

      {!action ? (
        <View style={styles.actions}>
          {!bankOpen ? <>
            <PrimaryButton disabled={busy} label="Approve requested date" onPress={() => chooseAction('approve_date')} variant="outline" />
            <PrimaryButton disabled={busy} label="Propose another date" onPress={() => chooseAction('propose_date')} variant="outline" />
            <PrimaryButton disabled={busy} label="Cancel request" onPress={() => chooseAction('cancel')} variant="outline" />
          </> : null}
          {booking.state === 'date_approved' && !REVIEW_ENVIRONMENT.enabled ? (
            !bankOpen ? <PrimaryButton disabled={busy} label="Verify bank transfer" onPress={() => { setBankOpen(true); setFeedback(null); }} variant="outline" /> :
            <View style={styles.bankVerification}>
              <Text style={styles.bankTitle}>Verify cleared bank transfer</Text>
              <Text style={styles.bankCopy}>Use only after matching the exact amount and PSI reference in the business bank statement.</Text>
              <Field hint="Bank transaction/reference shown on the statement" label="Transaction reference">
                <FormInput editable={!busy} autoCapitalize="characters" maxLength={80} onChangeText={(value) => { setBankReference(value); setBankChecked(false); }} value={bankReference} />
              </Field>
              <Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: bankChecked, disabled: busy }} onPress={() => setBankChecked((value) => !value)} style={styles.confirmRow}>
                <View style={[styles.checkbox, bankChecked && styles.checkboxChecked]}>{bankChecked ? <Ionicons color={colors.ink} name="checkmark" size={16} /> : null}</View>
                <Text style={styles.confirmText}>I matched the cleared deposit amount, customer payment reference and this booking in PSI’s bank statement.</Text>
              </Pressable>
              <PrimaryButton disabled={!bankChecked || bankReference.trim().length < 6} label="Confirm verified transfer" loading={busy} onPress={() => void confirmBankTransfer()} />
              <PrimaryButton disabled={busy} label="Cancel verification" onPress={close} variant="outline" />
            </View>
          ) : null}
          {feedback ? <Text accessibilityRole="alert" style={feedback.kind === 'error' ? styles.error : styles.success}>{feedback.text}</Text> : null}
          {feedback?.kind === 'success' ? <PrimaryButton label="Refresh booking" onPress={onRefresh} variant="outline" /> : null}
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
            <Field hint="DD/MM/YYYY · PSI workshop date" label={action === 'approve_date' ? 'Approved date' : 'Proposed date'}>
              <FormInput editable={!busy} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(value) => { setApprovedDate(value); setConfirmed(false); }} value={approvedDate} />
            </Field>
          ) : null}
          <Field hint={action === 'cancel' ? 'Required for the audit record' : 'Optional · visible in the customer booking status'} label="PSI note">
            <FormInput editable={!busy} multiline numberOfLines={3} onChangeText={(value) => { setStaffNote(value); setConfirmed(false); }} placeholder={action === 'cancel' ? 'Reason for cancellation' : 'Date or arrival details to discuss'} style={styles.notes} textAlignVertical="top" value={staffNote} />
          </Field>
          <Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: busy }} onPress={() => setConfirmed((value) => !value)} style={styles.confirmRow}>
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
  return todayAustralianDate('Australia/Sydney');
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  workspace: { ...mobileFrame, backgroundColor: colors.inkSoft, gap: spacing.md, marginTop: spacing.md, padding: spacing.md },
  heading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  kicker: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 18, fontWeight: '900', marginTop: 2 },
  close: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  actions: { gap: spacing.sm },
  bankVerification: { borderTopColor: colors.mutedDark, borderTopWidth: 1, gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.md },
  bankTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  bankCopy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  notes: { minHeight: 88 },
  confirmRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', borderColor: colors.accent, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.accent },
  confirmText: { color: colors.silver, flex: 1, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '800', lineHeight: 18 },
  successBox: { alignItems: 'flex-start', gap: spacing.md },
  success: { color: colors.success, fontSize: 12, fontWeight: '800', lineHeight: 19 },
});
