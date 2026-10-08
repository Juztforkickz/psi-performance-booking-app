import type { Href } from 'expo-router';

import type { NotificationEventRow } from '@/lib/database.types';
import type { StaffSection } from '@/lib/staff-navigation';

type NotificationNavigationEvent = Pick<NotificationEventRow, 'ask_psi_conversation_id' | 'booking_request_id' | 'deep_link' | 'kind' | 'source_event_key'>;

export type StaffNotificationDestination = {
  label: string;
  params: Record<string, string>;
  section: StaffSection;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function xeroImportId(sourceEventKey: string) {
  const [prefix, id] = sourceEventKey.split(':');
  return prefix === 'xero_invoice_review' && UUID_PATTERN.test(id ?? '') ? id : '';
}

export function isWorkshopNotification(event: Pick<NotificationNavigationEvent, 'deep_link'>) {
  return ['/staff', '/staff-messages', '/staff-security'].includes(event.deep_link.split('?')[0]);
}

export function staffNotificationDestination(event: NotificationNavigationEvent): StaffNotificationDestination | null {
  if (event.deep_link !== '/staff') return null;
  if (event.kind === 'xero_invoice_review') {
    const importId = xeroImportId(event.source_event_key);
    return { label: importId ? 'Open this invoice' : 'Open Imports & drafts', params: importId ? { importId } : {}, section: 'imports' };
  }
  if (event.kind === 'new_booking_request') {
    return {
      label: event.booking_request_id ? 'Open booking request' : 'Open bookings needing action',
      params: event.booking_request_id ? { bookingId: event.booking_request_id } : { view: 'needs' },
      section: 'bookings',
    };
  }
  if (event.kind === 'performance_subscription_started') {
    return { label: 'Open subscription alert', params: {}, section: 'alerts' };
  }
  if (event.kind === 'historical_import_received') {
    return { label: 'Open history import requests', params: {}, section: 'history_imports' };
  }
  return event.booking_request_id
    ? { label: 'Open booking', params: { bookingId: event.booking_request_id }, section: 'bookings' }
    : { label: 'Open workshop inbox', params: {}, section: 'alerts' };
}

export function notificationDestination(event: NotificationNavigationEvent): { href: Href; label: string } {
  if (UUID_PATTERN.test(event.ask_psi_conversation_id ?? '') && event.kind === 'customer_message_received') {
    return { href: { pathname: '/staff-messages', params: { conversationId: event.ask_psi_conversation_id } } as unknown as Href, label: 'Open customer message' };
  }
  if (UUID_PATTERN.test(event.ask_psi_conversation_id ?? '') && event.kind === 'staff_message_received') {
    return { href: { pathname: '/messages', params: { conversationId: event.ask_psi_conversation_id } } as unknown as Href, label: 'Open PSI reply' };
  }
  const staffDestination = staffNotificationDestination(event);
  if (staffDestination) {
    return {
      href: { pathname: '/staff', params: { section: staffDestination.section, ...staffDestination.params } },
      label: staffDestination.label,
    };
  }
  if (event.deep_link === '/customer-cars-for-sale') return { href: '/customer-cars-for-sale', label: 'Open Customer Cars for Sale' };
  if (event.deep_link === '/events') return { href: '/events', label: 'Open PSI Events' };
  if (event.deep_link === '/performance-plus') return { href: '/performance-plus', label: 'Continue with Performance+' };
  if (event.deep_link === '/history-import') return { href: '/history-import' as Href, label: 'Open history import' };
  return { href: '/bookings', label: 'Open Bookings' };
}

export function pushNotificationHref(data: Record<string, unknown> | undefined): Href | null {
  const deepLink = typeof data?.url === 'string' ? data.url : '';
  const route = deepLink.split('?')[0];
  if (!['/staff', '/booking', '/bookings', '/customer-cars-for-sale', '/events', '/history-import', '/performance-plus', '/staff-messages', '/messages'].includes(route)) return null;
  const kind = typeof data?.kind === 'string' ? data.kind : '';
  const bookingRequestId = typeof data?.bookingId === 'string' ? data.bookingId : null;
  const askPsiConversationId = typeof data?.askPsiConversationId === 'string' ? data.askPsiConversationId : null;
  const sourceEventKey = typeof data?.sourceEventKey === 'string' ? data.sourceEventKey : '';
  if (route === '/staff-messages' && (kind !== 'customer_message_received' || !UUID_PATTERN.test(askPsiConversationId ?? ''))) return null;
  if (route === '/messages' && (kind !== 'staff_message_received' || !UUID_PATTERN.test(askPsiConversationId ?? ''))) return null;
  return notificationDestination({
    ask_psi_conversation_id: askPsiConversationId,
    booking_request_id: bookingRequestId,
    deep_link: route as NotificationNavigationEvent['deep_link'],
    kind: kind as NotificationNavigationEvent['kind'],
    source_event_key: sourceEventKey,
  }).href;
}
