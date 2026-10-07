import * as Crypto from 'expo-crypto';

import type { AskPsiAttachmentRow, AskPsiConversationRow, AskPsiMessageRow } from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export type AskPsiTopic = AskPsiConversationRow['topic'];

export type OpenAskPsiConversationInput = {
  bookingRequestId?: string | null;
  body: string;
  topic: AskPsiTopic;
  vehicleId?: string | null;
};

export type AskPsiConversationWithMessages = {
  attachments: AskPsiAttachmentView[];
  conversation: AskPsiConversationRow;
  messages: AskPsiMessageRow[];
};

export type AskPsiAttachmentView = AskPsiAttachmentRow & { signedUrl: string };

export type AskPsiPhotoInput = {
  caption?: string;
  height?: number | null;
  mimeType?: string | null;
  uri: string;
  width?: number | null;
};

export async function listAskPsiConversations() {
  const { data, error } = await getSupabaseClient()
    .from('ask_psi_conversations')
    .select('*')
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function loadAskPsiConversation(conversationId: string): Promise<AskPsiConversationWithMessages> {
  const supabase = getSupabaseClient();
  const [conversationResult, messagesResult] = await Promise.all([
    supabase.from('ask_psi_conversations').select('*').eq('id', conversationId).single(),
    supabase.from('ask_psi_messages').select('*').eq('conversation_id', conversationId).order('created_at'),
  ]);
  if (conversationResult.error) throw conversationResult.error;
  if (messagesResult.error) throw messagesResult.error;
  const messageIds = messagesResult.data.map((message) => message.id);
  const attachmentsResult = messageIds.length
    ? await supabase.from('ask_psi_attachments').select('*').in('message_id', messageIds).order('created_at')
    : { data: [], error: null };
  if (attachmentsResult.error) throw attachmentsResult.error;
  const attachments = await Promise.all((attachmentsResult.data ?? []).map(async (attachment) => {
    const { data, error } = await supabase.storage.from('ask-psi-media').createSignedUrl(attachment.object_path, 10 * 60);
    if (error) throw error;
    return { ...attachment, signedUrl: data.signedUrl };
  }));
  return {
    attachments,
    conversation: conversationResult.data,
    messages: messagesResult.data,
  };
}

export async function openAskPsiConversation(input: OpenAskPsiConversationInput) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('open_ask_psi_conversation', {
    p_body: input.body.trim(),
    p_booking_request_id: input.bookingRequestId ?? null,
    p_client_nonce: Crypto.randomUUID(),
    p_topic: input.topic,
    p_vehicle_id: input.vehicleId ?? null,
  });
  if (error) throw error;
  const created = data[0];
  if (!created) throw new Error('ASK_PSI_CONVERSATION_NOT_CREATED');
  await Promise.allSettled([dispatchAskPsiNotifications(created.conversation_id)]);
  return created;
}

export async function sendAskPsiTextMessage(conversationId: string, body: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('send_ask_psi_message', {
    p_body: body.trim(),
    p_client_nonce: Crypto.randomUUID(),
    p_conversation_id: conversationId,
    p_message_kind: 'text',
  });
  if (error) throw error;
  await Promise.allSettled([dispatchAskPsiNotifications(conversationId)]);
  return data;
}

export async function sendAskPsiPhotoMessage(conversationId: string, photo: AskPsiPhotoInput) {
  const supabase = getSupabaseClient();
  const [{ data: userResult, error: userError }, { data: conversation, error: conversationError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('ask_psi_conversations').select('*').eq('id', conversationId).single(),
  ]);
  const user = userResult.user;
  if (userError || !user) throw userError ?? new Error('CUSTOMER_SESSION_REQUIRED');
  if (conversationError) throw conversationError;

  const response = await fetch(photo.uri);
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) throw new Error('ASK_PSI_PHOTO_SIZE_INVALID');
  const mimeType = normalizePhotoMimeType(photo.mimeType, photo.uri);
  const messageId = Crypto.randomUUID();
  const clientNonce = Crypto.randomUUID();
  const objectPath = `${conversation.customer_id}/${conversationId}/${messageId}/${messageId}.${extensionForMimeType(mimeType)}`;
  const uploadResult = await supabase.storage.from('ask-psi-media').upload(objectPath, bytes, {
    cacheControl: '3600',
    contentType: mimeType,
    upsert: false,
  });
  if (uploadResult.error) throw uploadResult.error;

  const { data, error } = await supabase.rpc('send_ask_psi_photo', {
    p_caption: photo.caption?.trim() || null,
    p_client_nonce: clientNonce,
    p_conversation_id: conversationId,
    p_file_size_bytes: bytes.byteLength,
    p_height: normalizeDimension(photo.height),
    p_message_id: messageId,
    p_mime_type: mimeType,
    p_object_path: objectPath,
    p_width: normalizeDimension(photo.width),
  });
  if (error) {
    await supabase.storage.from('ask-psi-media').remove([objectPath]);
    throw error;
  }
  await Promise.allSettled([dispatchAskPsiNotifications(conversationId)]);
  return data;
}

export async function markAskPsiConversationRead(conversationId: string) {
  const { data, error } = await getSupabaseClient().rpc('mark_ask_psi_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  return data;
}

export async function setAskPsiConversationStatus(
  conversationId: string,
  status: AskPsiConversationRow['status'],
  assignToSelf = false,
) {
  const { data, error } = await getSupabaseClient().rpc('set_ask_psi_conversation_status', {
    p_assign_to_self: assignToSelf,
    p_conversation_id: conversationId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export function subscribeToAskPsiConversation(conversationId: string, onChange: () => void) {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`ask-psi:${conversationId}`)
    .on(
      'postgres_changes',
      { event: '*', filter: `conversation_id=eq.${conversationId}`, schema: 'public', table: 'ask_psi_messages' },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', filter: `id=eq.${conversationId}`, schema: 'public', table: 'ask_psi_conversations' },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

async function dispatchAskPsiNotifications(conversationId: string) {
  const { error } = await getSupabaseClient().functions.invoke('process-push-notifications', {
    body: { askPsiConversationId: conversationId },
  });
  if (error) throw error;
}

function normalizePhotoMimeType(value: string | null | undefined, uri: string) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/png' || normalized === 'image/webp') return normalized;
  const path = uri.split(/[?#]/u)[0].toLowerCase();
  if (path.endsWith('.png') || uri.startsWith('data:image/png')) return 'image/png' as const;
  if (path.endsWith('.webp') || uri.startsWith('data:image/webp')) return 'image/webp' as const;
  if (/\.jpe?g$/u.test(path) || uri.startsWith('data:image/jpeg')) return 'image/jpeg' as const;
  throw new Error('ASK_PSI_PHOTO_TYPE_UNSUPPORTED');
}

function extensionForMimeType(mimeType: 'image/jpeg' | 'image/png' | 'image/webp') {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function normalizeDimension(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 12000 ? Math.round(value) : null;
}
