import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';

import type { AskPsiAttachmentRow, AskPsiConversationRow, AskPsiMessageRow } from '@/lib/database.types';
import { ASK_PSI_STAGE } from '@/lib/ask-psi-stage';
import { ASK_PSI_DEVICE_QA, notificationWorkerName } from '@/lib/ask-psi-device-qa';
import { getSupabaseClient } from '@/lib/supabase';

export type AskPsiTopic = AskPsiConversationRow['topic'];
export type AskPsiInboxConversation = AskPsiConversationRow & { unread_count: number };

function getAskPsiClient() {
  if (!ASK_PSI_STAGE.privatePreviewEnabled) throw new Error('ASK_PSI_PRIVATE_PREVIEW_REQUIRED');
  return getSupabaseClient();
}

export type OpenAskPsiConversationInput = {
  bookingRequestId?: string | null;
  body: string;
  clientNonce?: string;
  topic: AskPsiTopic;
  vehicleId?: string | null;
};

export type AskPsiConversationWithMessages = {
  attachments: AskPsiAttachmentView[];
  conversation: AskPsiConversationRow;
  messages: AskPsiMessageRow[];
};

export type AskPsiAttachmentView = AskPsiAttachmentRow & { signedUrl: string | null };

export type AskPsiPhotoInput = {
  caption?: string;
  clientNonce?: string;
  height?: number | null;
  mimeType?: string | null;
  messageId?: string;
  uri: string;
  width?: number | null;
};

export async function listAskPsiConversations() {
  const supabase = getAskPsiClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw authError ?? new Error('CUSTOMER_SESSION_REQUIRED');
  const { data, error } = await supabase
    .from('ask_psi_conversations')
    .select('*')
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  if (!data.length) return [];
  const { data: unread, error: unreadError } = await supabase.from('ask_psi_messages')
    .select('conversation_id,sender_kind').in('conversation_id', data.map((row) => row.id)).is('recipient_read_at', null);
  if (unreadError) throw unreadError;
  return data.map((conversation): AskPsiInboxConversation => ({
    ...conversation,
    unread_count: unread.filter((message) => message.conversation_id === conversation.id
      && (conversation.customer_id === user.id
        ? message.sender_kind === 'staff' || message.sender_kind === 'assistant'
        : message.sender_kind === 'customer')).length,
  }));
}

export async function loadAskPsiConversation(conversationId: string): Promise<AskPsiConversationWithMessages> {
  const supabase = getAskPsiClient();
  const [conversationResult, messagesResult] = await Promise.all([
    supabase.from('ask_psi_conversations').select('*').eq('id', conversationId).single(),
    supabase.from('ask_psi_messages').select('*').eq('conversation_id', conversationId).order('created_at').order('id'),
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
    return { ...attachment, signedUrl: error ? null : data.signedUrl };
  }));
  return {
    attachments,
    conversation: conversationResult.data,
    messages: messagesResult.data,
  };
}

export async function openAskPsiConversation(input: OpenAskPsiConversationInput) {
  const supabase = getAskPsiClient();
  const { data, error } = await supabase.rpc('open_ask_psi_conversation', {
    p_body: input.body.trim(),
    p_booking_request_id: input.bookingRequestId ?? null,
    p_client_nonce: input.clientNonce ?? Crypto.randomUUID(),
    p_topic: input.topic,
    p_vehicle_id: input.vehicleId ?? null,
  });
  if (error) throw error;
  const created = data[0];
  if (!created) throw new Error('ASK_PSI_CONVERSATION_NOT_CREATED');
  await Promise.allSettled([dispatchAskPsiNotifications(created.conversation_id)]);
  return created;
}

export async function sendAskPsiTextMessage(conversationId: string, body: string, clientNonce = Crypto.randomUUID()) {
  const supabase = getAskPsiClient();
  const { data, error } = await supabase.rpc('send_ask_psi_message', {
    p_body: body.trim(),
    p_client_nonce: clientNonce,
    p_conversation_id: conversationId,
    p_message_kind: 'text',
  });
  if (error) throw error;
  await Promise.allSettled([dispatchAskPsiNotifications(conversationId)]);
  return data;
}

