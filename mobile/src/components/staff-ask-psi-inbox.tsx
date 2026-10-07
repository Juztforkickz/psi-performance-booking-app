import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AskPsiThread } from '@/components/ask-psi-thread';
import { colors } from '@/constants/brand';
import { listAskPsiConversations, setAskPsiConversationStatus, subscribeToAskPsiInbox, type AskPsiInboxConversation } from '@/lib/ask-psi-messaging';
import type { AskPsiConversationRow } from '@/lib/database.types';
import type { StaffPortalSnapshot } from '@/lib/staff-portal';
import { useThemePreference } from '@/lib/theme-preference';

type StaffAskPsiInboxProps = {
  initialConversationId?: string;
  keyboardAvoidanceEnabled?: boolean;
  onBack?: () => void;
  snapshot: StaffPortalSnapshot;
  staffUserId?: string;
};

export function StaffAskPsiInbox({ initialConversationId = '', keyboardAvoidanceEnabled = true, onBack, snapshot, staffUserId }: StaffAskPsiInboxProps) {
  const { theme } = useThemePreference();
  const [conversations, setConversations] = useState<AskPsiInboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const activeRef = useRef(false);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!activeRef.current) return;
    setRefreshing(true);
    try {
      const next = await listAskPsiConversations();
      if (!activeRef.current || requestId !== requestRef.current) return;
      setConversations(next);
      setError('');
    } catch {
      if (!activeRef.current || requestId !== requestRef.current) return;
      setError('Workshop messages could not be loaded. Check the connection and try again.');
    } finally {
      if (activeRef.current && requestId === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    const timer = setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeToAskPsiInbox(() => {
      if (AppState.currentState === 'active') void refresh();
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      activeRef.current = false;
      requestRef.current += 1;
      clearTimeout(timer);
      foreground.remove();
      unsubscribe();
    };
  }, [refresh]));

  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedId(initialConversationId);
      setActionError('');
    }, 0);
    return () => clearTimeout(timer);
  }, [initialConversationId]);

  const customersById = useMemo(() => new Map(snapshot.customers.map((customer) => [customer.user_id, customer])), [snapshot.customers]);
  const vehiclesById = useMemo(() => new Map([...snapshot.vehicles, ...snapshot.archivedVehicles].map((vehicle) => [vehicle.id, vehicle])), [snapshot.archivedVehicles, snapshot.vehicles]);
  const selected = conversations.find((conversation) => conversation.id === selectedId);
  const visible = conversations.filter((conversation) => filter === 'closed' ? conversation.status === 'closed' : conversation.status !== 'closed');

  const updateStatus = async (status: AskPsiConversationRow['status'], assignToSelf = false) => {
    if (!selected || saving) return;
    setSaving(true);
    setActionError('');
    try {
      await setAskPsiConversationStatus(selected.id, status, assignToSelf);
      if (!activeRef.current) return;
      setFilter(status === 'closed' ? 'closed' : 'open');
      await refresh();
    } catch {
      if (activeRef.current) setActionError('The conversation status could not be updated. Please try again.');
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
          <View>
            <Text style={[styles.actionTitle, { color: theme.text }]}>{statusLabel(selected.status)}</Text>
            <Text style={[styles.actionDetail, { color: theme.textMuted }]}>{topicLabel(selected.topic)}</Text>
          </View>
          <View style={styles.actions}>
            {selected.status === 'closed' ? <CompactAction disabled={saving} label="Reopen" onPress={() => void updateStatus('open', true)} /> : (
              <>
                <CompactAction disabled={saving || selected.assigned_staff_id === staffUserId} label={selected.assigned_staff_id === staffUserId ? 'Assigned to you' : 'Assign to me'} onPress={() => void updateStatus(selected.status, true)} />
                {selected.status !== 'awaiting_customer' ? <CompactAction disabled={saving} label="Waiting for customer" onPress={() => void updateStatus('awaiting_customer', true)} /> : null}
                <CompactAction disabled={saving} label="Close" onPress={() => void updateStatus('closed', true)} />
              </>
            )}
          </View>
        </View>
        {error || actionError ? <Text accessibilityRole="alert" style={styles.error}>{actionError || error}</Text> : null}
        <AskPsiThread
          conversationId={selected.id}
          key={selected.id}
          keyboardAvoidanceEnabled={keyboardAvoidanceEnabled}
          onBack={() => { setFilter(selected.status === 'closed' ? 'closed' : 'open'); setSelectedId(''); setActionError(''); void refresh(); }}
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
        {onBack ? <Pressable accessibilityLabel="Back to workshop" accessibilityRole="button" onPress={onBack} style={styles.backButton}><Ionicons color={theme.accent} name="chevron-back" size={26} /></Pressable> : null}
        <View style={styles.actionCopy}>
          <Text style={[styles.title, { color: theme.text }]}>Messages</Text>
          <Text style={[styles.copy, { color: theme.textMuted }]}>Private customer conversations linked to PSI accounts and vehicles.</Text>
        </View>
        <Pressable accessibilityLabel="Refresh messages" accessibilityRole="button" accessibilityState={{ busy: refreshing, disabled: refreshing }} disabled={refreshing} onPress={() => void refresh()} style={[styles.refreshButton, { borderColor: theme.frame }]}>{refreshing ? <ActivityIndicator color={theme.accent} size="small" /> : <Ionicons color={theme.accent} name="refresh" size={21} />}</Pressable>
      </View>

      <View accessibilityLabel="Message inbox filter" accessibilityRole="tablist" style={styles.filters}>
        {(['open', 'closed'] as const).map((value) => {
          const count = conversations.filter((conversation) => value === 'closed' ? conversation.status === 'closed' : conversation.status !== 'closed').length;
          return <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === value }} key={value} onPress={() => setFilter(value)} style={[styles.filter, { borderColor: filter === value ? theme.accent : theme.frame, backgroundColor: theme.surface }]}><Text style={[styles.filterText, { color: filter === value ? theme.accent : theme.textMuted }]}>{value === 'open' ? 'Active' : 'Closed'} · {count}</Text></Pressable>;
        })}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {selectedId && !loading && !error ? <Text accessibilityRole="alert" style={[styles.notice, { color: theme.textMuted }]}>That conversation is no longer available to this account. Select a conversation below.</Text> : null}
      {loading ? <View style={styles.loading}><ActivityIndicator color={theme.accent} /><Text style={[styles.copy, { color: theme.textMuted }]}>Loading workshop messages</Text></View> : (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl onRefresh={() => void refresh()} refreshing={refreshing} tintColor={theme.accent} />}>
          {visible.length ? visible.map((conversation) => {
            const customer = customersById.get(conversation.customer_id);
            const vehicle = conversation.vehicle_id ? vehiclesById.get(conversation.vehicle_id) : null;
            const unread = conversation.unread_count > 0;
            return (
              <Pressable accessibilityLabel={`${customerName(customer)}, ${vehicle?.registration || 'general question'}, ${statusLabel(conversation.status)}${unread ? `, ${conversation.unread_count} unread messages` : ''}`} accessibilityRole="button" key={conversation.id} onPress={() => { setSelectedId(conversation.id); setActionError(''); }} style={[styles.card, { backgroundColor: theme.surface, borderColor: unread ? theme.accent : theme.frame }]}>
                <View style={[styles.avatar, { backgroundColor: theme.inkSoft }]}><Ionicons color={theme.accent} name="person-outline" size={23} /></View>
                <View style={styles.cardCopy}>
                  <View style={styles.cardTitleRow}>
                    <Text numberOfLines={2} style={[styles.cardTitle, { color: theme.text }]}>{customerName(customer)}</Text>
                    {unread ? <View style={styles.unreadBadge}><Text style={styles.unreadText}>{conversation.unread_count > 99 ? '99+' : conversation.unread_count} unread</Text></View> : null}
                  </View>
                  <Text style={[styles.time, { color: theme.textMuted }]}>{formatTime(conversation.last_message_at)}</Text>
                  <Text numberOfLines={1} style={[styles.vehicle, { color: theme.textMuted }]}>{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}` : 'General question'}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={[styles.topic, { color: theme.textMuted }]}>{topicLabel(conversation.topic)} · {statusLabel(conversation.status)}</Text>
                  </View>
                </View>
                <Ionicons color={theme.textMuted} name="chevron-forward" size={21} />
              </Pressable>
            );
          }) : !error ? <View style={[styles.empty, { borderColor: theme.frame }]}><Ionicons color={theme.textMuted} name="chatbubbles-outline" size={28} /><Text style={[styles.copy, { color: theme.textMuted }]}>{filter === 'closed' ? 'No closed conversations.' : 'No customer messages are waiting.'}</Text></View> : null}
        </ScrollView>
      )}
    </View>
  );
}

function CompactAction({ disabled, label, onPress }: { disabled: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.compactAction, disabled && styles.disabled]}><Text style={styles.compactActionText}>{label}</Text></Pressable>;
}

function customerName(customer?: StaffPortalSnapshot['customers'][number]) { return customer ? `${customer.first_name} ${customer.last_name}`.trim() || customer.email : 'PSI customer'; }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('en-AU', { day: 'numeric', hour: 'numeric', minute: '2-digit', month: 'short' }).format(date); }
function statusLabel(status: AskPsiConversationRow['status']) { return status === 'closed' ? 'Closed' : status === 'awaiting_customer' ? 'Waiting for customer' : status === 'awaiting_psi' ? 'Needs PSI reply' : 'Open'; }
function topicLabel(topic: AskPsiConversationRow['topic']) { return ({ booking: 'Booking', dyno: 'Dyno tuning', other: 'General', performance_build: 'Plan and build', records: 'Records', sell_my_car: 'Sell my car', service: 'Service and report', vehicle_fault: 'Vehicle concern' } as const)[topic]; }

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  threadScreen: { flex: 1, minHeight: 0 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  actionCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 25, fontWeight: '900' },
  copy: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  refreshButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  filter: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { fontSize: 12, fontWeight: '900' },
  list: { gap: 9, padding: 16, paddingTop: 8, paddingBottom: 26 },
  card: { borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '900' },
  time: { fontSize: 11, marginTop: 3 },
  vehicle: { fontSize: 12, marginTop: 3 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  topic: { flex: 1, fontSize: 12 },
  unreadBadge: { borderRadius: 9, backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 3 },
  unreadText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  empty: { borderWidth: 1, borderRadius: 12, alignItems: 'center', gap: 8, padding: 24 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  error: { color: '#FF7B72', backgroundColor: '#2A1111', paddingHorizontal: 16, paddingVertical: 9, fontSize: 12 },
  notice: { paddingHorizontal: 16, paddingVertical: 9, fontSize: 13, lineHeight: 18 },
  actionBar: { borderBottomWidth: 1, gap: 8, padding: 10 },
  actionTitle: { fontSize: 14, fontWeight: '900' },
  actionDetail: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  compactAction: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  compactActionText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.4 },
});
