import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors } from '@/constants/brand';
import {
  loadAskPsiConversation,
  markAskPsiConversationRead,
  sendAskPsiPhotoMessage,
  sendAskPsiTextMessage,
  subscribeToAskPsiConversation,
  type AskPsiConversationWithMessages,
} from '@/lib/ask-psi-messaging';
import { useThemePreference } from '@/lib/theme-preference';

type AskPsiThreadProps = {
  conversationId: string;
  onBack: () => void;
  participantLabel: string;
  role: 'customer' | 'staff';
  vehicleLabel?: string;
};

export function AskPsiThread({ conversationId, onBack, participantLabel, role, vehicleLabel }: AskPsiThreadProps) {
  const { theme } = useThemePreference();
  const scrollRef = useRef<ScrollView>(null);
  const [thread, setThread] = useState<AskPsiConversationWithMessages | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await loadAskPsiConversation(conversationId);
      setThread(next);
      setError('');
      const readAt = role === 'customer' ? next.conversation.customer_last_read_at : next.conversation.staff_last_read_at;
      if (!readAt || new Date(next.conversation.last_message_at).getTime() > new Date(readAt).getTime()) {
        await markAskPsiConversationRead(conversationId);
      }
    } catch {
      setError('This conversation could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, role]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    const unsubscribe = subscribeToAskPsiConversation(conversationId, () => void refresh());
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [conversationId, refresh]);

  useEffect(() => {
    if (!thread?.messages.length) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [thread?.messages.length]);

  const attachmentsByMessage = useMemo(() => new Map(thread?.attachments.map((attachment) => [attachment.message_id, attachment]) ?? []), [thread?.attachments]);

  const sendText = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      await sendAskPsiTextMessage(conversationId, body);
      setDraft('');
      await refresh();
    } catch {
      setError('Your message was not sent. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const addPhoto = async () => {
    if (sending) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo access is required before you can attach an image.');
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
    setSending(true);
    setError('');
    try {
      await sendAskPsiPhotoMessage(conversationId, {
        height: asset.height,
        mimeType: asset.mimeType,
        uri: asset.uri,
        width: asset.width,
      });
      await refresh();
    } catch (photoError) {
      const detail = photoError instanceof Error ? photoError.message : '';
      setError(detail.includes('SIZE') ? 'That photo is larger than 10 MB. Choose a smaller image.' : 'The photo could not be sent. No private attachment was published.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8} style={styles.flex}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.frame }]}>
        <Pressable accessibilityLabel="Back to messages" accessibilityRole="button" onPress={onBack} style={styles.headerButton}>
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
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color={theme.accent} /><Text style={[styles.stateCopy, { color: theme.textMuted }]}>Loading messages</Text></View> : (
        <ScrollView
          contentContainerStyle={styles.messages}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          ref={scrollRef}
        >
          <View style={[styles.safetyCard, { backgroundColor: theme.surface, borderColor: theme.frame }]}>
            <Ionicons color={theme.accent} name="shield-checkmark-outline" size={20} />
            <Text style={[styles.safetyText, { color: theme.textMuted }]}>Messages go directly between this PSI account and the workshop. Bookings, prices and workshop decisions are confirmed separately by PSI.</Text>
          </View>
          {thread?.messages.map((message) => {
            const mine = message.sender_kind === role;
            const attachment = attachmentsByMessage.get(message.id);
            const readAt = role === 'customer' ? thread.conversation.staff_last_read_at : thread.conversation.customer_last_read_at;
            const receipt = mine && readAt && new Date(readAt).getTime() >= new Date(message.created_at).getTime() ? 'Read' : mine ? 'Delivered' : '';
            return (
              <View key={message.id} style={[styles.messageRow, mine ? styles.messageMine : styles.messageTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : [styles.bubbleTheirs, { backgroundColor: theme.surface, borderColor: theme.frame }]]}>
                  {attachment ? <Image accessibilityLabel="Private conversation photo" resizeMode="cover" source={{ uri: attachment.signedUrl }} style={styles.photo} /> : null}
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

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={[styles.composer, { backgroundColor: theme.surface, borderTopColor: theme.frame }]}>
        <Pressable accessibilityLabel="Attach a photo" accessibilityRole="button" disabled={sending} onPress={() => void addPhoto()} style={[styles.photoButton, { borderColor: theme.frame }]}>
          <Ionicons color={theme.accent} name="image-outline" size={23} />
        </Pressable>
        <TextInput
          accessibilityLabel="Message PSI"
          maxLength={4000}
          multiline
          onChangeText={setDraft}
          placeholder={role === 'staff' ? 'Reply to customer' : 'Message PSI'}
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { backgroundColor: theme.inkSoft, borderColor: theme.frame, color: theme.text }]}
          value={draft}
        />
        <Pressable accessibilityLabel="Send message" accessibilityRole="button" disabled={!draft.trim() || sending} onPress={() => void sendText()} style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}>
          {sending ? <ActivityIndicator color={colors.ink} size="small" /> : <Ionicons color={colors.ink} name="arrow-up" size={22} />}
        </Pressable>
      </View>
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
  header: { minHeight: 68, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  headerButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
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
  bubble: { maxWidth: '84%', borderRadius: 16, overflow: 'hidden', padding: 11 },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { borderWidth: 1, borderBottomLeftRadius: 4 },
  messageBody: { fontSize: 15, lineHeight: 21 },
  messageMetaRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 5 },
  messageTime: { fontSize: 9 },
  messageReceipt: { fontSize: 9, fontWeight: '800' },
  photo: { width: 230, maxWidth: '100%', height: 180, borderRadius: 10, marginBottom: 7 },
  error: { color: '#FF7B72', backgroundColor: '#2A1111', paddingHorizontal: 14, paddingVertical: 8, fontSize: 12 },
  composer: { borderTopWidth: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10 },
  photoButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10, fontSize: 15 },
  sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
});
