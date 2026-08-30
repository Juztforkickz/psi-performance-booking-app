import type { PsiEventRow } from '@/lib/database.types';
import { dispatchPsiEventPushNotifications } from '@/lib/notifications';
import { loadStaffMfaSecurityAccess } from '@/lib/staff-portal';
import { getSupabaseClient, SUPABASE_CONNECTION } from '@/lib/supabase';

export type PsiEventDraft = {
  description: string;
  location: string;
  startsAt: string;
  title: string;
};

export async function loadPublishedPsiEvents(): Promise<PsiEventRow[]> {
  if (!SUPABASE_CONNECTION.authEnabled) return [];
  const { data, error } = await getSupabaseClient()
    .from('psi_events')
    .select('*')
    .eq('status', 'published')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function loadStaffPsiEvents(): Promise<PsiEventRow[]> {
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');
  const { data, error } = await getSupabaseClient()
    .from('psi_events')
    .select('*')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPsiEvent(input: PsiEventDraft, publish: boolean) {
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready' || !access.staff.user_id) throw new Error('STAFF_AAL2_REQUIRED');
  const { data, error } = await getSupabaseClient()
    .from('psi_events')
    .insert({
      created_by: access.staff.user_id,
      description: optionalText(input.description),
      location: optionalText(input.location),
      published_at: publish ? new Date().toISOString() : null,
      starts_at: requiredFutureDate(input.startsAt),
      status: publish ? 'published' : 'draft',
      title: requiredTitle(input.title),
    })
    .select('*')
    .single();
  if (error) throw error;
  if (publish) await dispatchPsiEventPushNotifications();
  return data;
}

export async function publishPsiEvent(eventId: string) {
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');
  const { data, error } = await getSupabaseClient()
    .from('psi_events')
    .update({ published_at: new Date().toISOString(), status: 'published' })
    .eq('id', eventId)
    .eq('status', 'draft')
    .select('*')
    .single();
  if (error) throw error;
  await dispatchPsiEventPushNotifications();
  return data;
}

export async function updatePsiEvent(eventId: string, input: PsiEventDraft) {
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');
  const { data, error } = await getSupabaseClient()
    .from('psi_events')
    .update({
      description: optionalText(input.description),
      location: optionalText(input.location),
      starts_at: requiredFutureDate(input.startsAt),
      title: requiredTitle(input.title),
    })
    .eq('id', eventId)
    .neq('status', 'cancelled')
    .select('*')
    .single();
  if (error) throw error;
  await dispatchPsiEventPushNotifications();
  return data;
}

export async function cancelPsiEvent(eventId: string) {
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');
  const { data, error } = await getSupabaseClient()
    .from('psi_events')
    .update({ status: 'cancelled' })
    .eq('id', eventId)
    .neq('status', 'cancelled')
    .select('*')
    .single();
  if (error) throw error;
  await dispatchPsiEventPushNotifications();
  return data;
}

function requiredTitle(value: string) {
  const title = value.trim();
  if (!title || title.length > 80) throw new Error('PSI_EVENT_TITLE_INVALID');
  return title;
}

function requiredFutureDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('PSI_EVENT_DATE_INVALID');
  if (date.getTime() <= Date.now()) throw new Error('PSI_EVENT_DATE_PAST');
  return date.toISOString();
}

function optionalText(value: string) {
  return value.trim() || null;
}
