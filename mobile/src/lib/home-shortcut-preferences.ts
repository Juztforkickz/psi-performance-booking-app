import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export const HOME_TILE_IDS = [
  'garage',
  'bookings',
  'book-ahead',
  'psi-events',
  'dyno',
  'reports',
  'plan-build',
  'trusted-partners',
  'customer-cars-for-sale',
  'performance-plus',
  'alerts',
  'rewards',
] as const;

export type HomeTileId = (typeof HOME_TILE_IDS)[number];

export const HOME_SHORTCUT_TILE_IDS: readonly HomeTileId[] = [
  'garage',
  'bookings',
  'book-ahead',
  'psi-events',
  'performance-plus',
  'alerts',
];

export const HOME_WORKSHOP_TILE_IDS: readonly HomeTileId[] = ['dyno', 'reports', 'plan-build', 'trusted-partners', 'customer-cars-for-sale', 'rewards'];
export const DEFAULT_HOME_SHORTCUTS: readonly HomeTileId[] = [...HOME_TILE_IDS];

const PREVIOUS_DEFAULT_HOME_SHORTCUTS: readonly (readonly HomeTileId[])[] = [
  ['garage', 'bookings', 'book-ahead', 'alerts'],
  ['garage', 'bookings', 'book-ahead', 'psi-events', 'alerts'],
  ['garage', 'bookings', 'book-ahead', 'psi-events', 'performance-plus', 'alerts'],
];

const LEGACY_STORAGE_KEY = '@psi-performance/home-shortcuts/v1';
const STORAGE_KEY = '@psi-performance/home-shortcuts/v2';

function isHomeTileId(value: unknown): value is HomeTileId {
  return typeof value === 'string' && HOME_TILE_IDS.includes(value as HomeTileId);
}

export function normaliseShortcutIds(value: unknown): HomeTileId[] {
  if (!Array.isArray(value)) return [...DEFAULT_HOME_SHORTCUTS];
  const unique = value.filter(isHomeTileId).filter((id, index, items) => items.indexOf(id) === index);
  // Empty is an intentional selection. Migration must never run while toggling.
  return HOME_TILE_IDS.filter((id) => unique.includes(id));
}

export function migrateLegacyShortcuts(value: unknown): HomeTileId[] {
  return Array.isArray(value) && PREVIOUS_DEFAULT_HOME_SHORTCUTS.some(previous => sameShortcutIds(value, previous))
    ? [...DEFAULT_HOME_SHORTCUTS] : normaliseShortcutIds(value);
}

export function visibleHomeTileGroups(ids: readonly HomeTileId[]) {
  return {
    shortcuts: HOME_SHORTCUT_TILE_IDS.filter(id => ids.includes(id)),
    workshop: HOME_WORKSHOP_TILE_IDS.filter(id => ids.includes(id)),
  };
}

function sameShortcutIds(left: readonly HomeTileId[], right: readonly HomeTileId[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function useHomeShortcutPreferences() {
  const [shortcutIds, setShortcutIds] = useState<HomeTileId[]>([...DEFAULT_HOME_SHORTCUTS]);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const current = useRef<HomeTileId[]>([...DEFAULT_HOME_SHORTCUTS]);
  const revision = useRef(0);
  const mounted = useRef(true);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  const persist = useCallback((next: readonly HomeTileId[], version: number) => {
    writes.current = writes.current.catch(() => undefined).then(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        if (mounted.current && revision.current === version) setSaveError(false);
      } catch {
        if (mounted.current && revision.current === version) setSaveError(true);
      }
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const legacy = stored === null ? await AsyncStorage.getItem(LEGACY_STORAGE_KEY) : null;
        if (!active || revision.current !== 0) return;
        const normalised = stored !== null ? normaliseShortcutIds(JSON.parse(stored))
          : legacy !== null ? migrateLegacyShortcuts(JSON.parse(legacy)) : [...DEFAULT_HOME_SHORTCUTS];
        current.current = normalised;
        setShortcutIds(normalised);
        if (stored === null) persist(normalised, 0);
      } catch {
        // A damaged preference should never block the Home screen.
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [persist]);

  const saveShortcutIds = useCallback((next: readonly HomeTileId[]) => {
    const normalised = normaliseShortcutIds(next);
    current.current = normalised;
    revision.current += 1;
    setShortcutIds(normalised);
    persist(normalised, revision.current);
  }, [persist]);

  const toggleShortcut = useCallback((id: HomeTileId) => {
    if (!isHomeTileId(id)) return;
    saveShortcutIds(current.current.includes(id) ? current.current.filter(currentId => currentId !== id) : [...current.current, id]);
  }, [saveShortcutIds]);

  const resetShortcuts = useCallback(() => saveShortcutIds(DEFAULT_HOME_SHORTCUTS), [saveShortcutIds]);

  const retrySave = useCallback(() => persist(current.current, revision.current), [persist]);
  return { ready, resetShortcuts, retrySave, saveError, shortcutIds, toggleShortcut };
}
