import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AskPsiThread } from '@/components/ask-psi-thread';
import { PrimaryButton } from '@/components/ui';
import { CustomerProfileGate } from '@/components/customer-profile-gate';
import { colors } from '@/constants/brand';
import { ASK_PSI_STAGE } from '@/lib/ask-psi-stage';
import { listAskPsiConversations, openAskPsiConversation, subscribeToAskPsiInbox, type AskPsiInboxConversation, type AskPsiTopic } from '@/lib/ask-psi-messaging';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import type { AskPsiConversationRow } from '@/lib/database.types';
import { useThemePreference } from '@/lib/theme-preference';

const TOPICS: readonly { detail: string; label: string; value: AskPsiTopic }[] = [
  { value: 'service', label: 'Service and report', detail: 'Servicing, inspections and maintenance' },
  { value: 'booking', label: 'Booking question', detail: 'An existing or future booking' },
  { value: 'vehicle_fault', label: 'Vehicle concern', detail: 'A warning, noise, fault or drivability concern' },
  { value: 'dyno', label: 'Dyno tuning', detail: 'Testing, tuning and measured results' },
  { value: 'performance_build', label: 'Plan and build', detail: 'Your car, current setup and goal' },
  { value: 'records', label: 'Vehicle records', detail: 'Reports, invoices and workshop history' },
  { value: 'sell_my_car', label: 'Sell my car', detail: 'Ask PSI about a customer vehicle listing' },
  { value: 'other', label: 'Something else', detail: 'A general question for PSI' },
] as const;
const BOOST_ASSISTANT = require('../../assets/images/boost-assistant.png');

export default function AskPsiMessagesScreen() {
  const router = useRouter();
  const auth = useCustomerAuth();
  const { theme } = useThemePreference();

  useEffect(() => {
    if (!ASK_PSI_STAGE.privatePreviewEnabled) router.replace('/');
  }, [router]);

  if (!ASK_PSI_STAGE.privatePreviewEnabled) return <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.inkSoft }]} />;
  if (auth.status === 'loading') return <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.inkSoft }]}><View style={styles.state}><ActivityIndicator color={theme.accent} /><Text style={[styles.copy, { color: theme.textMuted }]}>Checking your PSI account</Text></View></SafeAreaView>;
  if (auth.status !== 'signed_in' || !auth.user) {
    return (
      <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.inkSoft }]}>
        <ScrollView contentContainerStyle={styles.state}>
          <BoostPortrait size={180} />
          <Text style={[styles.title, { color: theme.text }]}>Ask PSI</Text>
          <Text style={[styles.copy, { color: theme.textMuted }]}>Sign in with your PSI account to start a private conversation with the workshop.</Text>
          <PrimaryButton label="Open secure sign in" onPress={() => router.push({ pathname: '/account', params: { returnTo: '/messages' } })} />
          <PrimaryButton label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} variant="outline" />
        </ScrollView>
      </SafeAreaView>
    );
  }
  return <CustomerProfileGate returnTo="/messages" feature="messaging the workshop"><SignedInMessages key={auth.user.id} /></CustomerProfileGate>;
}

