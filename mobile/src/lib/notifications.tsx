import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { type Href, useRouter } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useCustomerAuth } from '@/lib/customer-auth-context';
import type { NotificationEventRow, NotificationPreferenceRow } from '@/lib/database.types';
import { createNotificationRequestScope, createNotificationResponseTracker } from '@/lib/notification-lifecycle';
import { getSupabaseClient, SUPABASE_CONNECTION } from '@/lib/supabase';
import { appModeRuntime, environmentStorageKey, REVIEW_ENVIRONMENT } from '@/lib/review-environment';

type PushStatus = 'disabled' | 'not_enabled' | 'ready' | 'unsupported';
type NotificationContextValue = {
  customerUnreadCount: number;
  disablePush: () => Promise<void>;
  enablePush: () => Promise<void>;
  events: NotificationEventRow[];
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  preferences: NotificationPreferenceRow | null;
  pushStatus: PushStatus;
  refresh: () => Promise<void>;
  setPreference: (key: PreferenceKey, value: boolean) => Promise<void>;
  staffUnreadCount: number;
  unreadCount: number;
};
type PreferenceKey = 'booking_reminders_enabled' | 'booking_updates_enabled' | 'event_alerts_enabled' | 'sound_enabled' | 'workshop_alerts_enabled';

const NotificationContext = createContext<NotificationContextValue | null>(null);
let registeredToken = '';
const PUSH_TOKEN_STORAGE_KEY = environmentStorageKey('psi-notifications.expo-push-token');
const PUSH_ENABLED_STORAGE_KEY = environmentStorageKey('psi-notifications.device-alerts-enabled');
const EMPTY_EVENTS: NotificationEventRow[] = [];

async function ensureAndroidNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('psi-workshop', {
      name: 'PSI workshop enquiries',
      description: 'New customer enquiries and workshop actions.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#65CFF8',
      sound: 'default',
    }),
    Notifications.setNotificationChannelAsync('psi-customer', {
      name: 'My PSI updates',
      description: 'Updates about your bookings, events and vehicle records.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#D92D20',
      sound: 'default',
    }),
  ]);
}

