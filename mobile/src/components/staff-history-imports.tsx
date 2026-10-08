import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Field, FormInput, PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { formatAustralianDateTime } from '@/lib/australian-date';
import type { CustomerProfileRow, CustomerVehicleRow, HistoricalImportRequestRow } from '@/lib/database.types';
import { reviewHistoryImportRequest } from '@/lib/history-import';

type Filter = 'new' | 'progress' | 'completed';

export function StaffHistoryImports({ customers, focusId, onRefresh, requests, vehicles }: {
  customers: CustomerProfileRow[];
  focusId?: string;
  onRefresh: () => void;
  requests: HistoricalImportRequestRow[];
  vehicles: CustomerVehicleRow[];
}) {
  const initialFilter: Filter = requests.find((item) => item.id === focusId)?.status === 'completed' ? 'completed'
    : requests.find((item) => item.id === focusId)?.status === 'in_progress' || requests.find((item) => item.id === focusId)?.status === 'needs_information' ? 'progress' : 'new';
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [selectedId, setSelectedId] = useState(focusId ?? '');
  const [note, setNote] = useState('');
  const [itemCount, setItemCount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const queues = useMemo(() => ({
    new: requests.filter((item) => item.payment_status === 'paid' && item.status === 'paid'),
    progress: requests.filter((item) => ['in_progress', 'needs_information'].includes(item.status)),
    completed: requests.filter((item) => item.status === 'completed'),
  }), [requests]);
  const visible = queues[filter];
  const selected = requests.find((item) => item.id === selectedId);

  const customerName = (id: string) => {
    const customer = customers.find((item) => item.user_id === id);
    return customer ? `${customer.first_name} ${customer.last_name}`.trim() || customer.email : 'Customer unavailable';
  };
  const vehicleName = (id: string) => {
    const vehicle = vehicles.find((item) => item.id === id);
    return vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'Vehicle unavailable';
  };

  const update = async (status: 'completed' | 'in_progress' | 'needs_information') => {
    if (!selected) return;
    const parsedCount = Number(itemCount);
    if (status === 'completed' && (!Number.isInteger(parsedCount) || parsedCount < 1)) {
      setNotice('Enter how many verified items were added before completing the request.');
      return;
    }
    if (status === 'needs_information' && !note.trim()) {
      setNotice('Add the exact information PSI needs from the customer.');
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await reviewHistoryImportRequest({ importedItemCount: status === 'completed' ? parsedCount : selected.imported_item_count, requestId: selected.id, staffNote: note, status });
      setNotice(status === 'completed' ? 'Import completed. The customer has been notified.' : status === 'needs_information' ? 'The customer has been notified that PSI needs more information.' : 'The request is now in progress.');
      setSelectedId('');
      setNote('');
      setItemCount('0');
      onRefresh();
    } catch {
      setNotice('The request could not be updated. Confirm your authenticator session and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (selected) return <View style={styles.stack}>
    <Pressable accessibilityRole="button" onPress={() => { setSelectedId(''); setNotice(''); }} style={styles.back}><Ionicons color={colors.accent} name="chevron-back" size={20} /><Text style={styles.link}>All history import requests</Text></Pressable>
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PAID AUD $199</Text>
      <Text style={styles.title}>{customerName(selected.customer_id)}</Text>
      <Text style={styles.copy}>{vehicleName(selected.vehicle_id)}</Text>
      <Text style={styles.meta}>Received {formatAustralianDateTime(selected.paid_at ?? selected.created_at)} · {selected.status.replaceAll('_', ' ')}</Text>
      {selected.previous_details ? <View style={styles.note}><Text style={styles.eyebrow}>CUSTOMER DETAILS</Text><Text style={styles.copy}>{selected.previous_details}</Text></View> : null}
      {selected.status === 'completed' ? <>
        <Text style={styles.copy}>PSI added {selected.imported_item_count} verified item{selected.imported_item_count === 1 ? '' : 's'} to this vehicle archive.</Text>
        {selected.staff_note ? <View style={styles.note}><Text style={styles.eyebrow}>PSI NOTE</Text><Text style={styles.copy}>{selected.staff_note}</Text></View> : null}
      </> : <>
        <Field hint="Shown to the customer when more information is needed" label="PSI note"><FormInput multiline maxLength={2000} onChangeText={setNote} placeholder="Progress note or information required" value={note} /></Field>
        <Field hint="Required when completing the import" label="Verified items added"><FormInput keyboardType="number-pad" maxLength={4} onChangeText={(value) => setItemCount(value.replace(/\D/g, ''))} value={itemCount} /></Field>
        <PrimaryButton disabled={busy} label="Start PSI review" onPress={() => void update('in_progress')} />
        <PrimaryButton disabled={busy} label="Request more information" onPress={() => void update('needs_information')} variant="outline" />
        <PrimaryButton loading={busy} label="Complete history import" onPress={() => void update('completed')} />
      </>}
      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
    </View>
  </View>;

  return <View style={styles.stack}>
    <Text style={styles.copy}>Paid requests remain here until PSI finishes locating, verifying and publishing the customer’s older vehicle history.</Text>
    <View accessibilityRole="tablist" style={styles.tabs}>
      {(['new', 'progress', 'completed'] as const).map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.tab, filter === value && styles.tabActive]}><Text style={[styles.tabText, filter === value && styles.tabTextActive]}>{value === 'new' ? 'New' : value === 'progress' ? 'In progress' : 'Completed'} {queues[value].length}</Text></Pressable>)}
    </View>
    {visible.map((request) => <Pressable key={request.id} accessibilityRole="button" onPress={() => { setSelectedId(request.id); setNote(request.staff_note ?? ''); setItemCount(String(request.imported_item_count)); setNotice(''); }} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}><View style={styles.flex}><Text style={styles.title}>{customerName(request.customer_id)}</Text><Text style={styles.copy}>{vehicleName(request.vehicle_id)}</Text></View><Text style={styles.badge}>{request.status.replaceAll('_', ' ')}</Text></View>
      <Text style={styles.meta}>AUD $199 paid · {formatAustralianDateTime(request.paid_at ?? request.created_at)}</Text>
    </Pressable>)}
    {visible.length === 0 ? <View style={styles.card}><Text style={styles.copy}>No requests in this stage.</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  tabs: { flexDirection: 'row', gap: spacing.xs },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 4 },
  tabActive: { borderColor: colors.accent, backgroundColor: colors.noticeSurface },
  tabText: { color: colors.muted, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  tabTextActive: { color: colors.accent },
  card: { gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.panel, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: colors.white, fontSize: 17, fontWeight: '800' },
  copy: { color: colors.silver, fontSize: 13, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  badge: { color: colors.accent, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  note: { gap: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.accent, backgroundColor: colors.ink, padding: spacing.md },
  notice: { color: colors.silver, fontSize: 11, lineHeight: 17 },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start', paddingVertical: spacing.xs },
  link: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: .74 },
});
