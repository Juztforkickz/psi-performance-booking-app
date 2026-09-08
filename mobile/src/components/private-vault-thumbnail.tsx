import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useCustomerAuth } from '@/lib/customer-auth-context';
import { getSupabaseClient } from '@/lib/supabase';
import type { VaultAsset } from '@/lib/performance-plus';
import { colors } from '@/constants/brand';

export function PrivateVaultThumbnail({ asset, onOpen }: { asset: VaultAsset; onOpen: () => void }) {
  const auth = useCustomerAuth();
  const key = `${auth.user?.id}:${asset.id}`;
  const [preview, setPreview] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!asset.thumbnail_path || auth.status !== 'signed_in') return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void getSupabaseClient().functions.invoke('open-vault-file', { body: { assetId: asset.id, thumbnail: true } }).then(({ data, error }) => {
      if (live && !error && data?.url) {
        setPreview({ key, url: data.url });
        timer = setTimeout(() => setPreview(null), 60000);
      }
    }).catch(() => {});
    return () => { live = false; clearTimeout(timer); };
  }, [asset.id, asset.thumbnail_path, auth.status, key]);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${asset.caption || 'workshop photo'}`} onPress={onOpen} style={{ flexBasis: '45%', flexGrow: 1, maxWidth: 360, gap: 8 }}>
    <View style={{ aspectRatio: 16 / 9, backgroundColor: colors.panel, borderRadius: 6, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
      {preview?.key === key && auth.status === 'signed_in' ? <Image source={{ uri: preview.url }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: colors.accent }}>Open private photo</Text>}
    </View><Text numberOfLines={2} style={{ color: colors.silver }}>{asset.caption || asset.phase || 'Workshop photo'}</Text>
  </Pressable>;
}