function responseHref(data: Record<string, unknown> | undefined): Href | null {
  const url = data?.url;
  const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : '';
  if (url === '/staff') return bookingId ? { pathname: '/staff', params: { bookingId, section: 'bookings' } } : { pathname: '/staff', params: { section: 'alerts' } };
  if (url === '/bookings' || url === '/events') return url;
  return null;
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const normalMode = appModeRuntime.ready && !REVIEW_ENVIRONMENT.enabled;
      return { shouldPlaySound: normalMode && notification.request.content.sound != null, shouldSetBadge: normalMode, shouldShowBanner: normalMode, shouldShowList: normalMode };
    },
  });
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const auth = useCustomerAuth();
  const router = useRouter();
  const userId = auth.status === 'signed_in' && SUPABASE_CONNECTION.authEnabled ? auth.user?.id ?? null : null;
  const [snapshot, setSnapshot] = useState<{ scope: ReturnType<typeof createNotificationRequestScope> | null; events: NotificationEventRow[]; preferences: NotificationPreferenceRow | null }>({ scope: null, events: [], preferences: null });
  const [pushSnapshot, setPushSnapshot] = useState<{ scope: ReturnType<typeof createNotificationRequestScope> | null; status: PushStatus }>({ scope: null, status: 'not_enabled' });
  const scope = useMemo(() => ({ userId, data: createNotificationRequestScope(), push: createNotificationRequestScope() }), [userId]);
  const manualPushOperations = useRef(0);
  const automaticPushSync = useRef<Promise<void> | null>(null);
  const responseTracker = useMemo(() => createNotificationResponseTracker(), []);
  const events = userId && snapshot.scope === scope.data ? snapshot.events : EMPTY_EVENTS;
  const preferences = userId && snapshot.scope === scope.data ? snapshot.preferences : null;
  const pushStatus: PushStatus = Platform.OS === 'web' ? 'unsupported' : REVIEW_ENVIRONMENT.enabled ? 'disabled'
    : userId && pushSnapshot.scope === scope.push ? pushSnapshot.status : 'not_enabled';
  const setPushStatus = useCallback((status: PushStatus) => setPushSnapshot({ scope: scope.push, status }), [scope]);

  useEffect(() => {
    scope.data.open();
    scope.push.open();
    return () => { scope.data.close(); scope.push.close(); };
  }, [scope]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const isCurrent = scope.data.begin();
    const supabase = getSupabaseClient();
    const [eventResult, preferenceResult] = await Promise.all([
      supabase.from('notification_events').select('*').eq('recipient_user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (!isCurrent()) return;
    if (eventResult.error) throw eventResult.error;
    if (preferenceResult.error) throw preferenceResult.error;
    let preference = preferenceResult.data;
    if (!preference) {
      const created = await supabase.from('notification_preferences').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (!isCurrent()) return;
      if (created.error) throw created.error;
      const existing = await supabase.from('notification_preferences').select('*').eq('user_id', userId).single();
      if (!isCurrent()) return;
      if (existing.error) throw existing.error;
      preference = existing.data;
    }
    setSnapshot({ scope: scope.data, events: eventResult.data ?? [], preferences: preference });
  }, [scope, userId]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh().catch(() => undefined); }, 0);
    return () => clearTimeout(timer);
  }, [refresh, auth.sessionRevision]);

  useEffect(() => {
    if (REVIEW_ENVIRONMENT.enabled || Platform.OS === 'web' || !userId) return;
    let active = true;
    let syncing = false;
    const syncRegistration = async () => {
      if (syncing || manualPushOperations.current > 0 || !active) return;
      syncing = true;
      const isCurrent = scope.push.begin();
      try {
        const [enabled, storedToken] = await Promise.all([
          SecureStore.getItemAsync(PUSH_ENABLED_STORAGE_KEY),
          SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY),
        ]);
        if (!active || !isCurrent()) return;
        if (enabled !== 'true' && !storedToken) {
          setPushStatus('not_enabled');
          return;
        }
        if (!Device.isDevice) {
          setPushStatus('unsupported');
          return;
        }
        await ensureAndroidNotificationChannels();
        const permission = await Notifications.getPermissionsAsync();
        if (!active || !isCurrent()) return;
        if (permission.status !== 'granted') {
          setPushStatus('not_enabled');
          return;
        }
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
          setPushStatus('disabled');
          return;
        }
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!active || !isCurrent()) return;
        const { error } = await getSupabaseClient().functions.invoke('process-push-notifications', {
          body: { action: 'register_device', expoPushToken: token, platform: Platform.OS },
        });
        if (!active || !isCurrent()) return;
        if (error) throw error;
        registeredToken = token;
        await Promise.all([
          SecureStore.setItemAsync(PUSH_ENABLED_STORAGE_KEY, 'true'),
          SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token),
        ]);
        if (active && isCurrent()) setPushStatus('ready');
      } catch {
        if (active && isCurrent()) setPushStatus('disabled');
      } finally {
        syncing = false;
      }
    };
    const startSync = () => {
      if (syncing || manualPushOperations.current > 0 || !active) return;
      const task = syncRegistration();
      automaticPushSync.current = task;
      void task.finally(() => { if (automaticPushSync.current === task) automaticPushSync.current = null; });
    };
    startSync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') startSync();
    });
    return () => { active = false; subscription.remove(); };
  }, [auth.sessionRevision, scope, setPushStatus, userId]);

  useEffect(() => {
    if (REVIEW_ENVIRONMENT.enabled || Platform.OS === 'web' || !userId) return;
    let active = true;
    const received = Notifications.addNotificationReceivedListener(() => { void refresh().catch(() => undefined); });
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!active || !response || !responseTracker.consume(response.notification.request.identifier, response.actionIdentifier)) return;
      const href = responseHref(response.notification.request.content.data);
      if (href) router.push(href);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      void refresh().catch(() => undefined);
    };
    const responded = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => undefined);
    return () => { active = false; received.remove(); responded.remove(); };
  }, [refresh, responseTracker, router, userId]);

  useEffect(() => {
    if (auth.status !== 'signed_in') return;
    let active = AppState.currentState === 'active';
    const refreshWhileActive = () => { if (active) void refresh().catch(() => undefined); };
    const interval = setInterval(refreshWhileActive, 30_000);
    const appState = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      if (active) refreshWhileActive();
    });
    return () => { clearInterval(interval); appState.remove(); };
  }, [auth.status, refresh]);

  const unreadCount = useMemo(() => events.filter((event) => !event.read_at).length, [events]);
  const staffUnreadCount = useMemo(() => events.filter((event) => !event.read_at && event.deep_link === '/staff').length, [events]);
  const customerUnreadCount = unreadCount - staffUnreadCount;
  useEffect(() => {
    if (!REVIEW_ENVIRONMENT.enabled && Platform.OS !== 'web') void Notifications.setBadgeCountAsync(pushStatus === 'ready' ? unreadCount : 0).catch(() => undefined);
  }, [pushStatus, unreadCount]);

  const enablePush = useCallback(async () => {
    if (REVIEW_ENVIRONMENT.enabled) throw new Error('REVIEW_EXTERNAL_PUSH_DISABLED');
    if (Platform.OS === 'web' || !Device.isDevice) {
      setPushStatus('unsupported');
      throw new Error('NATIVE_DEVICE_REQUIRED');
    }
    if (!userId || !scope.push.isActive()) throw new Error('SIGN_IN_REQUIRED');
    manualPushOperations.current += 1;
    const isCurrent = scope.push.begin();
    try {
      await automaticPushSync.current;
      if (!isCurrent()) throw new Error('ACCOUNT_CHANGED');
      await ensureAndroidNotificationChannels();
      const existing = await Notifications.getPermissionsAsync();
      if (!isCurrent()) throw new Error('ACCOUNT_CHANGED');
      const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      if (!isCurrent()) throw new Error('ACCOUNT_CHANGED');
      if (permission.status !== 'granted') throw new Error('NOTIFICATION_PERMISSION_DENIED');
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) throw new Error('EAS_PROJECT_ID_MISSING');
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (!isCurrent()) throw new Error('ACCOUNT_CHANGED');
      const { error } = await getSupabaseClient().functions.invoke('process-push-notifications', {
        body: { action: 'register_device', expoPushToken: token, platform: Platform.OS },
      });
      if (!isCurrent()) throw new Error('ACCOUNT_CHANGED');
      if (error) throw error;
      registeredToken = token;
      await Promise.all([
        SecureStore.setItemAsync(PUSH_ENABLED_STORAGE_KEY, 'true'),
        SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token),
      ]);
      if (isCurrent()) setPushStatus('ready');
    } catch (error) {
      if (isCurrent()) setPushStatus(error instanceof Error && error.message === 'NOTIFICATION_PERMISSION_DENIED' ? 'not_enabled' : 'disabled');
      throw error;
    } finally {
      manualPushOperations.current -= 1;
    }
  }, [scope, setPushStatus, userId]);

  const disablePush = useCallback(async () => {
    if (REVIEW_ENVIRONMENT.enabled) return;
    if (Platform.OS === 'web') {
      setPushStatus('unsupported');
      throw new Error('NATIVE_DEVICE_REQUIRED');
    }
    if (!userId || !scope.push.isActive()) throw new Error('SIGN_IN_REQUIRED');
    manualPushOperations.current += 1;
    const isCurrent = scope.push.begin();
    try {
      // Finish any earlier registration before sending the explicit opt-out.
      await automaticPushSync.current;
      if (!isCurrent()) throw new Error('ACCOUNT_CHANGED');
      const token = registeredToken || await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY) || '';
      if (!isCurrent()) throw new Error('ACCOUNT_CHANGED');
      if (token) {
        const { error } = await getSupabaseClient().functions.invoke('process-push-notifications', {
          body: { action: 'unregister_device', expoPushToken: token },
        });
        if (!isCurrent()) throw new Error('ACCOUNT_CHANGED');
        if (error) throw error;
      }
      await Promise.all([
        SecureStore.deleteItemAsync(PUSH_ENABLED_STORAGE_KEY),
        SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY),
      ]);
      registeredToken = '';
      await Notifications.setBadgeCountAsync(0).catch(() => undefined);
      if (isCurrent()) setPushStatus('not_enabled');
    } finally {
      manualPushOperations.current -= 1;
    }
  }, [scope, setPushStatus, userId]);

  const setPreference = useCallback(async (key: PreferenceKey, value: boolean) => {
    if (!userId || !scope.data.isActive()) throw new Error('SIGN_IN_REQUIRED');
    const update = key === 'booking_updates_enabled' ? { booking_updates_enabled: value }
      : key === 'booking_reminders_enabled' ? { booking_reminders_enabled: value }
        : key === 'event_alerts_enabled' ? { event_alerts_enabled: value }
          : key === 'workshop_alerts_enabled' ? { workshop_alerts_enabled: value }
            : { sound_enabled: value };
    const { data, error } = await getSupabaseClient().from('notification_preferences').update({ ...update, updated_at: new Date().toISOString() }).eq('user_id', userId).select('*').single();
    if (error) throw error;
    if (!scope.data.isActive()) return;
    scope.data.invalidate();
    setSnapshot((current) => current.scope === scope.data ? { ...current, preferences: data } : current);
  }, [scope, userId]);

  const markRead = useCallback(async (id: string) => {
    if (!userId || !scope.data.isActive()) throw new Error('SIGN_IN_REQUIRED');
    const now = new Date().toISOString();
    const { error } = await getSupabaseClient().from('notification_events').update({ read_at: now }).eq('id', id).eq('recipient_user_id', userId);
    if (error) throw error;
    if (!scope.data.isActive()) return;
    scope.data.invalidate();
    setSnapshot((current) => current.scope === scope.data ? { ...current, events: current.events.map((event) => event.id === id ? { ...event, read_at: event.read_at ?? now } : event) } : current);
  }, [scope, userId]);

  const markAllRead = useCallback(async () => {
    if (!userId || !scope.data.isActive()) throw new Error('SIGN_IN_REQUIRED');
    const unreadIds = events.filter((event) => !event.read_at).map((event) => event.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    const { error } = await getSupabaseClient().from('notification_events').update({ read_at: now }).in('id', unreadIds).eq('recipient_user_id', userId);
    if (error) throw error;
    if (!scope.data.isActive()) return;
    scope.data.invalidate();
    const updatedIds = new Set(unreadIds);
    setSnapshot((current) => current.scope === scope.data ? { ...current, events: current.events.map((event) => updatedIds.has(event.id) ? { ...event, read_at: event.read_at ?? now } : event) } : current);
  }, [events, scope, userId]);

  const value = useMemo<NotificationContextValue>(() => ({ customerUnreadCount, disablePush, enablePush, events, markAllRead, markRead, preferences, pushStatus, refresh, setPreference, staffUnreadCount, unreadCount }), [customerUnreadCount, disablePush, enablePush, events, markAllRead, markRead, preferences, pushStatus, refresh, setPreference, staffUnreadCount, unreadCount]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used inside NotificationProvider');
  return value;
}

export async function dispatchBookingPushNotifications(bookingId: string) {
  if (REVIEW_ENVIRONMENT.enabled) return;
  if (!SUPABASE_CONNECTION.authEnabled) return;
  await getSupabaseClient().functions.invoke('process-push-notifications', { body: { action: 'dispatch', bookingId } });
}

export async function dispatchPsiEventPushNotifications() {
  if (REVIEW_ENVIRONMENT.enabled) return;
  if (!SUPABASE_CONNECTION.authEnabled) return;
  await getSupabaseClient().functions.invoke('process-push-notifications', { body: { action: 'dispatch' } });
}

export async function sendTestPushNotifications() {
  if (REVIEW_ENVIRONMENT.enabled) throw new Error('REVIEW_EXTERNAL_PUSH_DISABLED');
  if (!SUPABASE_CONNECTION.authEnabled) throw new Error('SIGN_IN_REQUIRED');
  const { data, error } = await getSupabaseClient().functions.invoke('process-push-notifications', {
    body: { action: 'send_test_alerts' },
  });
  if (error) throw error;
  return data as { processed: number; sent: number };
}

export async function unregisterCurrentPushDevice() {
  if (REVIEW_ENVIRONMENT.enabled) return;
  if (Platform.OS !== 'web' && !registeredToken) registeredToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY) ?? '';
  if (!registeredToken || !SUPABASE_CONNECTION.authEnabled) return;
  try {
    await getSupabaseClient().functions.invoke('process-push-notifications', { body: { action: 'unregister_device', expoPushToken: registeredToken } });
  } finally {
    registeredToken = '';
  }
}
