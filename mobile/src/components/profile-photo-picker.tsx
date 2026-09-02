import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, mobileFrame, spacing } from '@/constants/brand';
import type { LocalVehiclePhoto } from '@/lib/local-vehicle-photo';

export function ProfilePhotoPicker({
  initials,
  onChange,
  saving,
  uri,
}: {
  initials: string;
  onChange: (photo: LocalVehiclePhoto | null) => void;
  saving: boolean;
  uri: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async (source: 'camera' | 'library') => {
    if (busy || saving) return;
    setBusy(true);
    setError('');
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(source === 'camera' ? 'Camera permission is needed to take a profile photo.' : 'Photo permission is needed to choose a profile photo.');
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, allowsMultipleSelection: false, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9, selectionLimit: 1 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) throw new Error('PROFILE_PHOTO_MISSING');
      onChange({
        fileSize: asset.fileSize ?? null,
        height: asset.height,
        mimeType: asset.mimeType ?? null,
        uri: asset.uri,
        width: asset.width,
      });
    } catch {
      setError(source === 'camera' ? 'The camera could not be opened. Try again or choose a saved photo.' : 'That photo could not be opened. Choose another image and try again.');
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || saving;
  return (
    <View style={styles.container}>
      <View style={styles.photoFrame}>
        {uri ? <Image accessibilityLabel="Your profile photo" resizeMode="cover" source={{ uri }} style={styles.photo} /> : (
          <View accessibilityLabel="No profile photo selected" style={styles.initialsFrame}>
            <Text style={styles.initials}>{initials || 'PSI'}</Text>
          </View>
        )}
        {disabled ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View> : null}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Profile photo</Text>
        <Text style={styles.notice}>Private to your account and authorised PSI staff.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <PhotoAction disabled={disabled} icon="camera-outline" label="Take photo" onPress={() => void choose('camera')} />
          <PhotoAction disabled={disabled} icon="images-outline" label="Choose photo" onPress={() => void choose('library')} />
          {uri ? <PhotoAction disabled={disabled} icon="trash-outline" label="Remove" onPress={() => onChange(null)} /> : null}
        </View>
      </View>
    </View>
  );
}

function PhotoAction({ disabled, icon, label, onPress }: { disabled: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && styles.disabled]}>
      <Ionicons color={colors.accent} name={icon} size={17} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photoFrame: { ...mobileFrame, width: 94, height: 94, flexShrink: 0, overflow: 'hidden', borderRadius: 47, backgroundColor: colors.ink },
  photo: { width: '100%', height: '100%' },
  initialsFrame: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.accent, fontSize: 24, fontWeight: '900', textTransform: 'uppercase' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.62)' },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  title: { color: colors.white, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  notice: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  error: { color: colors.danger, fontSize: 10, lineHeight: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  action: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.sm },
  actionText: { color: colors.white, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  pressed: { opacity: .72 },
  disabled: { opacity: .48 },
});
