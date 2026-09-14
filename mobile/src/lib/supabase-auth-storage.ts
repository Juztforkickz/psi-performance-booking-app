import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

const CHUNK_SIZE = 1800;
const memoryStorage = new Map<string, string>();
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

function chunkKey(key: string, index: number) {
  return `${key}.part.${index}`;
}

function metadataKey(key: string) {
  return `${key}.parts`;
}

async function getNativePartCount(key: string) {
  const rawCount = await SecureStore.getItemAsync(metadataKey(key), secureStoreOptions);
  const count = Number.parseInt(rawCount ?? '', 10);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

const nativeSecureStorage: AuthStorage = {
  async getItem(key) {
    const partCount = await getNativePartCount(key);
    if (!partCount) return null;

    const parts = await Promise.all(
      Array.from({ length: partCount }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index), secureStoreOptions),
      ),
    );

    return parts.some((part) => part === null) ? null : parts.join('');
  },
  async removeItem(key) {
    const partCount = await getNativePartCount(key);
    await Promise.all([
      ...Array.from({ length: partCount }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index), secureStoreOptions),
      ),
      SecureStore.deleteItemAsync(metadataKey(key), secureStoreOptions),
    ]);
  },
  async setItem(key, value) {
    const previousPartCount = await getNativePartCount(key);
    const parts = Array.from(
      { length: Math.ceil(value.length / CHUNK_SIZE) },
      (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );

    await Promise.all(
      parts.map((part, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), part, secureStoreOptions),
      ),
    );
    await SecureStore.setItemAsync(metadataKey(key), String(parts.length), secureStoreOptions);

    if (previousPartCount > parts.length) {
      await Promise.all(
        Array.from({ length: previousPartCount - parts.length }, (_, offset) =>
          SecureStore.deleteItemAsync(chunkKey(key, parts.length + offset), secureStoreOptions),
        ),
      );
    }
  },
};

const webSessionStorage: AuthStorage = {
  async getItem(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  async removeItem(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      memoryStorage.delete(key);
    }
  },
  async setItem(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  },
};

// Native sessions use OS-protected storage. Authenticated web sessions use the
// current tab only: refreshes and direct navigation remain signed in, while
// closing the tab clears the session instead of leaving a long-lived token.
export const supabaseAuthStorage = Platform.OS === 'web' ? webSessionStorage : nativeSecureStorage;