export async function sendAskPsiPhotoMessage(conversationId: string, photo: AskPsiPhotoInput) {
  const supabase = getAskPsiClient();
  const [{ data: userResult, error: userError }, { data: conversation, error: conversationError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('ask_psi_conversations').select('*').eq('id', conversationId).single(),
  ]);
  const user = userResult.user;
  if (userError || !user) throw userError ?? new Error('CUSTOMER_SESSION_REQUIRED');
  if (conversationError) throw conversationError;

  const messageId = photo.messageId ?? Crypto.randomUUID();
  const clientNonce = photo.clientNonce ?? Crypto.randomUUID();
  const existing = await supabase.from('ask_psi_messages').select('*')
    .eq('id', messageId).eq('client_nonce', clientNonce).eq('conversation_id', conversationId)
    .eq('sender_user_id', user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    await Promise.allSettled([dispatchAskPsiNotifications(conversationId)]);
    return existing.data;
  }

  let prepared = photo;
  if (/^image\/hei[cf]$/iu.test(photo.mimeType ?? '') || /\.hei[cf](?:[?#]|$)/iu.test(photo.uri)) {
    const converted = await ImageManipulator.manipulateAsync(photo.uri, [], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
    prepared = { ...photo, ...converted, mimeType: 'image/jpeg' };
  }
  const response = await fetch(prepared.uri);
  if (!response.ok) throw new Error('ASK_PSI_PHOTO_READ_FAILED');
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) throw new Error('ASK_PSI_PHOTO_SIZE_INVALID');
  const mimeType = normalizePhotoMimeType(prepared.mimeType, prepared.uri);
  const objectPath = `${conversation.customer_id}/${conversationId}/${messageId}/${messageId}.${extensionForMimeType(mimeType)}`;
  const uploadResult = await supabase.storage.from('ask-psi-media').upload(objectPath, bytes, {
    cacheControl: '3600',
    contentType: mimeType,
    upsert: false,
  });
  // A retry can find the object from an upload whose response was lost.
  // Registration still validates the immutable path and participant permissions.
  const uploadCode = uploadResult.error && 'code' in uploadResult.error ? String(uploadResult.error.code) : '';
  const alreadyUploaded = ['409', 'Duplicate', 'ResourceAlreadyExists'].includes(String(uploadResult.error?.statusCode))
    || ['ResourceAlreadyExists', 'Duplicate'].includes(uploadCode);
  if (uploadResult.error && !alreadyUploaded) throw uploadResult.error;

  const { data, error } = await supabase.rpc('send_ask_psi_photo', {
    p_caption: photo.caption?.trim() || null,
    p_client_nonce: clientNonce,
    p_conversation_id: conversationId,
    p_file_size_bytes: bytes.byteLength,
    p_height: normalizeDimension(prepared.height),
    p_message_id: messageId,
    p_mime_type: mimeType,
    p_object_path: objectPath,
    p_width: normalizeDimension(prepared.width),
  });
  if (error) {
    // Never delete a photo on an ambiguous network failure: the transaction
    // might already have committed. Its stable IDs let the next retry recover it.
    if (/^[0-9A-Z]{5}$/u.test(error.code) && !error.code.startsWith('08')) {
      const saved = await supabase.from('ask_psi_messages').select('id').eq('id', messageId).maybeSingle();
      if (!saved.error && !saved.data) await supabase.storage.from('ask-psi-media').remove([objectPath]);
    }
    throw error;
  }
  await Promise.allSettled([dispatchAskPsiNotifications(conversationId)]);
  return data;
}

export async function markAskPsiConversationRead(conversationId: string, readThroughMessageId?: string) {
  const { data, error } = await getAskPsiClient().rpc('mark_ask_psi_conversation_read', {
    p_conversation_id: conversationId,
    p_read_through_message_id: readThroughMessageId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function setAskPsiConversationStatus(
  conversationId: string,
  status: AskPsiConversationRow['status'],
  assignToSelf = false,
) {
  const { data, error } = await getAskPsiClient().rpc('set_ask_psi_conversation_status', {
    p_assign_to_self: assignToSelf,
    p_conversation_id: conversationId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export function subscribeToAskPsiConversation(conversationId: string, onChange: () => void) {
  const supabase = getAskPsiClient();
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

export function subscribeToAskPsiInbox(onChange: () => void) {
  const supabase = getAskPsiClient();
  const channel = supabase.channel(`ask-psi-inbox:${Crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ask_psi_conversations' }, onChange)
    .subscribe((status) => { if (status === 'SUBSCRIBED') onChange(); });
  return () => { void supabase.removeChannel(channel); };
}

async function dispatchAskPsiNotifications(conversationId: string) {
  const { error } = await getAskPsiClient().functions.invoke(notificationWorkerName(), {
    body: { action: ASK_PSI_DEVICE_QA.enabled ? 'dispatch' : undefined, askPsiConversationId: conversationId },
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
