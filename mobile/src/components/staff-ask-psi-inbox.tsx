import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AskPsiThread } from '@/components/ask-psi-thread';
import { colors } from '@/constants/brand';
import { listAskPsiConversations, setAskPsiConversationStatus } from '@/lib/ask-psi-messaging';
import type { AskPsiConversationRow } from '@/lib/database.types';
import type { StaffPortalSnapshot } from '@/lib/staff-portal';
import { useThemePreference } from '@/lib/theme-preference';

export function StaffAskPsiInbox({ initialConversationId = '', snapshot }: { initialConversationId?: string; snapshot: StaffPortalSnapshot }) {
  const { theme } = useThemePreference();
  const [conversations, setConversations] = useState<AskPsiConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setConversations(await listAskPsiConversations());
      setError('');
    } catch {
      setError('Workshop messages could not be loaded. Check the connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const customersById = useMemo(() => new Map(snapshot.customers.map((customer) => [customer.user_id, customer])), [snapshot.customers]);
  const vehiclesById = useMemo(() => new Map([...snapshot.vehicles, ...snapshot.archivedVehicles].map((vehicle) => [vehicle.id, vehicle])), [snapshot.archivedVehicles, snapshot.vehicles]);
  const selected = conversations.find((conversation) => conversation.id === selectedId);
  const visible = conversations.filter((conversation) => filter === 'closed' ? conversation.status === 'closed' : conversation.status !== 'closed');

  const updateStatus = async (status: AskPsiConversationRow['status'], assignToSelf = false) => {
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    try {
      await setAskPsiConversationStatus(selected.id, status, assignToSelf);
      await refresh();
    } catch {
      setError('The conversation status could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    const customer = customersById.get(selected.customer_id);
    const vehicle = selected.vehicle_id ? vehiclesById.get(selected.vehicle_id) : null;
    return (
      <View style={styles.threadScreen}>
        <View style={[styles.actionBar, { backgroundColor: theme.surface, borderBottomColor: theme.frame }]}>
          <View style={styles.actionCopy}>
            <Text style={[styles.actionTitle, { color: theme.text }]}>{statusLabel(selected.status)}</Text>
            <Text style={[styles.actionDetail, { color: theme.textMuted }]}>{topicLabel(selected.topic)}</Text>
          </View>
          <View style={styles.actions}>
            {selected.status === 'closed' ? <CompactAction disabled={saving} label="Reopen" onPress={() => void updateStatus('open', true)} /> : (
              <>
                <CompactAction disabled={saving} label="Assign to me" onPress={() => void updateStatus(selected.status, true)} />
                <CompactAction disabled={saving} label="Waiting for customer" onPress={() => void updateStatus('awaiting_customer', true)} />
                <CompactAction disabled={saving} label="Close" onPress={() => void updateStatus('closed', true)} />
              </>
            )}
          </View>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <AskPsiThread
          conversationId={selected.id}
          onBack={() => { setSelectedId(''); void refresh(); }}
          participantLabel={customerName(customer)}
          role="staff"
          vehicleLabel={vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'General question'}
        />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.headingRow}>
        <View style={styles.actionCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Messages</Text>
          <Text style={[styles.copy, { color: theme.textMuted }]}>Private customer conversations linked to PSI accounts and vehicles.</Text>
        </View>
        <Pressable accessibilityLabel="Refresh messages" accessibilityRole="button" onPress={() => void refresh()} style={[styles.refreshButton, { borderColor: theme.frame }]}><Ionicons color={theme.accent} name="refresh" size={21} /></Pressable>
      </View>

      <View accessibilityLabel="Message inbox filter" accessibilityRole="tablist" style={styles.filters}>
        {(['open', 'closed'] as const).map((value) => {
          const count = conversations.filter((conversation) => value === 'closed' ? conversation.status === 'closed' : conversation.status !== 'closed').length;
          return <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === value }} key={value} onPress={() => setFilter(value)} style={[styles.filter, { borderColor: filter === value ? theme.accent : theme.frame, backgroundColor: theme.surface }]}><Text style={[styles.filterText, { color: filter === value ? theme.accent : theme.textMuted }]}>{value === 'open' ? 'Active' : 'Closed'} · {count}</Text></Pressable>;
        })}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color={theme.accent} /><Text style={[styles.copy, { color: theme.textMuted }]}>Loading workshop messages</Text></View> : (
        <ScrollView contentContainerStyle={styles.list}>
          {visible.length ? visible.map((conversation) => {
            const customer = customersById.get(conversation.customer_id);
            const vehicle = conversation.vehicle_id ? vehiclesById.get(conversation.vehicle_id) : null;
            const unread = !conversation.staff_last_read_at || new Date(conversation.last_message_at) > new Date(conversation.staff_last_read_at);
            return (
              <Pressable key={conversation.id} onPress={() => setSelectedId(conversation.id)} style={[styles.card, { backgroundColor: theme.surface, borderColor: unread ? theme.accent : theme.frame }]}>
                <View style={[styles.avatar, { backgroundColor: theme.inkSoft }]}><Ionicons color={theme.accent} name="person-outline" size={23} /></View>
                <View style={styles.cardCopy}>
                  <View style={styles.cardTitleRow}>
                    <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.text }]}>{customerName(customer)}</Text>
                    <Text style={[styles.time, { color: theme.textMuted }]}>{formatTime(conversation.last_message_at)}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.vehicle, { color: theme.textMuted }]}>{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'General question'}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={[styles.topic, { color: theme.textMuted }]}>{topicLabel(conversation.topic)} · {statusLabel(conversation.status)}</Text>
                    {unread ? <View accessibilityLabel="Unread customer message" style={styles.unreadDot} /> : null}
                  </View>
                </View>
                <Ionicons color={theme.textMuted} name="chevron-forward" size={21} />
              </Pressable>
            );
          }) : <View style={[styles.empty, { borderColor: theme.frame }]}><Ionicons color={theme.textMuted} name="chatbubbles-outline" size={28} /><Text style={[styles.copy, { color: theme.textMuted }]}>{filter === 'closed' ? 'No closed conversations.' : 'No customer messages are waiting.'}</Text></View>}
        </ScrollView>
      )}
    </View>
  );
}