function SignedInMessages() {
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const account = useCustomerAccount();
  const { theme } = useThemePreference();
  const activeRef = useRef(false);
  const requestRef = useRef(0);
  const savingRef = useRef(false);
  const pendingRef = useRef<{ fingerprint: string; nonce: string } | null>(null);
  const [conversations, setConversations] = useState<AskPsiInboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState(params.conversationId ?? '');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [topic, setTopic] = useState<AskPsiTopic>('service');
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeRef.current) return;
    const request = ++requestRef.current;
    try {
      const next = await listAskPsiConversations();
      if (!activeRef.current || request !== requestRef.current) return;
      setConversations(next);
      setError('');
    } catch {
      if (activeRef.current && request === requestRef.current) setError('Messages could not be loaded. Check your connection and try again.');
    } finally {
      if (activeRef.current && request === requestRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    activeRef.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const timer = setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeToAskPsiInbox(() => void refresh());
    const foreground = AppState.addEventListener('change', (state) => {
      activeRef.current = state === 'active';
      if (activeRef.current) void refresh();
      else requestRef.current += 1;
    });
    return () => {
      activeRef.current = false;
      requestRef.current += 1;
      clearTimeout(timer);
      unsubscribe();
      foreground.remove();
    };
  }, [refresh]));
  useEffect(() => {
    const timer = setTimeout(() => { setSelectedId(params.conversationId ?? ''); setCreating(false); }, 0);
    return () => clearTimeout(timer);
  }, [params.conversationId]);

  const vehiclesById = useMemo(() => new Map(account.account?.vehicles.map((vehicle) => [vehicle.id, vehicle]) ?? []), [account.account?.vehicles]);
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId);

  if (selectedId) {
    const vehicle = selectedConversation?.vehicle_id ? vehiclesById.get(selectedConversation.vehicle_id) : null;
    return (
      <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.inkSoft }]}>
        <AskPsiThread
          conversationId={selectedId}
          onBack={() => { setSelectedId(''); router.setParams({ conversationId: undefined }); void refresh(); }}
          participantLabel="PSI Performance"
          role="customer"
          vehicleLabel={vehicle ? vehicleLabel(vehicle) : undefined}
        />
      </SafeAreaView>
    );
  }

  const createConversation = async () => {
    if (!body.trim() || savingRef.current) return;
    savingRef.current = true;
    const fingerprint = JSON.stringify({ body: body.trim(), topic, vehicleId });
    const pending = pendingRef.current?.fingerprint === fingerprint ? pendingRef.current : { fingerprint, nonce: Crypto.randomUUID() };
    pendingRef.current = pending;
    setSaving(true);
    setFormError('');
    try {
      const created = await openAskPsiConversation({ body, clientNonce: pending.nonce, topic, vehicleId });
      pendingRef.current = null;
      setBody('');
      setCreating(false);
      Keyboard.dismiss();
      await refresh();
      setSelectedId(created.conversation_id);
    } catch {
      setFormError('We could not confirm your question was sent. Your message is kept here. Tap Send to PSI to retry safely.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'right', 'left']} style={[styles.screen, { backgroundColor: theme.inkSoft }]}>
      <View style={[styles.pageHeader, { backgroundColor: theme.surface, borderBottomColor: theme.frame }]}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={() => { Keyboard.dismiss(); if (creating) setCreating(false); else if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.backButton}>
          <Ionicons color={theme.accent} name="chevron-back" size={26} />
        </Pressable>
        <BoostMark compact />
        <View style={styles.pageHeaderCopy}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>{creating ? 'New question' : 'Ask PSI'}</Text>
          <Text style={[styles.pageSubtitle, { color: theme.textMuted }]}>Private workshop messages</Text>
        </View>
        <Pressable accessibilityLabel={creating ? 'Hide keyboard' : 'Refresh messages'} accessibilityRole="button" onPress={() => creating ? Keyboard.dismiss() : void refresh()} style={styles.backButton}><Ionicons color={theme.accent} name={creating ? 'chevron-down' : 'refresh'} size={22} /></Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      {creating ? (
        <ScrollView contentContainerStyle={styles.form} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sectionTitle, { color: theme.text }]}>What can PSI help with?</Text>
          <View style={styles.topicGrid}>
            {TOPICS.map((item) => (
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: topic === item.value, disabled: saving }} disabled={saving} key={item.value} onPress={() => setTopic(item.value)} style={[styles.topicCard, { backgroundColor: theme.surface, borderColor: topic === item.value ? theme.accent : theme.frame }]}>
                <Text style={[styles.topicTitle, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.topicDetail, { color: theme.textMuted }]}>{item.detail}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Vehicle</Text>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: vehicleId === null, disabled: saving }} disabled={saving} onPress={() => setVehicleId(null)} style={[styles.vehicleCard, { backgroundColor: theme.surface, borderColor: vehicleId === null ? theme.accent : theme.frame }]}>
            <Text style={[styles.vehicleTitle, { color: theme.text }]}>General question</Text>
            <Text style={[styles.vehicleDetail, { color: theme.textMuted }]}>No vehicle selected</Text>
          </Pressable>
          {account.account?.vehicles.map((vehicle) => (
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: vehicleId === vehicle.id, disabled: saving }} disabled={saving} key={vehicle.id} onPress={() => setVehicleId(vehicle.id)} style={[styles.vehicleCard, { backgroundColor: theme.surface, borderColor: vehicleId === vehicle.id ? theme.accent : theme.frame }]}>
              <Text style={[styles.vehicleTitle, { color: theme.text }]}>{vehicleLabel(vehicle)}</Text>
              <Text style={[styles.vehicleDetail, { color: theme.textMuted }]}>{vehicle.registration || 'Registration not supplied'}</Text>
            </Pressable>
          ))}

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your message</Text>
          <TextInput
            accessibilityLabel="Your message to PSI"
            editable={!saving}
            maxLength={4000}
            multiline
            onChangeText={setBody}
            placeholder="Tell PSI what you need help with"
            placeholderTextColor={theme.textMuted}
            style={[styles.messageInput, { backgroundColor: theme.surface, borderColor: theme.frame, color: theme.text }]}
            value={body}
          />
          <Text style={[styles.helper, { color: theme.textMuted }]}>PSI will review your message. This does not confirm a booking, price or diagnosis.</Text>
          {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
          <PrimaryButton disabled={!body.trim()} label="Send to PSI" loading={saving} onPress={() => void createConversation()} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl onRefresh={() => { setRefreshing(true); void refresh(); }} refreshing={refreshing} tintColor={theme.accent} />}>
          <View style={[styles.intro, { backgroundColor: theme.surface, borderColor: theme.frame }]}>
            <BoostPortrait size={96} />
            <View style={styles.introCopy}>
              <Text style={[styles.introTitle, { color: theme.text }]}>How can Boost help?</Text>
              <Text style={[styles.copy, { color: theme.textMuted }]}>Send a private question to the PSI workshop and keep the reply with your account.</Text>
              <PrimaryButton label="New question" onPress={() => setCreating(true)} />
            </View>
          </View>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Conversations</Text>
          {loading ? <ActivityIndicator color={theme.accent} /> : conversations.length ? conversations.map((conversation) => {
            const vehicle = conversation.vehicle_id ? vehiclesById.get(conversation.vehicle_id) : null;
            const unread = conversation.unread_count > 0;
            return (
              <Pressable accessibilityRole="button" accessibilityLabel={(unread ? 'Unread reply. ' : '') + topicLabel(conversation.topic)} key={conversation.id} onPress={() => setSelectedId(conversation.id)} style={[styles.conversationCard, { backgroundColor: theme.surface, borderColor: unread ? theme.accent : theme.frame }]}>
                <View style={[styles.conversationIcon, { backgroundColor: theme.inkSoft }]}><Ionicons color={theme.accent} name="chatbubble-ellipses-outline" size={22} /></View>
                <View style={styles.conversationCopy}>
                  <Text style={[styles.conversationTitle, { color: theme.text }]}>{topicLabel(conversation.topic)}</Text>
                  <Text style={[styles.conversationDetail, { color: theme.textMuted }]}>{vehicle ? vehicleLabel(vehicle) : 'General question'} · {statusLabel(conversation.status)}</Text>
                  <Text style={[styles.conversationTime, { color: theme.textMuted }]}>{formatConversationTime(conversation.last_message_at)}</Text>
                </View>
                {unread ? <View accessibilityLabel="Unread reply" style={styles.unreadDot} /> : null}
                <Ionicons color={theme.textMuted} name="chevron-forward" size={21} />
              </Pressable>
            );
          }) : !error ? <View style={[styles.empty, { borderColor: theme.frame }]}><Text style={[styles.copy, { color: theme.textMuted }]}>No private conversations yet.</Text></View> : null}
          {error ? <View style={styles.loadError}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><PrimaryButton label="Retry loading messages" onPress={() => void refresh()} variant="outline" /></View> : null}
        </ScrollView>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BoostMark({ compact = false }: { compact?: boolean }) {
  return <View accessibilityLabel="Boost, Ask PSI" style={[styles.boost, compact && styles.boostCompact]}><Ionicons color={colors.ink} name="chatbubble-ellipses" size={compact ? 20 : 30} /><View style={styles.boostEye} /></View>;
}

function BoostPortrait({ size }: { size: number }) {
  return <Image accessibilityLabel="Boost, the Ask PSI assistant" resizeMode="contain" source={BOOST_ASSISTANT} style={{ height: size, width: size }} />;
}

function vehicleLabel(vehicle: { make: string; model: string; year: number }) { return `${vehicle.year} ${vehicle.make} ${vehicle.model}`; }
function formatConversationTime(value: string) { return new Intl.DateTimeFormat('en-AU', { day: 'numeric', hour: 'numeric', minute: '2-digit', month: 'short' }).format(new Date(value)); }
function statusLabel(status: AskPsiConversationRow['status']) { return status === 'closed' ? 'Closed' : status === 'awaiting_customer' ? 'PSI replied' : status === 'awaiting_psi' ? 'Waiting for PSI' : 'Open'; }
function topicLabel(topic: AskPsiTopic) { return TOPICS.find((item) => item.value === topic)?.label ?? 'Ask PSI'; }

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { flexGrow: 1, maxWidth: 520, width: '100%', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center' },
  copy: { fontSize: 14, lineHeight: 20 },
  pageHeader: { minHeight: 70, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  backButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  pageHeaderCopy: { flex: 1 },
  pageTitle: { fontSize: 20, fontWeight: '900' },
  pageSubtitle: { fontSize: 12, marginTop: 2 },
  boost: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.accent, borderWidth: 3, borderColor: '#D9F4FF', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  boostCompact: { width: 40, height: 40, borderRadius: 20, borderWidth: 2 },
  boostEye: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.white, position: 'absolute', right: 13, top: 12 },
  list: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12, padding: 16, paddingBottom: 30 },
  intro: { borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  introCopy: { flex: 1, minWidth: 0, gap: 5 },
  introTitle: { fontSize: 21, fontWeight: '900' },
  sectionTitle: { fontSize: 17, fontWeight: '900', marginTop: 4 },
  conversationCard: { borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  conversationIcon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  conversationCopy: { flex: 1, minWidth: 0 },
  conversationTitle: { fontSize: 16, fontWeight: '900' },
  conversationDetail: { fontSize: 12, marginTop: 3 },
  conversationTime: { fontSize: 10, marginTop: 5 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  empty: { borderWidth: 1, borderRadius: 12, padding: 18 },
  form: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12, padding: 16, paddingBottom: 34 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  topicCard: { width: '48%', minWidth: 150, flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  topicTitle: { fontSize: 14, fontWeight: '900' },
  topicDetail: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  vehicleCard: { borderWidth: 1, borderRadius: 11, padding: 12 },
  vehicleTitle: { fontSize: 14, fontWeight: '800' },
  vehicleDetail: { fontSize: 11, marginTop: 3 },
  messageInput: { minHeight: 130, borderWidth: 1, borderRadius: 12, padding: 13, textAlignVertical: 'top', fontSize: 15 },
  helper: { fontSize: 11, lineHeight: 16 },
  error: { color: '#FF7B72', fontSize: 12, lineHeight: 17 },
  loadError: { gap: 12 },
});
