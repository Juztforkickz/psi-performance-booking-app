import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

export async function readUploadBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS !== 'web' && /^(file|content):/.test(uri)) return new File(uri).arrayBuffer();
  const response = await expoFetch(uri);
  if (!response.ok) throw new Error('The selected file could not be read. Please select it again.');
  return response.arrayBuffer();
}
