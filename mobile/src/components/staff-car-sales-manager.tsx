import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { useStaffDiscardConfirmation } from '@/hooks/use-staff-discard-confirmation';
import {
  createCustomerCarListing,
  formatAud,
  formatKilometres,
  loadStaffCustomerCarListings,
  retryCustomerCarSaleNotifications,
  setCustomerCarListingStatus,
  updateCustomerCarListing,
  type CustomerCarListingDraft,
} from '@/lib/customer-cars-for-sale';
import type { CustomerCarListingRow } from '@/lib/database.types';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';

const EMPTY_FORM = {
  highlights: '',
  kilometres: '',
  price: '',
  registration: '',
  summary: '',
  title: '',
  transmission: '',
};

export function StaffCarSalesManager({ onBusyChange, onDirtyChange }: {
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
} = {}) {
  const { confirmDiscard, discardDialog } = useStaffDiscardConfirmation();
  const [listings, setListings] = useState<CustomerCarListingRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const dirty = formOpen && JSON.stringify(form) !== JSON.stringify(savedForm);
  const busy = Boolean(busyAction);
  const editing = useMemo(() => listings.find((listing) => listing.id === editingId), [editingId, listings]);

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onBusyChange?.(false); }, [onBusyChange, onDirtyChange]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setListings(await loadStaffCustomerCarListings());
    } catch {
      setFeedback({ error: true, text: 'Car sale listings could not be loaded. Refresh and try again.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSavedForm(EMPTY_FORM);
    setEditingId('');
    setFormOpen(false);
  };

  const openNew = () => {
    resetForm();
    setFeedback(null);
    setFormOpen(true);
  };

  const openEdit = (listing: CustomerCarListingRow) => {
    const next = {
      highlights: listing.highlights.join('\n'),
      kilometres: String(listing.kilometres),
      price: (listing.asking_price_cents / 100).toFixed(0),
      registration: listing.registration,
      summary: listing.summary,
      title: listing.title,
      transmission: listing.transmission,
    };
    setForm(next);
    setSavedForm(next);
    setEditingId(listing.id);
    setFormOpen(true);
    setFeedback(null);
  };

  const closeForm = () => {
    if (busy) return;
    const discard = () => { resetForm(); setFeedback(null); };
    if (!dirty) { discard(); return; }
    confirmDiscard(discard);
  };

  const saveNew = async (publish: boolean) => {
    if (busy) return;
    setBusyAction(publish ? 'create-publish' : 'create-draft');
    setFeedback(null);
    try {
      await createCustomerCarListing(formDraft(form), publish);
      resetForm();
      setFeedback({ error: false, text: publish ? 'Listing published. App alerts are queued and opted in emails are being delivered.' : 'Private draft saved. No customer was notified.' });
      await refresh();
    } catch (error) {
      setFeedback({ error: true, text: listingErrorMessage(error) });
    } finally {
      setBusyAction('');
    }
  };

  const saveChanges = async () => {
    if (!editingId || busy) return;
    setBusyAction('save');
    setFeedback(null);
    try {
      await updateCustomerCarListing(editingId, formDraft(form));
      resetForm();
      setFeedback({ error: false, text: 'Listing changes saved.' });
      await refresh();
    } catch (error) {
      setFeedback({ error: true, text: listingErrorMessage(error) });
    } finally {
      setBusyAction('');
    }
  };

  const changeStatus = async (listing: CustomerCarListingRow, status: 'published' | 'sold' | 'under_offer' | 'withdrawn') => {
    if (busy) return;
    setBusyAction(`${status}:${listing.id}`);
    setFeedback(null);
    try {
      await setCustomerCarListingStatus(listing.id, status);
      resetForm();
      setFeedback({ error: false, text: status === 'published' ? 'Listing published. Each customer receives no more than one alert for this listing.' : `Listing marked ${statusLabel(status).toLowerCase()}.` });
      await refresh();
    } catch {
      setFeedback({ error: true, text: 'The listing status was not changed. Check the protected staff session and try again.' });
    } finally {
      setBusyAction('');
    }
  };

  const retryDelivery = async (listing: CustomerCarListingRow) => {
    if (busy) return;
    setBusyAction(`retry:${listing.id}`);
    setFeedback(null);
    try {
      await retryCustomerCarSaleNotifications(listing.id);
      setFeedback({ error: false, text: 'Waiting app alerts and opted in emails were checked. Duplicate notices were not created.' });
    } catch {
      setFeedback({ error: true, text: 'Delivery could not be checked. The saved queues remain safe to retry.' });
    } finally {
      setBusyAction('');
    }
  };

  return <View style={styles.workspace}>
    {discardDialog}
    {feedback ? <Text accessibilityRole={feedback.error ? 'alert' : undefined} style={feedback.error ? styles.error : styles.success}>{feedback.text}</Text> : null}
    {formOpen ? <View style={styles.formCard}>
      <View style={styles.headingRow}>
        <View style={styles.flex}>
          <Text style={styles.heading}>{editingId ? 'Edit car listing' : 'New car listing'}</Text>
          <Text style={styles.copy}>{REVIEW_ENVIRONMENT.enabled ? 'Preview only. No live alert or email is sent.' : editing?.status === 'published' ? 'Saving edits updates the listing without sending a second launch alert.' : 'Drafts stay private. Publishing creates one customer alert per account.'}</Text>
        </View>
        <Pressable accessibilityLabel="Close listing form" accessibilityRole="button" disabled={busy} onPress={closeForm} style={styles.iconButton}><Ionicons color={colors.muted} name="close" size={22} /></Pressable>
      </View>
      <Field label="Vehicle title"><FormInput editable={!busy} maxLength={100} onChangeText={(title) => setForm((current) => ({ ...current, title }))} placeholder="2018 HSV GTSR" value={form.title} /></Field>
      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}><Field label="Registration"><FormInput autoCapitalize="characters" editable={!busy} maxLength={16} onChangeText={(registration) => setForm((current) => ({ ...current, registration }))} placeholder="ABC123" value={form.registration} /></Field></View>
        <View style={styles.fieldHalf}><Field label="Transmission"><FormInput editable={!busy} maxLength={40} onChangeText={(transmission) => setForm((current) => ({ ...current, transmission }))} placeholder="Automatic" value={form.transmission} /></Field></View>
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}><Field label="Price" hint="AUD"><FormInput editable={!busy} keyboardType="number-pad" onChangeText={(price) => setForm((current) => ({ ...current, price }))} placeholder="85000" value={form.price} /></Field></View>
        <View style={styles.fieldHalf}><Field label="Kilometres"><FormInput editable={!busy} keyboardType="number-pad" onChangeText={(kilometres) => setForm((current) => ({ ...current, kilometres }))} placeholder="72000" value={form.kilometres} /></Field></View>
      </View>
      <Field label="Listing summary"><FormInput editable={!busy} maxLength={1000} multiline onChangeText={(summary) => setForm((current) => ({ ...current, summary }))} placeholder="Condition, ownership and PSI history" style={styles.textArea} textAlignVertical="top" value={form.summary} /></Field>
      <Field label="Highlights" hint="One item per line, up to six"><FormInput editable={!busy} maxLength={720} multiline onChangeText={(highlights) => setForm((current) => ({ ...current, highlights }))} placeholder={'PSI workshop history available\nIndependent inspection welcomed'} style={styles.textArea} textAlignVertical="top" value={form.highlights} /></Field>
      {editingId ? <View style={styles.actions}>
        <PrimaryButton disabled={busy || !dirty} label="Save changes" loading={busyAction === 'save'} onPress={() => void saveChanges()} />
        {editing?.status === 'draft' ? <PrimaryButton disabled={busy || dirty} label="Publish and notify customers" loading={busyAction === `published:${editingId}`} onPress={() => void changeStatus(editing, 'published')} variant="outline" /> : null}
        {editing?.status === 'published' ? <PrimaryButton disabled={busy || dirty} label="Mark under offer" loading={busyAction === `under_offer:${editingId}`} onPress={() => void changeStatus(editing, 'under_offer')} variant="outline" /> : null}
        {editing?.status === 'under_offer' ? <PrimaryButton disabled={busy || dirty} label="Return to available" loading={busyAction === `published:${editingId}`} onPress={() => void changeStatus(editing, 'published')} variant="outline" /> : null}
        {editing && ['published', 'under_offer'].includes(editing.status) ? <PrimaryButton disabled={busy || dirty} label="Retry waiting alerts and emails" loading={busyAction === `retry:${editingId}`} onPress={() => void retryDelivery(editing)} variant="outline" /> : null}
        {editing && ['published', 'under_offer'].includes(editing.status) ? <PrimaryButton disabled={busy || dirty} label="Mark sold" loading={busyAction === `sold:${editingId}`} onPress={() => void changeStatus(editing, 'sold')} variant="outline" /> : null}
        {editing && !['sold', 'withdrawn'].includes(editing.status) ? <PrimaryButton disabled={busy || dirty} label="Withdraw listing" loading={busyAction === `withdrawn:${editingId}`} onPress={() => void changeStatus(editing, 'withdrawn')} variant="outline" /> : null}
        {dirty ? <Text style={styles.copy}>Save changes before changing the listing status.</Text> : null}
      </View> : <View style={styles.actions}>
        <PrimaryButton disabled={busy} label="Save private draft" loading={busyAction === 'create-draft'} onPress={() => void saveNew(false)} />
        <PrimaryButton disabled={busy} label="Publish and notify customers" loading={busyAction === 'create-publish'} onPress={() => void saveNew(true)} variant="outline" />
      </View>}
    </View> : <>
      <PrimaryButton disabled={busy} label="Create car listing" onPress={openNew} />
      <View style={styles.listHeader}><Text style={styles.heading}>Car sale listings</Text><Pressable accessibilityLabel="Refresh car sale listings" accessibilityRole="button" disabled={loading || busy} onPress={() => void refresh()} style={styles.iconButton}>{loading ? <ActivityIndicator color={colors.accent} size="small" /> : <Ionicons color={colors.accent} name="refresh" size={20} />}</Pressable></View>
      {!loading && listings.length === 0 ? <Text style={styles.empty}>No listings yet.</Text> : listings.map((listing) => <Pressable accessibilityLabel={`Open ${listing.title}`} accessibilityRole="button" disabled={busy} key={listing.id} onPress={() => openEdit(listing)} style={({ pressed }) => [styles.listingCard, pressed && styles.pressed]}>
        <View style={styles.headingRow}><View style={styles.flex}><Text style={styles.listingTitle}>{listing.title}</Text><Text style={styles.listingPrice}>{formatAud(listing.asking_price_cents)}</Text><Text style={styles.copy}>{listing.registration} · {formatKilometres(listing.kilometres)} · {statusLabel(listing.status)}</Text></View><Ionicons color={colors.accent} name="chevron-forward" size={20} /></View>
      </Pressable>)}
    </>}
  </View>;
}

