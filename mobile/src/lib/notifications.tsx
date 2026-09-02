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
  useState,
} from 'react';
import { Platform } from 'react-native';

import { useCustomerAuth } from '@/lib/customer-auth-context';
import type { NotificationEventRow, NotificationPreferenceRow } from '@/lib/database.types';
import { getSupabaseClient, SUPABASE_CONNECTION } from '@/lib/supabase';

type PushStatus = 'disabled' | 'not_enabled' | 'ready' | 'unsupported';
type NotificationContextValue = {
  disablePush: () => Promise<void>;
  enablePush: () => Promise<void>;
  events: NotificationEventRow[];
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  preferences: NotificationPreferenceRow | null;
  pushStatus: PushStatus;
  refresh: () => Promise<void>;
  setPreference: (key: PreferenceKey, value: boolean) => Promise<void>;
  unreadCount: number;
};
type PreferenceKey = 'booking_reminders_enabled' | 'booking_updates_enabled' | 'event_alerts_enabled' | 'sound_enabled' | 'workshop_alerts_enabled';

const NotificationContext = createContext<NotificationContextValue | null>(null);
let registeredToken = '';
const PUSH_TOKEN_STORAGE_KEY = 'psi-notifications.expo-push-token';
const PUSH_ENABLED_STORAGE_KEY = 'psi-notifications.device-alerts-enabled';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
  });
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const auth = useCustomerAuth();
  const router = useRouter();
  const [events, setEvents] = useState<NotificationEventRow[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferenceRow | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus>(Platform.OS === 'web' ? 'unsupported' : 'not_enabled');

  const refresh = useCallback(async () => {
    if (auth.status !== 'signed_in' || !auth.user || !SUPABASE_CONNECTION.authEnabled) {
      setEvents([]);
      setPreferences(null);
      return;
    }
    const supabase = getSupabaseClient();
    const [eventResult, preferenceResult] = await Promise.all([
      supabase.from('notification_events').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('notification_preferences').select('*').eq('user_id', auth.user.id).maybeSingle(),
    ]);
    if (eventResult.error) throw eventResult.error;
    if (preferenceResult.error) throw preferenceResult.error;
    let preference = preferenceResult.data;
    if (!preference) {
      const created = await supabase.from('notification_preferences').insert({ user_id: auth.user.id }).select('*').single();
      if (created.error) throw created.error;
      preference = created.data;
    }
    setEvents(eventResult.data ?? []);
    setPreferences(preference);
  }, [auth.status, auth.user]);

  useEffect(() => {
    const timer = setTimeout(() => { void refresh().catch(() => undefined); }, 0);
    return () => clearTimeout(timer);
  }, [refresh, auth.sessionRevision]);

  useEffect(() => {
    if (Platform.OS === 'web' || auth.status !== 'signed_in') return;
    let active = true;
    void Promise.all([
      SecureStore.getItemAsync(PUSH_ENABLED_STORAGE_KEY),
      SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY),
    ])
      .then(async ([enabled, storedToken]) => {
        if (enabled !== 'true' && !storedToken) {
          if (active) setPushStatus('not_enabled');
          return;
        }
        if (!Device.isDevice) {
          if (active) setPushStatus('unsupported');
          return;
        }
        const permission = await Notifications.getPermissionsAsync();
        if (permission.status !== 'granted') {
          if (active) setPushStatus('not_enabled');
          return;
        }
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
          if (active) setPushStatus('disabled');
          return;
        }
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        const { error } = await getSupabaseClient().functions.invoke('process-push-notifications', {
          body: { action: 'register_device', expoPushToken: token, platform: Platform.OS },
        });
        if (error) throw error;
        registeredToken = token;
        await Promise.all([
          SecureStore.setItemAsync(PUSH_ENABLED_STORAGE_KEY, 'true'),
          SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token),
        ]);
        if (active) setPushStatus('ready');
      })
      .catch(() => {
        if (active) setPushStatus('disabled');
      });
    return () => { active = false; };
  }, [auth.sessionRevision, auth.status]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const received = Notifications.addNotificationReceivedListener(() => { void refresh(); });
    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (url === '/bookings' || url === '/events' || url === '/staff') router.push(url as Href);
      void refresh();
    });
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const url = response?.notification.request.content.data?.url;
      if (url === '/bookings' || url === '/events' || url === '/staff') router.push(url as Href);
    });
    return () => { received.remove(); responded.remove(); };
  }, [refresh, router]);

  const unreadCount = useMemo(() => events.filter((event) => !event.read_at).length, [events]);
  useEffect(() => {
    if (Platform.OS !== 'web') void Notifications.setBadgeCountAsync(pushStatus === 'ready' ? unreadCount : 0).catch(() => undefined);
  }, [pushStatus, unreadCount]);

  const enablePush = useCallback(async () => {
    if (Platform.OS === 'web' || !Device.isDevice) {
      setPushStatus('unsupported');
      throw new Error('NATIVE_DEVICE_REQUIRED');
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('psi-bookings', {
        name: 'PSI bookings', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], lightColor: '#65CFF8', sound: 'default',
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('NOTIFICATION_PERMISSION_DENIED');
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('EAS_PROJECT_ID_MISSING');
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await getSupabaseClient().functions.invoke('process-push-notifications', {
      body: { action: 'register_device', expoPushToken: token, platform: Platform.OS },
    });
    if (error) throw error;
    registeredToken = token;
    await Promise.all([
      SecureStore.setItemAsync(PUSH_ENABLED_STORAGE_KEY, 'true'),
      SecureStore.setItemAsync(PUSH_TOKEN_STORAGE_KEY, token),
    ]);
    setPushStatus('ready');
  }, []);

  const disablePush = useCallback(async () => {
    if (Platform.OS === 'web') {
      setPushStatus('unsupported');
      throw new Error('NATIVE_DEVICE_REQUIRED');
    }
    const token = registeredToken || await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY) || '';
    if (token && SUPABASE_CONNECTION.authEnabled) {
      const { error } = await getSupabaseClient().functions.invoke('process-push-notifications', {
        body: { action: 'unregister_device', expoPushToken: token },
      });
      if (error) throw error;
    }
    await Promise.all([
      SecureStore.deleteItemAsync(PUSH_ENABLED_STORAGE_KEY),
      SecureStore.deleteItemAsync(PUSH_TOKEN_STORAGE_KEY),
    ]);
    registeredToken = '';
    await Notifications.setBadgeCountAsync(0).catch(() => undefined);
    setPushStatus('not_enabled');
  }, []);

  const setPreference = useCallback(async (key: PreferenceKey, value: boolean) => {
    if (!auth.user) throw new Error('SIGN_IN_REQUIRED');
    const update = key === 'booking_updates_enabled' ? { booking_updates_enabled: value }
      : key === 'booking_reminders_enabled' ? { booking_reminders_enabled: value }
        : key === 'event_alerts_enabled' ? { event_alerts_enabled: value }
          : key === 'workshop_alerts_enabled' ? { workshop_alerts_enabled: value }
            : { sound_enabled: value };
    const { data, error } = await getSupabaseClient().from('notification_preferences').update({ ...update, updated_at: new Date().toISOString() }).eq('user_id', auth.user.id).select('*').single();
    if (error) throw error;
    setPreferences(data);
  }, [auth.user]);

  const markRead = useCallback(async (id: string) => {
    const { error } = await getSupabaseClient().from('notification_events').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    setEvents((current) => current.map((event) => event.id === id ? { ...event, read_at: new Date().toISOString() } : event));
  }, []);

  const markAllRead = useCallback(async () => {
    const unreadIds = events.filter((event) => !event.read_at).map((event) => event.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    const { error } = await getSupabaseClient().from('notification_events').update({ read_at: now }).in('id', unreadIds);
    if (error) throw error;
    setEvents((current) => current.map((event) => ({ ...event, read_at: event.read_at ?? now })));
  }, [events]);

  const value = useMemo<NotificationContextValue>(() => ({ disablePush, enablePush, events, markAllRead, markRead, preferences, pushStatus, refresh, setPreference, unreadCount }), [disablePush, enablePush, events, markAllRead, markRead, preferences, pushStatus, refresh, setPreference, unreadCount]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used inside NotificationProvider');
  return value;
}

export async function dispatchBookingPushNotifications(bookingId: string) {
  if (!SUPABASE_CONNECTION.authEnabled) return;
  await getSupabaseClient().functions.invoke('process-push-notifications', { body: { action: 'dispatch', bookingId } });
}

export async function dispatchPsiEventPushNotifications() {
  if (!SUPABASE_CONNECTION.authEnabled) return;
  await getSupabaseClient().functions.invoke('process-push-notifications', { body: { action: 'dispatch' } });
}

export async function unregisterCurrentPushDevice() {
  if (Platform.OS !== 'web' && !registeredToken) registeredToken = await SecureStore.getItemAsync(PUSH_TOKEN_STORAGE_KEY) ?? '';
  if (!registeredToken || !SUPABASE_CONNECTION.authEnabled) return;
  try {
    await getSupabaseClient().functions.invoke('process-push-notifications', { body: { action: 'unregister_device', expoPushToken: registeredToken } });
  } finally {
    registeredToken = '';
  }
}
