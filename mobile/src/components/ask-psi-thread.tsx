import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Image, Keyboard, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/brand';
import {
  loadAskPsiConversation,
  markAskPsiConversationRead,
  sendAskPsiPhotoMessage,
  sendAskPsiTextMessage,
  subscribeToAskPsiConversation,
  type AskPsiConversationWithMessages,
  type AskPsiPhotoInput,
} from '@/lib/ask-psi-messaging';
import { useThemePreference } from '@/lib/theme-preference';

type AskPsiThreadProps = {
  conversationId: string;
  keyboardAvoidanceEnabled?: boolean;
  onBack: () => void;
  participantLabel: string;
  role: 'customer' | 'staff';
  vehicleLabel?: string;
};

export function AskPsiThread(props: AskPsiThreadProps) {
  return <AskPsiThreadContent key={props.role + ':' + props.conversationId} {...props} />;
}

function AskPsiThreadContent({ conversationId, keyboardAvoidanceEnabled = true, onBack, participantLabel, role, vehicleLabel }: AskPsiThreadProps) {
  const { theme } = useThemePreference();
  const scrollRef = useRef<ScrollView>(null);
  const activeRef = useRef(false);
  const requestRef = useRef(0);
  const nearBottomRef = useRef(true);
  const readInFlightRef = useRef(false);
  const readThroughRef = useRef('');
  const sendInFlightRef = useRef(false);
  const pendingTextRef = useRef<{ body: string; nonce: string } | null>(null);
  const [thread, setThread] = useState<AskPsiConversationWithMessages | null>(null);
  const [draft, setDraft] = useState('');
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<AskPsiPhotoInput | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const [scrollReady, setScrollReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeRef.current) return;
    const request = ++requestRef.current;
    try {
      const next = await loadAskPsiConversation(conversationId);
      if (!activeRef.current || request !== requestRef.current) return;
      setThread(next);
      setLoadError('');
    } catch {
      if (activeRef.current && request === requestRef.current) setLoadError('Messages could not be refreshed. Check your connection and try again.');
    } finally {
      if (activeRef.current && request === requestRef.current) setLoading(false);
    }
  }, [conversationId]);

  useFocusEffect(useCallback(() => {
    activeRef.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const timer = setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeToAskPsiConversation(conversationId, () => void refresh());
    const foreground = AppState.addEventListener('change', (state) => {
      activeRef.current = state === 'active';
      if (activeRef.current) void refresh();
      else requestRef.current += 1;
    });
    // Recover messages after reconnecting even if realtime missed an event.
    const reconnectCheck = setInterval(() => void refresh(), 30_000);
    return () => {
      activeRef.current = false;
      requestRef.current += 1;
      clearTimeout(timer);
      clearInterval(reconnectCheck);
      foreground.remove();
      unsubscribe();
    };
  }, [conversationId, refresh]));

  useEffect(() => {
    if (!activeRef.current || !thread || !scrollReady || !nearBottom || photoPreview || readInFlightRef.current) return;
    const incoming = [...thread.messages].reverse().find((message) => role === 'customer'
      ? message.sender_kind === 'staff' || message.sender_kind === 'assistant'
      : message.sender_kind === 'customer');
    if (!incoming || incoming.recipient_read_at || readThroughRef.current === incoming.id) return;
    readInFlightRef.current = true;
    void markAskPsiConversationRead(conversationId, incoming.id).then(() => {
      readThroughRef.current = incoming.id;
      if (activeRef.current) void refresh();
    }).catch(() => {
      // The next refresh retries the receipt without obscuring a readable message.
    }).finally(() => { readInFlightRef.current = false; });
  }, [conversationId, nearBottom, photoPreview, refresh, role, scrollReady, thread]);

  const attachmentsByMessage = useMemo(() => new Map(thread?.attachments.map((attachment) => [attachment.message_id, attachment]) ?? []), [thread?.attachments]);
  const canSend = Boolean(thread) && !sending;

  const scrollToLatest = () => {
    nearBottomRef.current = true;
    setNearBottom(true);
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const sendText = async () => {
    const body = draft.trim();
    if (!body || !thread || sendInFlightRef.current || pendingPhoto) return;
    sendInFlightRef.current = true;
    const pending = pendingTextRef.current?.body === body ? pendingTextRef.current : { body, nonce: Crypto.randomUUID() };
    pendingTextRef.current = pending;
    setSending(true);
    setSendError('');
    try {
      await sendAskPsiTextMessage(conversationId, body, pending.nonce);
      pendingTextRef.current = null;
      setDraft((current) => current.trim() === body ? '' : current);
      nearBottomRef.current = true;
      setNearBottom(true);
      await refresh();
    } catch {
      setSendError('We could not confirm your message was sent. Your text is kept below. Tap Send to retry safely.');
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  };

  const sendPhoto = async (photo: AskPsiPhotoInput) => {
    setPendingPhoto(photo);
    try {
      await sendAskPsiPhotoMessage(conversationId, photo);
      setPendingPhoto(null);
      nearBottomRef.current = true;
      setNearBottom(true);
      await refresh();
    } catch (photoError) {
      const detail = photoError instanceof Error ? photoError.message : '';
      if (detail.includes('SIZE') || detail.includes('TYPE_UNSUPPORTED')) {
        setPendingPhoto(null);
        setSendError(detail.includes('SIZE') ? 'That photo is larger than 10 MB. Choose a smaller image.' : 'Choose a JPEG, PNG or WebP photo.');
      } else {
        setSendError('We could not confirm your photo was sent. Tap Retry photo to check and send it safely.');
      }
    }
  };

  const addPhoto = async () => {
    if (!thread || sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    setSending(true);
    setSendError('');
    try {
      if (pendingPhoto) {
        await sendPhoto(pendingPhoto);
        return;
      }
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setSendError('Allow photo access in your device settings to attach an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: false,
        mediaTypes: ['images'],
        quality: 0.85,
        selectionLimit: 1,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      await sendPhoto({
        clientNonce: Crypto.randomUUID(),
        height: asset.height,
        messageId: Crypto.randomUUID(),
        mimeType: asset.mimeType,
        uri: asset.uri,
        width: asset.width,
      });
    } catch {
      setSendError('Photos could not be opened. Please try again.');
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={keyboardAvoidanceEnabled} style={styles.flex}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.frame }]}>
        <Pressable accessibilityLabel="Back to messages" accessibilityRole="button" onPress={() => { Keyboard.dismiss(); onBack(); }} style={styles.headerButton}>
          <Ionicons color={theme.accent} name="chevron-back" size={25} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.text }]}>{participantLabel}</Text>
          <Text numberOfLines={1} style={[styles.headerMeta, { color: theme.textMuted }]}>{vehicleLabel || topicLabel(thread?.conversation.topic)}</Text>
        </View>
        <View accessibilityLabel="Private PSI conversation" style={[styles.privateBadge, { borderColor: theme.frame }]}>
          <Ionicons color={theme.accent} name="lock-closed" size={13} />
          <Text style={[styles.privateText, { color: theme.textMuted }]}>Private</Text>
        </View>
        <Pressable accessibilityLabel="Hide keyboard" accessibilityRole="button" onPress={Keyboard.dismiss} style={styles.headerButton}>
          <Ionicons color={theme.accent} name="chevron-down" size={22} />
        </Pressable>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={theme.accent} /><Text style={[styles.stateCopy, { color: theme.textMuted }]}>Loading messages</Text></View> : (
        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (nearBottomRef.current) scrollRef.current?.scrollToEnd({ animated: false });
            setScrollReady(true);
          }}
          onLayout={() => { if (nearBottomRef.current) scrollRef.current?.scrollToEnd({ animated: false }); }}
          onScroll={({ nativeEvent }) => {
            const atBottom = nativeEvent.contentSize.height - nativeEvent.layoutMeasurement.height - nativeEvent.contentOffset.y < 80;
            nearBottomRef.current = atBottom;
            setNearBottom(atBottom);
          }}
          ref={scrollRef}
          scrollEventThrottle={80}
          style={styles.flex}
        >
          <View style={[styles.safetyCard, { backgroundColor: theme.surface, borderColor: theme.frame }]}>
            <Ionicons color={theme.accent} name="shield-checkmark-outline" size={20} />
            <Text style={[styles.safetyText, { color: theme.textMuted }]}>Messages go directly between this PSI account and the workshop. Bookings, prices and workshop decisions are confirmed separately by PSI.</Text>
          </View>
          {thread?.messages.map((message) => {
            const mine = message.sender_kind === role;
            const attachment = attachmentsByMessage.get(message.id);
            const receipt = mine ? message.recipient_read_at ? 'Read ' + formatMessageTime(message.recipient_read_at) : 'Sent' : '';
            return (
              <View key={message.id} style={[styles.messageRow, mine ? styles.messageMine : styles.messageTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : [styles.bubbleTheirs, { backgroundColor: theme.surface, borderColor: theme.frame }]]}>
                  {attachment?.signedUrl ? (
                    <Pressable accessibilityLabel="Open private conversation photo" accessibilityRole="button" onPress={() => { Keyboard.dismiss(); setPhotoPreview(attachment.signedUrl); }}>
                      <Image accessibilityLabel="Private conversation photo" resizeMode="contain" source={{ uri: attachment.signedUrl }} style={styles.photo} />
                    </Pressable>
                  ) : message.message_kind === 'photo' ? <Pressable accessibilityLabel="Refresh unavailable photo" accessibilityRole="button" onPress={() => void refresh()}><Text style={[styles.messageBody, { color: mine ? colors.ink : theme.text }]}>Photo unavailable. Tap to refresh.</Text></Pressable> : null}
                  {message.body ? <Text selectable style={[styles.messageBody, { color: mine ? colors.ink : theme.text }]}>{message.body}</Text> : null}
                  <View style={styles.messageMetaRow}>
                    <Text style={[styles.messageTime, { color: mine ? '#16475A' : theme.textMuted }]}>{formatMessageTime(message.created_at)}</Text>
                    {receipt ? <Text style={[styles.messageReceipt, { color: mine ? '#16475A' : theme.textMuted }]}>{receipt}</Text> : null}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {!nearBottom && thread ? <Pressable accessibilityRole="button" onPress={scrollToLatest} style={[styles.latestButton, { backgroundColor: theme.surface, borderColor: theme.accent }]}><Text style={{ color: theme.accent, fontWeight: '800' }}>Latest messages</Text><Ionicons color={theme.accent} name="arrow-down" size={17} /></Pressable> : null}
      {loadError ? <View style={styles.errorRow}><Text accessibilityRole="alert" style={styles.errorCopy}>{loadError}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable></View> : null}
      {sendError ? <Text accessibilityRole="alert" style={styles.error}>{sendError}</Text> : null}
      {pendingPhoto ? <View style={[styles.pendingPhoto, { backgroundColor: theme.surface }]}><Image accessibilityLabel="Photo awaiting confirmation" resizeMode="contain" source={{ uri: pendingPhoto.uri }} style={styles.pendingThumbnail} /><Text style={[styles.pendingCopy, { color: theme.textMuted }]}>{sending ? 'Sending photo' : 'Photo awaiting confirmation'}</Text><Pressable accessibilityRole="button" disabled={sending} onPress={() => void addPhoto()} style={styles.retryButton}><Text style={styles.retryText}>Retry photo</Text></Pressable></View> : null}
      <View style={[styles.composer, { backgroundColor: theme.surface, borderTopColor: theme.frame }]}>
        <Pressable accessibilityLabel="Attach a photo" accessibilityRole="button" accessibilityState={{ disabled: !canSend || Boolean(pendingPhoto) }} disabled={!canSend || Boolean(pendingPhoto)} onPress={() => void addPhoto()} style={[styles.photoButton, { borderColor: theme.frame }, (!canSend || Boolean(pendingPhoto)) && styles.sendDisabled]}>
          <Ionicons color={theme.accent} name="image-outline" size={23} />
        </Pressable>
        <TextInput
          accessibilityLabel={role === 'staff' ? 'Reply to customer' : 'Message PSI'}
          editable={!sending}
          maxLength={4000}
          multiline
          onChangeText={setDraft}
          placeholder={role === 'staff' ? 'Reply to customer' : 'Message PSI'}
          placeholderTextColor={theme.textMuted}
          scrollEnabled
          style={[styles.input, { backgroundColor: theme.inkSoft, borderColor: theme.frame, color: theme.text }]}
          value={draft}
        />
        <Pressable accessibilityLabel="Send message" accessibilityRole="button" accessibilityState={{ disabled: !draft.trim() || !canSend || Boolean(pendingPhoto) }} disabled={!draft.trim() || !canSend || Boolean(pendingPhoto)} onPress={() => void sendText()} style={[styles.sendButton, (!draft.trim() || !canSend || Boolean(pendingPhoto)) && styles.sendDisabled]}>
          {sending ? <ActivityIndicator color={colors.ink} size="small" /> : <Ionicons color={colors.ink} name="arrow-up" size={22} />}
        </Pressable>
      </View>
      <Modal animationType="fade" onRequestClose={() => setPhotoPreview(null)} visible={Boolean(photoPreview)}>
        <SafeAreaView style={styles.photoModal}>
          <Pressable accessibilityLabel="Close photo" accessibilityRole="button" onPress={() => setPhotoPreview(null)} style={styles.closePhoto}><Ionicons color={colors.white} name="close" size={28} /><Text style={styles.closePhotoText}>Close photo</Text></Pressable>
          {photoPreview ? <Image accessibilityLabel="Private conversation photo, full view" resizeMode="contain" source={{ uri: photoPreview }} style={styles.fullPhoto} /> : null}
        </SafeAreaView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', hour: 'numeric', minute: '2-digit', month: 'short' }).format(new Date(value));
}

function topicLabel(topic?: string) {
  return ({
    booking: 'Booking question',
    dyno: 'Dyno tuning',
    other: 'General question',
    performance_build: 'Plan and build',
    records: 'Vehicle records',
    sell_my_car: 'Sell my car',
    service: 'Service and report',
    vehicle_fault: 'Vehicle concern',
  } as Record<string, string>)[topic ?? ''] ?? 'Ask PSI';
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: 0 },
  header: { minHeight: 68, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  headerButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerMeta: { fontSize: 12, marginTop: 2 },
  privateBadge: { borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  privateText: { fontSize: 10, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateCopy: { fontSize: 14 },
  messages: { flexGrow: 1, gap: 10, padding: 14, paddingBottom: 24 },
  safetyCard: { borderWidth: 1, borderRadius: 12, flexDirection: 'row', gap: 10, padding: 12, marginBottom: 4 },
  safetyText: { flex: 1, fontSize: 12, lineHeight: 17 },
  messageRow: { width: '100%', flexDirection: 'row' },
  messageMine: { justifyContent: 'flex-end' },
  messageTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '88%', borderRadius: 16, overflow: 'hidden', padding: 11 },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { borderWidth: 1, borderBottomLeftRadius: 4 },
  messageBody: { fontSize: 15, lineHeight: 21 },
  messageMetaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 5 },
  messageTime: { fontSize: 10 },
  messageReceipt: { fontSize: 10, fontWeight: '800' },
  photo: { width: 230, maxWidth: '100%', height: 180, borderRadius: 10, marginBottom: 7 },
  photoModal: { flex: 1, backgroundColor: colors.ink },
  closePhoto: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 18 },
  closePhotoText: { color: colors.white, fontWeight: '800' },
  fullPhoto: { flex: 1, width: '100%' },
  latestButton: { borderWidth: 1, borderRadius: 20, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, marginVertical: 6 },
  error: { color: '#FF7B72', backgroundColor: '#2A1111', paddingHorizontal: 14, paddingVertical: 8, fontSize: 12 },
  errorRow: { backgroundColor: '#2A1111', paddingLeft: 14, paddingRight: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorCopy: { flex: 1, color: '#FF7B72', fontSize: 12, paddingVertical: 8 },
  retryButton: { minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  pendingPhoto: { paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingThumbnail: { width: 42, height: 42, borderRadius: 5 },
  pendingCopy: { flex: 1, fontSize: 11 },
  composer: { borderTopWidth: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10 },
  photoButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10, fontSize: 15, textAlignVertical: 'top' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
});