function formDraft(form: typeof EMPTY_FORM): CustomerCarListingDraft {
  const price = Number(form.price.replace(/[^0-9.]/gu, ''));
  const kilometres = Number(form.kilometres.replace(/[^0-9]/gu, ''));
  return {
    askingPriceCents: Math.round(price * 100),
    highlights: form.highlights.split(/\r?\n/gu),
    kilometres,
    registration: form.registration,
    summary: form.summary,
    title: form.title,
    transmission: form.transmission,
  };
}

function statusLabel(status: CustomerCarListingRow['status']) {
  if (status === 'under_offer') return 'Under offer';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function listingErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('TITLE')) return 'Add a clear vehicle title of 100 characters or fewer.';
  if (message.includes('REGISTRATION')) return 'Add the vehicle registration.';
  if (message.includes('PRICE')) return 'Add the asking price in Australian dollars.';
  if (message.includes('KILOMETRES')) return 'Add the current kilometres.';
  if (message.includes('TRANSMISSION')) return 'Add the transmission.';
  if (message.includes('SUMMARY')) return 'Add a concise listing summary.';
  if (message.includes('HIGHLIGHTS')) return 'Add between one and six highlights, one per line.';
  return 'The listing was not saved. Check every field and try again.';
}

const styles = StyleSheet.create({
  workspace: { gap: spacing.md },
  formCard: { gap: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  heading: { color: colors.white, fontSize: 16, fontWeight: '700' },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  iconButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fieldHalf: { flex: 1, minWidth: 150 },
  textArea: { minHeight: 96, paddingTop: spacing.sm },
  actions: { gap: spacing.sm },
  success: { color: colors.success, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  listingCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.panel, padding: spacing.md },
  listingTitle: { color: colors.white, fontSize: 15, fontWeight: '700' },
  listingPrice: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingVertical: spacing.sm },
  pressed: { opacity: .72 },
});
