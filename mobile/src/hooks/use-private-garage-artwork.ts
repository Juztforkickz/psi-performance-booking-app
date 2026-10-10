import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, type ImageSourcePropType } from 'react-native';
import { useCustomerAccount } from '@/lib/customer-account-context';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { garageStartupKey, jpegDataUri, parseGarageStartupCache, type GarageStartupCache } from '@/lib/garage-startup-cache';
import { getSupabaseClient } from '@/lib/supabase';

type PrivateArtwork = { userId: string; source: ImageSourcePropType; preview: ImageSourcePropType };
type StartupState = { cache: GarageStartupCache | null; hydratedUserId: string; remoteFinished: boolean };
type ArtworkContext = { artwork: PrivateArtwork | null; display: { vehicleId: string; illustrationId: string } | null; ready: boolean };
const Context = createContext<ArtworkContext>({ artwork: null, display: null, ready: false });

export function PrivateGarageArtworkProvider({ children }: PropsWithChildren) {
  const auth = useCustomerAuth();
  const { account, status: accountStatus } = useCustomerAccount();
  const userId = auth.status === 'signed_in' ? auth.user?.id : undefined;
  const allowPrivate = auth.user?.email?.toLowerCase() === 'matt@psiperformance.com.au';
  const [state, setState] = useState<StartupState>({ cache: null, hydratedUserId: '', remoteFinished: false });
  const currentUser = useRef(userId);
  useEffect(() => { currentUser.current = userId; }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const loadImages = async () => {
      if (!allowPrivate) { if (active) setState(previous => ({ ...previous, remoteFinished: true })); return; }
      try {
        const prefix = `${userId}/vehicle-artwork`;
        const { data, error } = await getSupabaseClient().storage.from('owner-garage-artwork')
          .createSignedUrls([`${prefix}.jpg`, `${prefix}-thumb.jpg`], 10 * 60);
        if (error || !data?.[0]?.signedUrl || !data?.[1]?.signedUrl) throw new Error('ARTWORK_UNAVAILABLE');
        const download = async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error('ARTWORK_DOWNLOAD_FAILED');
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length > 2_500_000 || bytes[0] !== 255 || bytes[1] !== 216) throw new Error('ARTWORK_INVALID');
          return jpegDataUri(bytes);
        };
        const [sourceUri, previewUri] = await Promise.all(data.map(item => download(item.signedUrl!)));
        if (!active || currentUser.current !== userId) return;
        setState(previous => ({ ...previous, remoteFinished: true, cache: { userId, vehicleId: previous.cache?.vehicleId ?? '', illustrationId: previous.cache?.illustrationId ?? 'porsche', sourceUri, previewUri, savedAt: Date.now() } }));
      } catch {
        if (active) setState(previous => ({ ...previous, remoteFinished: true }));
      }
    };
    const initialize = async () => {
      const stored = await AsyncStorage.getItem(garageStartupKey(userId)).catch(() => null);
      if (!active) return;
      const cache = parseGarageStartupCache(stored, userId, allowPrivate);
      setState(previous => ({ cache: previous.cache?.userId === userId ? { ...previous.cache, sourceUri: cache?.sourceUri ?? previous.cache.sourceUri, previewUri: cache?.previewUri ?? previous.cache.previewUri } : cache, hydratedUserId: userId, remoteFinished: false }));
      void loadImages();
    };
    void initialize();
    const timer = setInterval(() => { void loadImages(); }, 8 * 60_000);
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') void loadImages(); });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
      void AsyncStorage.removeItem(garageStartupKey(userId)).catch(() => undefined);
    };
  }, [userId, allowPrivate]);

  const cached = state.cache?.userId === userId ? state.cache : null;
  const currentAccount = account?.user.id === userId ? account : null;
  const vehicle = currentAccount?.vehicles.find(item => item.is_primary) ?? currentAccount?.vehicles[0];
  const vehicleId = currentAccount ? vehicle?.id ?? '' : cached?.vehicleId ?? '';
  const illustrationId = currentAccount ? currentAccount.vehicleDisplayPreferences.find(item => item.vehicle_id === vehicleId)?.illustration_id ?? 'porsche' : cached?.illustrationId ?? 'porsche';

  useEffect(() => {
    if (!userId || state.hydratedUserId !== userId || (!state.cache && !vehicleId)) return;
    const cache = { userId, sourceUri: state.cache?.userId === userId ? state.cache.sourceUri : null, previewUri: state.cache?.userId === userId ? state.cache.previewUri : null, vehicleId, illustrationId, savedAt: Date.now() };
    void AsyncStorage.setItem(garageStartupKey(cache.userId), JSON.stringify(cache)).then(() => {
      if (currentUser.current !== cache.userId) return AsyncStorage.removeItem(garageStartupKey(cache.userId));
    }).catch(() => undefined);
  }, [state.cache, state.hydratedUserId, userId, vehicleId, illustrationId]);

  const artwork = userId && allowPrivate && cached?.sourceUri && cached.previewUri
    ? { userId, source: { uri: cached.sourceUri }, preview: { uri: cached.previewUri } } : null;
  const ready = auth.status !== 'loading' && (!userId || (state.hydratedUserId === userId
    && (Boolean(vehicleId) || accountStatus === 'ready' || accountStatus === 'error')
    && (illustrationId !== 'personal-vehicle-artwork' || Boolean(artwork) || state.remoteFinished)));
  return createElement(Context.Provider, { value: { artwork, display: vehicleId ? { vehicleId, illustrationId } : null, ready } }, children);
}

export const usePrivateGarageArtwork = () => useContext(Context).artwork;
export const useGarageStartupArtwork = () => useContext(Context);
