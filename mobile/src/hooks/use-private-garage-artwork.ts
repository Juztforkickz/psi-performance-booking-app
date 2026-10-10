import { useEffect, useState } from 'react';
import { AppState, type ImageSourcePropType } from 'react-native';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { getSupabaseClient } from '@/lib/supabase';

type PrivateArtwork = { userId: string; source: ImageSourcePropType; preview: ImageSourcePropType; expiresAt: number };

export function usePrivateGarageArtwork() {
  const auth = useCustomerAuth();
  const userId = auth.status === 'signed_in' ? auth.user?.id : undefined;
  const [artwork, setArtwork] = useState<PrivateArtwork | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      try {
        const prefix = `${userId}/vehicle-artwork`;
        const { data, error } = await getSupabaseClient().storage.from('owner-garage-artwork')
          .createSignedUrls([`${prefix}.jpg`, `${prefix}-thumb.jpg`], 10 * 60);
        if (!active) return;
        if (error || !data?.[0]?.signedUrl || !data?.[1]?.signedUrl) { setArtwork(null); return; }
        setArtwork({ userId, source: { uri: data[0].signedUrl }, preview: { uri: data[1].signedUrl }, expiresAt: Date.now() + 10 * 60_000 });
      } catch { if (active) setArtwork(null); }
    };
    void load();
    const timer = setInterval(() => { void load(); }, 8 * 60_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [userId, auth.sessionRevision]);

  useEffect(() => {
    if (!artwork) return;
    const expiryTimer = setTimeout(() => setArtwork(current => current === artwork ? null : current), Math.max(0, artwork.expiresAt - Date.now()));
    return () => clearTimeout(expiryTimer);
  }, [artwork]);

  return !!userId && artwork?.userId === userId
    ? artwork : null;
}
