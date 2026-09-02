import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, mobileFrame, spacing } from '@/constants/brand';
import { type LocalVehiclePhoto } from '@/lib/local-vehicle-photo';

export type { LocalVehiclePhoto } from '@/lib/local-vehicle-photo';

export type VehiclePhotoPickerProps = {
  disabled?: boolean;
  display?: 'full' | 'quick';
  onChange: (photo: LocalVehiclePhoto | null) => void;
  saving?: boolean;
  storageMode?: 'local_preview' | 'private_account';
  value: LocalVehiclePhoto | null;
  vehicleLabel?: string;
};

export function VehiclePhotoPicker({
  disabled = false,
  display = 'full',
  onChange,
  saving = false,
  storageMode = 'local_preview',
  value,
  vehicleLabel = 'your vehicle',
}: VehiclePhotoPickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  const pickPhotoFromSource = async (source: 'camera' | 'library') => {
    if (busy || saving || disabled) return;

    setBusy(true);
    setError('');

    try {
      const requestPermission = source === 'camera'
        ? ImagePicker.requestCameraPermissionsAsync
        : ImagePicker.requestMediaLibraryPermissionsAsync;
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        setError(source === 'camera'
          ? 'Camera permission is needed to take photos for your vehicle record.'
          : 'Photo permission is needed to choose an existing picture.');
        return;
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          mediaTypes: ['images'],
          quality: 0.9,
        })
        : await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          allowsMultipleSelection: false,
          base64: false,
          exif: false,
          mediaTypes: ['images'],
          quality: 0.9,
          selectionLimit: 1,
        });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) {
        setError('That photo could not be opened. Choose a different image and try again.');
        return;
      }

      const nextPhoto = {
        fileSize: asset.fileSize ?? null,
        height: asset.height,
        mimeType: asset.mimeType ?? null,
        uri: asset.uri,
        width: asset.width,
      };
      onChange(nextPhoto);
      setQuickMenuOpen(false);
    } catch {
      setError(source === 'camera' ? 'The camera could not be opened. Try again or choose from your library.' : 'We could not open your photo library. Try again or choose a different image.');
    } finally {
      setBusy(false);
    }
  };

  const choosePhoto = async () => {
    await pickPhotoFromSource('library');
  };

  const takePhoto = async () => {
    await pickPhotoFromSource('camera');
  };

  const removePhoto = () => {
    setError('');
    setQuickMenuOpen(false);
    onChange(null);
  };

  if (display === 'quick') {
    const unavailable = busy || saving || disabled;
    return (
      <View style={styles.quickContainer}>
        <Pressable
          accessibilityHint="Opens camera and photo-library choices"
          accessibilityLabel={value ? `Change photo of ${vehicleLabel}` : `Add photo of ${vehicleLabel}`}
          accessibilityRole="button"
          accessibilityState={{ busy: busy || saving, disabled: unavailable, expanded: quickMenuOpen }}
          disabled={unavailable}
          onPress={() => { setError(''); setQuickMenuOpen((current) => !current); }}
          style={({ pressed }) => [styles.quickTrigger, pressed && styles.pressed, unavailable && styles.actionDisabled]}
        >
          {busy || saving ? <ActivityIndicator color={colors.ink} size="small" /> : <Ionicons color={colors.ink} name="camera-outline" size={17} />}
          <Text adjustsFontSizeToFit maxFontSizeMultiplier={1.2} minimumFontScale={0.72} numberOfLines={1} style={styles.quickTriggerText}>{value ? 'Change photo' : 'Add photo'}</Text>
        </Pressable>
        {quickMenuOpen ? (
          <View style={styles.quickMenu}>
            <Pressable
              accessibilityLabel="Take vehicle photo with camera"
              accessibilityRole="button"
              disabled={unavailable}
              onPress={() => void takePhoto()}
              style={({ pressed }) => [styles.quickChoice, pressed && styles.pressed]}
            >
              <Ionicons color={colors.white} name="camera" size={16} />
              <Text style={styles.quickChoiceText}>Take photo</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Choose vehicle photo from photo library"
              accessibilityRole="button"
              disabled={unavailable}
              onPress={() => void choosePhoto()}
              style={({ pressed }) => [styles.quickChoice, pressed && styles.pressed]}
            >
              <Ionicons color={colors.white} name="images" size={16} />
              <Text style={styles.quickChoiceText}>Photo library</Text>
            </Pressable>
            {value ? (
              <Pressable
                accessibilityLabel={`Remove photo of ${vehicleLabel}`}
                accessibilityRole="button"
                disabled={unavailable}
                onPress={removePhoto}
                style={({ pressed }) => [styles.quickChoice, pressed && styles.pressed]}
              >
                <Ionicons color="#FFB4A9" name="trash-outline" size={16} />
                <Text style={[styles.quickChoiceText, styles.quickRemoveText]}>Remove photo</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.quickError}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text maxFontSizeMultiplier={2} style={styles.title}>Vehicle photo</Text>

      <View style={styles.preview}>
        {value ? (
          <Image
            accessibilityLabel={`Selected photo of ${vehicleLabel}`}
            resizeMode="contain"
            source={{ uri: value.uri }}
            style={styles.photo}
          />
        ) : (
          <View accessibilityLabel={`No photo selected for ${vehicleLabel}`} style={styles.empty}>
            <Text maxFontSizeMultiplier={1.5} style={styles.emptyMark}>+</Text>
            <Text maxFontSizeMultiplier={2} style={styles.emptyTitle}>Add your own car</Text>
            <Text maxFontSizeMultiplier={2} style={styles.emptyCopy}>Choose one image from this device.</Text>
          </View>
        )}
      </View>

      {error ? (
        <Text accessibilityRole="alert" maxFontSizeMultiplier={2} style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel="Take a photo from camera"
          accessibilityRole="button"
          accessibilityState={{ busy: busy || saving, disabled: busy || saving || disabled }}
          disabled={busy || saving || disabled}
          onPress={() => void takePhoto()}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed && styles.pressed,
            (busy || saving || disabled) && styles.actionDisabled,
          ]}
        >
          {busy || saving ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text maxFontSizeMultiplier={1.6} style={styles.primaryActionText}>Take photo</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityLabel={value ? `Replace photo of ${vehicleLabel}` : `Choose a photo of ${vehicleLabel}`}
          accessibilityRole="button"
          accessibilityState={{ busy: busy || saving, disabled: busy || saving || disabled }}
          disabled={busy || saving || disabled}
          onPress={() => void choosePhoto()}
          style={({ pressed }) => [
            styles.secondaryAction,
            pressed && styles.pressed,
            (busy || saving || disabled) && styles.actionDisabled,
          ]}
        >
          {busy || saving ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text maxFontSizeMultiplier={1.6} style={styles.secondaryActionText}>Choose photo</Text>
          )}
        </Pressable>

        {value ? (
          <Pressable
            accessibilityLabel={`Remove photo of ${vehicleLabel}`}
            accessibilityRole="button"
            disabled={disabled || saving}
            onPress={removePhoto}
            style={({ pressed }) => [
              styles.tertiaryAction,
              pressed && styles.pressed,
              (disabled || saving) && styles.actionDisabled,
            ]}
          >
            <Text maxFontSizeMultiplier={1.6} style={styles.tertiaryActionText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>

      <View accessibilityLabel={storageMode === 'private_account' ? 'Private account photo.' : 'Demo photo. The selected photo is not uploaded.'} style={styles.notice}>
        <Text maxFontSizeMultiplier={2} style={styles.noticeTitle}>{storageMode === 'private_account' ? 'Private photo' : 'Demo photo'}</Text>
        <Text maxFontSizeMultiplier={2} style={styles.noticeCopy}>
          {storageMode === 'private_account'
            ? 'Saved to your PSI account. Only you and authorised PSI staff can view it.'
            : 'This photo is not uploaded and clears when the demo closes.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickContainer: {
    zIndex: 2,
    width: 148,
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 5,
  },
  quickTrigger: {
    width: '100%',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 3,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
  },
  quickTriggerText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: .4,
    textTransform: 'uppercase',
  },
  quickMenu: {
    ...mobileFrame,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(9,9,9,.96)',
  },
  quickChoice: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.sm,
  },
  quickChoiceText: {
    flexShrink: 1,
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: .4,
    textTransform: 'uppercase',
  },
  quickRemoveText: {
    color: '#FFB4A9',
  },
  quickError: {
    width: 190,
    color: '#FFB4A9',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 14,
    textAlign: 'right',
    textShadowColor: colors.ink,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  container: {
    gap: spacing.md,
  },
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  preview: {
    ...mobileFrame,
    width: '100%',
    aspectRatio: 16 / 10,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.inkSoft,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
  },
  emptyMark: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 38,
  },
  emptyTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  emptyCopy: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primaryAction: {
    ...mobileFrame,
    minWidth: 156,
    minHeight: 50,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryActionText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  secondaryAction: {
    ...mobileFrame,
    minWidth: 112,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  tertiaryAction: {
    ...mobileFrame,
    minWidth: 112,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tertiaryActionText: {
    color: colors.silver,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  notice: {
    gap: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.panel,
    padding: spacing.md,
  },
  noticeTitle: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noticeCopy: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.76,
  },
  actionDisabled: {
    opacity: 0.48,
  },
});
