import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'react-native';

import type { LocalVehiclePhoto } from '@/lib/local-vehicle-photo';

export async function choosePhotoFile(): Promise<LocalVehiclePhoto | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*', multiple: false, copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri || (asset.mimeType && !asset.mimeType.startsWith('image/'))) {
    throw new Error('Choose an image file.');
  }
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(asset.uri, (width, height) => resolve({ width, height }), reject);
  });
  if (!(dimensions.width > 0 && dimensions.height > 0)) throw new Error('Image could not be opened.');
  return { ...dimensions, uri: asset.uri, mimeType: asset.mimeType ?? null, fileSize: asset.size ?? null };
}
