import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { isoDateToAustralian, todayAustralianDate } from '@/lib/australian-date';
import type { BookingRequestRow } from '@/lib/database.types';
import { confirmBankTransferPayment, reviewBookingRequest, type StaffBookingReviewInput } from '@/lib/staff-portal';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { useStaffDiscardConfirmation } from '@/hooks/use-staff-discard-confirmation';

type ReviewAction = StaffBookingReviewInput['action'];

export function StaffBookingReview({ booking, onRefresh, onDirtyChange, onBusyChange, previewMode = false }: {
  booking: BookingRequestRow;
  onRefresh: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  previewMode?: boolean;
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
    if (previewMode || !action || !confirmed || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await reviewBookingRequest({ action, approvedDate, bookingId: booking.id, staffNote });
      setConfirmed(false);
      setSavedReview({ approvedDate, staffNote });
      setFeedback({
        kind: 'success',
        text: action === 'approve_date'
          ? 'Date approved. The booking remains unconfirmed until payment is verified.'
          : action === 'propose_date'
            ? 'Alternative date proposed. The customer still needs to accept it.'
            : 'Booking request cancelled.',
      });
    } catch (error) {
      setFeedback({ kind: 'error', text: reviewErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const confirmBankTransfer = async () => {
    if (previewMode || !bankChecked || busy || REVIEW_ENVIRONMENT.enabled) return;
    setBusy(true);
    setFeedback(null);
    try {
      await confirmBankTransferPayment(booking.id, bankReference);
      setFeedback({ kind: 'success', text: 'Bank transfer verified. Booking confirmed and customer confirmation queued.' });
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
        <Text style={styles.title}>{feedback?.kind === 'success' ? 'Booking updated' : bankOpen ? 'Verify bank transfer' : action === 'approve_date' ? 'Approve date' : action === 'propose_date' ? 'Propose another date' : action === 'cancel' ? 'Cancel request' : 'Booking actions'}</Text>
        {(action || bankOpen) && feedback?.kind !== 'success' ? (
          <Pressable accessibilityLabel="Close booking review" accessibilityRole="button" disabled={busy} onPress={close} style={styles.close}>
            <Ionicons color={colors.white} name="close" size={20} />
          </Pressable>
        ) : null}
      </View>
      {previewMode ? <Text style={styles.bankCopy}>Preview only · Try the review steps. Changes and payments cannot be submitted.</Text> : null}

      {feedback?.kind === 'success' ? (
        <View style={styles.successBox}>
          <Text accessibilityRole="alert" style={styles.success}>{feedback.text}</Text>
          <PrimaryButton label="Refresh booking" onPress={onRefresh} />
        </View>
      ) : !action ? (
        <View style={styles.actions}>
          {!bankOpen ? <>
            {booking.state !== 'date_approved' ? <PrimaryButton disabled={busy} label={booking.state === 'date_proposed' ? 'Approve proposed date' : 'Approve requested date'} onPress={() => chooseAction('approve_date')} /> : !REVIEW_ENVIRONMENT.enabled ? <PrimaryButton disabled={busy} label="Verify bank transfer" onPress={() => { setBankOpen(true); setFeedback(null); }} /> : null}
            <PrimaryButton disabled={busy} label="Propose another date" onPress={() => chooseAction('propose_date')} variant="outline" />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => chooseAction('cancel')} style={styles.secondaryAction}><Text style={styles.cancelText}>Cancel request</Text></Pressable>
          </> : null}
          {booking.state === 'date_approved' && !REVIEW_ENVIRONMENT.enabled && bankOpen ? (
            <View style={styles.bankVerification}>
              <Text style={styles.bankCopy}>Match the cleared amount and PSI reference in the business bank statement.</Text>
              <Field hint="Bank transaction/reference shown on the statement" label="Transaction reference">
                <FormInput editable={!busy} autoCapitalize="characters" maxLength={80} onChangeText={(value) => { setBankReference(value); setBankChecked(false); }} value={bankReference} />
              </Field>
              <Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: bankChecked, disabled: busy }} onPress={() => setBankChecked((value) => !value)} style={styles.confirmRow}>
                <View style={[styles.checkbox, bankChecked && styles.checkboxChecked]}>{bankChecked ? <Ionicons color={colors.ink} name="checkmark" size={16} /> : null}</View>
                <Text style={styles.confirmText}>I matched the cleared deposit amount, customer payment reference and this booking in PSI’s bank statement.</Text>
              </Pressable>
              <PrimaryButton disabled={previewMode || !bankChecked || bankReference.trim().length < 6} label={previewMode ? 'Preview only · Confirm bank transfer' : 'Confirm bank transfer'} loading={busy} onPress={() => void confirmBankTransfer()} />
            </View>
          ) : null}
          {feedback ? <Text accessibilityRole="alert" style={styles.error}>{feedback.text}</Text> : null}
        </View>
      ) : (
        <>
          {action !== 'cancel' ? (
            <Field hint="DD/MM/YYYY" label={action === 'approve_date' ? 'Approved date' : 'Proposed date'}>
              <FormInput editable={!busy} keyboardType="numbers-and-punctuation" maxLength={10} onChangeText={(value) => { setApprovedDate(value); setConfirmed(false); }} value={approvedDate} />
            </Field>
          ) : null}
          <Field hint={action === 'cancel' ? 'Required' : 'Optional · visible to the customer'} label={action === 'cancel' ? 'Cancellation reason' : 'Customer note'}>
            <FormInput editable={!busy} multiline numberOfLines={3} onChangeText={(value) => { setStaffNote(value); setConfirmed(false); }} placeholder={action === 'cancel' ? 'Reason for cancellation' : 'Date or arrival details to discuss'} style={styles.notes} textAlignVertical="top" value={staffNote} />
          </Field>
          <Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: busy }} onPress={() => setConfirmed((value) => !value)} style={styles.confirmRow}>
            <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>{confirmed ? <Ionicons color={colors.ink} name="checkmark" size={16} /> : null}</View>
            <Text style={styles.confirmText}>{action === 'approve_date'
              ? 'I checked workshop capacity and this date. Payment is still required to confirm the booking.'
              : action === 'propose_date'
                ? 'I checked this alternative date. The customer still needs to accept it.'
                : 'I checked the request and cancellation reason.'}</Text>
          </Pressable>
          {feedback ? <Text accessibilityRole="alert" style={styles.error}>{feedback.text}</Text> : null}
          <PrimaryButton disabled={previewMode || !confirmed || (action === 'cancel' && !staffNote.trim())} label={previewMode ? `Preview only · ${actionLabel(action)}` : actionLabel(action)} loading={busy} onPress={() => void submit()} />
        </>
      )}
    </View>
  );
}

function actionLabel(action: ReviewAction) {
  if (action === 'approve_date') return 'Approve date';
  if (action === 'propose_date') return 'Propose date';
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
  workspace: { borderTopWidth: 1, borderTopColor: colors.line, gap: spacing.md, marginTop: spacing.md, paddingTop: spacing.md },
  heading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  title: { flex: 1, color: colors.white, fontSize: 16, fontWeight: '700' },
  close: { alignItems: 'center', minHeight: 44, justifyContent: 'center', width: 44 },
  actions: { gap: spacing.sm },
  secondaryAction: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  cancelText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  bankVerification: { gap: spacing.md },
  bankCopy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  notes: { minHeight: 88 },
  confirmRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', borderColor: colors.accent, borderWidth: 1, borderRadius: 4, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.accent },
  confirmText: { color: colors.silver, flex: 1, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  successBox: { gap: spacing.md },
  success: { color: colors.success, fontSize: 13, lineHeight: 19 },
});
