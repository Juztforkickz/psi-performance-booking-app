import * as ImageManipulator from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui';
import { colors } from '@/constants/brand';
import type { LocalVehiclePhoto } from '@/lib/local-vehicle-photo';

export function GaragePhotoFraming({ photo, onCancel, onSave }: { photo: LocalVehiclePhoto | null; onCancel: () => void; onSave: (photo: LocalVehiclePhoto) => void }) {
  const [position, setPosition] = useState(.5);
  const [fit, setFit] = useState(false);
  const [result, setResult] = useState<{ source: string; position: number; fit: boolean; photo: LocalVehiclePhoto } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!photo) return;
    let live = true;
    const width = photo.width; const height = photo.height;
    if (!width || !height) return;
    const cropWidth = Math.min(width, height * 16 / 9);
    const cropHeight = cropWidth * 9 / 16;
    const actions: ImageManipulator.Action[] = fit ? [] : [{ crop: { originX: Math.round((width - cropWidth) * position), originY: Math.round((height - cropHeight) * position), width: Math.floor(cropWidth), height: Math.floor(cropHeight) } }];
    actions.push({ resize: fit && height > width ? { height: Math.min(1600, height) } : { width: Math.min(1600, Math.round(fit ? width : cropWidth)) } });
    ImageManipulator.manipulateAsync(photo.uri, actions, { compress: .82, format: ImageManipulator.SaveFormat.JPEG }).then(value => { if (live) { setResult({ source: photo.uri, fit, position, photo: { uri: value.uri, width: value.width, height: value.height, mimeType: 'image/jpeg', fileSize: null } }); setError(''); } }).catch(() => { if (live) setError('This photo could not be prepared. Please choose another photo.'); });
    return () => { live = false; };
  }, [photo, position, fit]);
  const ready = result?.source === photo?.uri && result?.position === position && result?.fit === fit;
  return <Modal visible={!!photo} animationType="slide" onRequestClose={onCancel}><SafeAreaView style={st.screen}><View style={st.content}>
    <Text style={st.title}>Frame your car</Text><Text style={st.copy}>Preview your horizontal garage photo. Move the crop to keep the car in view, or fit the whole photo.</Text>
    <View style={st.frame}>{ready && result ? <Image source={{ uri: result.photo.uri }} resizeMode="contain" style={st.image} /> : <ActivityIndicator color={colors.accent} />}</View>
    <View style={st.row}><Pressable style={st.choice} accessibilityRole="button" onPress={() => setFit(false)}><Text style={st.copy}>{!fit ? '✓ ' : ''}Landscape crop</Text></Pressable><Pressable style={st.choice} accessibilityRole="button" onPress={() => setFit(true)}><Text style={st.copy}>{fit ? '✓ ' : ''}Fit whole photo</Text></Pressable></View>
    {!fit ? <View style={st.row}><PrimaryButton label="Move crop back" variant="outline" onPress={() => setPosition(v => Math.max(0, v - .1))} /><PrimaryButton label="Move crop forward" variant="outline" onPress={() => setPosition(v => Math.min(1, v + .1))} /></View> : null}
    {error ? <Text accessibilityRole="alert" style={st.copy}>{error}</Text> : null}
    <PrimaryButton label="Use this photo" disabled={!ready || !!error} onPress={() => { if (ready && result) onSave(result.photo); }} />
    <PrimaryButton label="Cancel" variant="outline" onPress={onCancel} />
  </View></SafeAreaView></Modal>;
}
const st = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.ink }, content: { padding: 22, gap: 20, maxWidth: 850, width: '100%', alignSelf: 'center' }, title: { color: colors.white, fontSize: 26, fontWeight: '800' }, copy: { color: colors.silver, fontSize: 15, lineHeight: 22 }, frame: { aspectRatio: 16 / 9, width: '100%', backgroundColor: colors.panel, justifyContent: 'center', borderRadius: 8, overflow: 'hidden' }, image: { width: '100%', height: '100%' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, choice: { padding: 13, borderColor: colors.accentDark, borderWidth: 1, borderRadius: 5 } });
