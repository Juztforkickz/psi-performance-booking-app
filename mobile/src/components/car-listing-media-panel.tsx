import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, type ImageSourcePropType, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StaffModal } from '@/components/staff-modal';
import { PrimaryButton } from '@/components/ui';
import { colors, spacing } from '@/constants/brand';
import { carListingMediaUrl, carMediaError, loadCarListingMedia, removeCarListingMedia, setCarListingCover, uploadCarListingMedia, type CarListingMedia } from '@/lib/car-listing-media';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';

export function CarListingMediaPanel({ listingId, staff = false, disabled = false, preview = false, fallbackSource, onBusyChange }: {
  listingId: string; staff?: boolean; disabled?: boolean; preview?: boolean; fallbackSource?: ImageSourcePropType;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [media, setMedia] = useState<CarListingMedia[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [signedPhoto, setSignedPhoto] = useState<{ id: string; url: string } | null>(null);
  const [viewer, setViewer] = useState<{ name: string; url: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [failed, setFailed] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const lifecycle = useRef({ active: true, sequence: 0 });
  const photos = media.filter(item => item.kind === 'photo' && item.state === 'ready');
  const current = photos.find(item => item.id === selectedId) ?? photos[0];
  const photoUrl = signedPhoto?.id === current?.id ? signedPhoto?.url : '';
  const attachments = media.filter(item => item.state === 'ready' && item.kind !== 'photo');
  const locked = disabled || working || preview || REVIEW_ENVIRONMENT.enabled;

  useEffect(() => { onBusyChange?.(working); }, [working, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  const refresh = useCallback(async () => {
    if (preview) return;
    const state = lifecycle.current;
    const sequence = ++state.sequence;
    setLoading(true); setLoadFailed(false);
    try { const result = await loadCarListingMedia(listingId); if (state.active && sequence === state.sequence) setMedia(result); }
    catch { if (state.active && sequence === state.sequence) setLoadFailed(true); }
    finally { if (state.active && sequence === state.sequence) setLoading(false); }
  }, [listingId, preview]);
  useEffect(() => {
    const state = lifecycle.current;
    state.active = true;
    const timer = setTimeout(() => { void refresh(); }, 0);
    return () => { state.active = false; state.sequence++; clearTimeout(timer); };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    if (current) carListingMediaUrl(current).then(url => { if (active) setSignedPhoto({ id: current.id, url }); }).catch(() => { if (active) setMessage('Photo unavailable. Refresh attachments and try again.'); });
    return () => { active = false; };
  }, [current]);

  const open = async (item: CarListingMedia) => {
    setMessage('');
    try {
      const url = await carListingMediaUrl(item, item.kind === 'file');
      if (item.kind === 'photo') setViewer({ name: item.filename, url });
      else await Linking.openURL(url);
    } catch { setMessage('This attachment is unavailable. Refresh the listing and try again.'); }
  };
  const upload = async (files: DocumentPicker.DocumentPickerAsset[]) => {
    const result = await uploadCarListingMedia(listingId, files, setMessage);
    setFailed(result.failed);
    setMessage(`${result.uploaded} uploaded. ${result.skipped} already saved.${result.failed.length ? ` ${result.failed.length} need retry. ${result.errors[0]}` : ' Saved to this listing.'}`);
    if (!result.failed.length) setApproved(false);
    await refresh();
  };
  const pick = async (kind: 'photos' | 'videos' | 'files') => {
    if (locked || !approved) return;
    setWorking(true); setMessage('');
    try {
      if (kind === 'files') {
        const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true,
          type: ['application/pdf','text/plain','text/csv','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] });
        if (!result.canceled && result.assets.length) await upload(result.assets);
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'photos' ? ['images'] : ['videos'],
          allowsMultipleSelection: true, selectionLimit: kind === 'photos' ? 24 : 4, allowsEditing: false, quality: 1,
          exif: false, videoExportPreset: ImagePicker.VideoExportPreset.Passthrough });
        if (!result.canceled && result.assets.length) await upload(result.assets.map((asset, index) => ({ uri: asset.uri,
          name: asset.fileName ?? `${kind === 'photos' ? 'Photo' : 'Video'} ${index + 1}.${kind === 'photos' ? 'jpg' : asset.mimeType === 'video/quicktime' ? 'mov' : 'mp4'}`,
          mimeType: asset.mimeType ?? undefined, size: asset.fileSize, lastModified: 0,
        })));
      }
    } catch (error) { setMessage(carMediaError(error)); }
    finally { setWorking(false); }
  };
  const retry = async () => {
    if (locked || !approved || !failed.length) return;
    setWorking(true);
    try { await upload(failed); } catch (error) { setMessage(carMediaError(error)); }
    finally { setWorking(false); }
  };
  const change = async (action: 'cover' | 'remove', item: CarListingMedia) => {
    if (locked) return;
    setWorking(true); setMessage('');
    try {
      if (action === 'cover') await setCarListingCover(listingId, item.id);
      else await removeCarListingMedia(listingId, item.id);
      await refresh();
    } catch (error) { setMessage(carMediaError(error)); }
    finally { setWorking(false); }
  };
  const photoIndex = current ? photos.findIndex(item => item.id === current.id) : 0;
  return <View style={styles.panel}>
    {staff ? <Text accessibilityRole="header" style={styles.heading}>Photos, videos and files</Text> : null}
    {current ? <Pressable accessibilityLabel={`View photo ${photoIndex + 1} of ${photos.length}`} accessibilityRole="button" onPress={() => void open(current)}>
      {photoUrl ? <Image accessibilityLabel={`${current.filename}, listing photo`} source={{ uri: photoUrl }} resizeMode="cover" style={styles.hero} onError={() => setMessage('Photo unavailable. Refresh attachments and try again.')} /> : <View style={styles.hero}><ActivityIndicator color={colors.accent} /></View>}
    </Pressable> : fallbackSource ? <Image accessibilityLabel="PSI car listing artwork" source={fallbackSource} resizeMode="cover" style={styles.hero} /> : null}
    {photos.length > 1 ? <View style={styles.photoNav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous listing photo" onPress={() => setSelectedId(photos[(photoIndex - 1 + photos.length) % photos.length].id)} style={styles.iconButton}><Ionicons name="chevron-back" size={24} color={colors.accent} /></Pressable>
      <Text style={styles.copy}>{photoIndex + 1} of {photos.length} photos</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next listing photo" onPress={() => setSelectedId(photos[(photoIndex + 1) % photos.length].id)} style={styles.iconButton}><Ionicons name="chevron-forward" size={24} color={colors.accent} /></Pressable>
    </View> : null}
    {staff && current ? <PrimaryButton disabled={locked || current.is_cover} label={current.is_cover ? 'Cover photo' : 'Use this as cover photo'} variant="outline" onPress={() => void change('cover', current)} /> : null}
    {attachments.map(item => <Pressable accessibilityRole="button" accessibilityLabel={`${item.kind === 'video' ? 'Play video' : 'Open file'} ${item.filename}`} key={item.id} onPress={() => void open(item)} style={styles.file}>
      <Ionicons color={colors.accent} name={item.kind === 'video' ? 'play-circle-outline' : 'document-outline'} size={28} />
      <View style={styles.fileCopy}><Text style={styles.filename}>{item.filename}</Text><Text style={styles.copy}>{item.kind === 'video' ? 'Play video' : 'Open file'} · {fileSize(item.size_bytes)}</Text></View>
    </Pressable>)}
    {loading ? <ActivityIndicator color={colors.accent} /> : null}
    {loadFailed ? <Text accessibilityRole="alert" style={styles.copy}>Attachments could not be loaded. Refresh and try again.</Text> : null}
    {staff ? <>
      <Text style={styles.copy}>Only attach media approved by the vehicle owner for this sale listing. Drafts stay private. Published and under offer listings share completed attachments with app users. Private workshop files are separate.</Text>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: approved, disabled: locked }} disabled={locked} onPress={() => setApproved(value => !value)} style={styles.file}>
        <Ionicons color={colors.accent} name={approved ? 'checkbox' : 'square-outline'} size={26} /><Text style={styles.fileCopy}>I have permission to share these attachments with the listing.</Text>
      </Pressable>
      <View style={styles.actions}>
        <PrimaryButton disabled={locked || !approved} label="Add photos" onPress={() => void pick('photos')} />
        <PrimaryButton disabled={locked || !approved} label="Add videos" variant="outline" onPress={() => void pick('videos')} />
        <PrimaryButton disabled={locked || !approved} label="Add files" variant="outline" onPress={() => void pick('files')} />
      </View>
      <Text style={styles.copy}>Up to 24 attachments. Photos are resized. Videos up to 50 MB each, documents up to 20 MB. Videos open in your phone player or browser.</Text>
      {failed.length ? <PrimaryButton disabled={locked || !approved} label={`Retry ${failed.length} unfinished uploads`} onPress={() => void retry()} /> : null}
      {!loading && !media.length ? <Text style={styles.copy}>No attachments yet.</Text> : media.map(item => <View key={item.id} style={styles.file}>
        <View style={styles.fileCopy}><Text style={styles.filename}>{item.filename}</Text><Text style={styles.copy}>{item.state === 'pending' ? 'Upload unfinished, select the same file to resume' : item.is_cover ? 'Cover photo' : item.kind} · {fileSize(item.size_bytes)}</Text></View>
        <Pressable accessibilityLabel={`Remove ${item.filename} from listing`} accessibilityRole="button" disabled={locked} onPress={() => void change('remove', item)} style={styles.iconButton}><Ionicons color={colors.danger} name="close-circle-outline" size={25} /></Pressable>
      </View>)}
    </> : null}
    {message ? <Text accessibilityRole="alert" style={styles.copy}>{message}</Text> : null}
    {!preview && (staff || loadFailed || message) ? <PrimaryButton disabled={working} label="Refresh attachments" variant="outline" onPress={() => void refresh()} /> : null}
    <StaffModal visible={Boolean(viewer)} onRequestClose={() => setViewer(null)} animationType="slide">
      <View style={styles.viewer}><View style={styles.viewerHeader}><Text style={styles.viewerTitle}>{viewer?.name}</Text><PrimaryButton label="Close photo" onPress={() => setViewer(null)} variant="outline" /></View>
        <ScrollView contentContainerStyle={styles.photoScroll}>{viewer ? <Image accessibilityLabel={viewer.name} source={{ uri: viewer.url }} resizeMode="contain" style={styles.fullPhoto} /> : null}</ScrollView>
      </View>
    </StaffModal>
  </View>;
}
function fileSize(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`; }
const styles = StyleSheet.create({
  panel: { gap: spacing.sm }, heading: { color: colors.white, fontSize: 17, fontWeight: '700' },
  hero: { width: '100%', height: 220, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  photoNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20 }, filename: { color: colors.white, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  file: { padding: spacing.sm, gap: spacing.sm, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  fileCopy: { flex: 1, minWidth: 0, color: colors.white, fontSize: 14, lineHeight: 21 }, actions: { gap: spacing.sm },
  viewer: { flex: 1, backgroundColor: colors.ink }, viewerHeader: { padding: spacing.md, gap: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  viewerTitle: { flex: 1, minWidth: 0, color: colors.white, fontSize: 15, fontWeight: '600' },
  photoScroll: { flexGrow: 1 }, fullPhoto: { width: '100%', minHeight: 300, flex: 1 },
});