function CompactAction({ disabled, label, onPress }: { disabled: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.compactAction, disabled && styles.disabled]}><Text style={styles.compactActionText}>{label}</Text></Pressable>;
}

function customerName(customer?: StaffPortalSnapshot['customers'][number]) { return customer ? `${customer.first_name} ${customer.last_name}`.trim() || customer.email : 'PSI customer'; }
function formatTime(value: string) { return new Intl.DateTimeFormat('en-AU', { day: 'numeric', hour: 'numeric', minute: '2-digit', month: 'short' }).format(new Date(value)); }
function statusLabel(status: AskPsiConversationRow['status']) { return status === 'closed' ? 'Closed' : status === 'awaiting_customer' ? 'Waiting for customer' : status === 'awaiting_psi' ? 'Needs PSI reply' : 'Open'; }
function topicLabel(topic: AskPsiConversationRow['topic']) { return ({ booking: 'Booking', dyno: 'Dyno tuning', other: 'General', performance_build: 'Plan and build', records: 'Records', sell_my_car: 'Sell my car', service: 'Service and report', vehicle_fault: 'Vehicle concern' } as const)[topic]; }

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  threadScreen: { flex: 1, minHeight: 0 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  actionCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 25, fontWeight: '900' },
  copy: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  refreshButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  filter: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { fontSize: 12, fontWeight: '900' },
  list: { gap: 9, padding: 16, paddingTop: 8, paddingBottom: 26 },
  card: { borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '900' },
  time: { fontSize: 9 },
  vehicle: { fontSize: 12, marginTop: 3 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  topic: { flex: 1, fontSize: 10 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  empty: { borderWidth: 1, borderRadius: 12, alignItems: 'center', gap: 8, padding: 24 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  error: { color: '#FF7B72', backgroundColor: '#2A1111', paddingHorizontal: 16, paddingVertical: 9, fontSize: 12 },
  actionBar: { borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: 10 },
  actionTitle: { fontSize: 14, fontWeight: '900' },
  actionDetail: { fontSize: 10, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  compactAction: { borderWidth: 1, borderColor: colors.accent, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  compactActionText: { color: colors.accent, fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.4 },
});
