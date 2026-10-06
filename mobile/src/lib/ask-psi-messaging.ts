import * as Crypto from 'expo-crypto';

import type { AskPsiConversationRow, AskPsiMessageRow } from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export type AskPsiTopic = AskPsiConversationRow['topic'];

export type OpenAskPsiConversationInput = {
  bookingRequestId?: string | null;
  body: string;
  topic: AskPsiTopic;
  vehicleId?: string | null;
};

export type AskPsiConversationWithMessages = {
  conversation: AskPsiConversationRow;
  messages: AskPsiMessageRow[];
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
  return {
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
