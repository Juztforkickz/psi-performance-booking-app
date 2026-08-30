import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export const HOME_TILE_IDS = [
  'garage',
  'bookings',
  'book-ahead',
  'psi-events',
  'dyno',
  'reports',
  'plan-build',
  'trusted-partners',
  'alerts',
] as const;

export type HomeTileId = (typeof HOME_TILE_IDS)[number];

export const DEFAULT_HOME_SHORTCUTS: readonly HomeTileId[] = [
  'garage',
  'bookings',
  'book-ahead',
  'psi-events',
  'alerts',
];

const PREVIOUS_DEFAULT_HOME_SHORTCUTS: readonly HomeTileId[] = [
  'garage',
  'bookings',
  'book-ahead',
  'alerts',
];

const STORAGE_KEY = '@psi-performance/home-shortcuts/v1';

function isHomeTileId(value: unknown): value is HomeTileId {
  return typeof value === 'string' && HOME_TILE_IDS.includes(value as HomeTileId);
}

function normaliseShortcutIds(value: unknown): HomeTileId[] {
  if (!Array.isArray(value)) return [...DEFAULT_HOME_SHORTCUTS];
  const unique = value.filter(isHomeTileId).filter((id, index, items) => items.indexOf(id) === index);
  const selected = sameShortcutIds(unique, PREVIOUS_DEFAULT_HOME_SHORTCUTS)
    ? [...DEFAULT_HOME_SHORTCUTS]
    : unique.length > 0
      ? unique
      : [...DEFAULT_HOME_SHORTCUTS];
  return HOME_TILE_IDS.filter((id) => selected.includes(id));
}

function sameShortcutIds(left: readonly HomeTileId[], right: readonly HomeTileId[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function useHomeShortcutPreferences() {
  const [shortcutIds, setShortcutIds] = useState<HomeTileId[]>([...DEFAULT_HOME_SHORTCUTS]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored || !active) return;
        const normalised = normaliseShortcutIds(JSON.parse(stored));
        setShortcutIds(normalised);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalised));
      } catch {
        // A damaged preference should never block the Home screen.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveShortcutIds = useCallback((next: readonly HomeTileId[]) => {
    const normalised = normaliseShortcutIds(next);
    setShortcutIds(normalised);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalised));
  }, []);

  const toggleShortcut = useCallback((id: HomeTileId) => {
    setShortcutIds((current) => {
      const selected = current.includes(id);
      if (selected && current.length === 1) return current;
      const next = normaliseShortcutIds(selected ? current.filter((currentId) => currentId !== id) : [...current, id]);
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetShortcuts = useCallback(() => saveShortcutIds(DEFAULT_HOME_SHORTCUTS), [saveShortcutIds]);

  return { resetShortcuts, shortcutIds, toggleShortcut };
}
