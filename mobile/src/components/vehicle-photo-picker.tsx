import * as ImagePicker from 'expo-image-picker';
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
  onChange: (photo: LocalVehiclePhoto | null) => void;
  saving?: boolean;
  storageMode?: 'local_preview' | 'private_account';
  value: LocalVehiclePhoto | null;
  vehicleLabel?: string;
};

export function VehiclePhotoPicker({
  disabled = false,
  onChange,
  saving = false,
  storageMode = 'local_preview',
  value,
  vehicleLabel = 'your vehicle',
}: VehiclePhotoPickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
          saveToPhotos: false,
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
    onChange(null);
  };

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

      <View accessibilityLabel={storageMode === 'private_account' ? 'Private account photo storage.' : 'Local preview only. The selected photo is not uploaded to PSI or added to an account.'} style={styles.notice}>
        <Text maxFontSizeMultiplier={2} style={styles.noticeTitle}>{storageMode === 'private_account' ? 'Private account storage' : 'Local preview only'}</Text>
        <Text maxFontSizeMultiplier={2} style={styles.noticeCopy}>
          {storageMode === 'private_account'
            ? 'Choosing a photo saves it to your private PSI account. Only this authenticated customer account and authorised PSI staff can view it. Replacing or removing it never changes PSI workshop records.'
            : 'This preview keeps only a temporary local reference. It is not uploaded to PSI or saved to an account. It clears when the app preview reloads or closes; your device and system photo picker manage any local copies or cache.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
