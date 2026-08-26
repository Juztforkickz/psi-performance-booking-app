import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

export type ThemePreference = 'automatic' | 'bright' | 'dark';
export type ResolvedTheme = 'bright' | 'dark';

export type AppThemePalette = {
  accent: string;
  accentAlt: string;
  border: string;
  borderStrong: string;
  card: string;
  frame: string;
  input: string;
  ink: string;
  inkSoft: string;
  line: string;
  lineAccent: string;
  muted: string;
  mutedDark: string;
  primaryText: string;
  screen: string;
  surface: string;
  surfaceRaised: string;
  success: string;
  text: string;
  textInverse: string;
  textMuted: string;
  warning: string;
  white: string;
};

const THEME_PREFERENCE_STORAGE_KEY = '@psi-performance/theme-preference/v1';

const DARK_THEME: AppThemePalette = {
  accent: '#65CFF8',
  accentAlt: '#2E7D9B',
  border: 'rgba(255, 255, 255, 0.18)',
  borderStrong: 'rgba(255, 255, 255, 0.42)',
  card: '#171717',
  frame: '#DBE3E7',
  input: '#DBE3E7',
  ink: '#050505',
  inkSoft: '#111111',
  line: 'rgba(255, 255, 255, 0.18)',
  lineAccent: '#65CFF8',
  muted: '#AAB1B5',
  mutedDark: '#555D61',
  primaryText: '#FFFFFF',
  screen: '#050505',
  surface: '#0D0D0D',
  surfaceRaised: '#101010',
  success: '#82D6A0',
  text: '#FFFFFF',
  textInverse: '#050505',
  textMuted: '#8F999E',
  warning: '#FF9F91',
  white: '#FFFFFF',
};

const BRIGHT_THEME: AppThemePalette = {
  accent: '#155D78',
  accentAlt: '#2E7D9B',
  border: 'rgba(5, 5, 5, 0.2)',
  borderStrong: 'rgba(5, 5, 5, 0.42)',
  card: '#F4F7F8',
  frame: '#050505',
  input: '#41474A',
  ink: '#FFFFFF',
  inkSoft: '#E7EDF0',
  line: 'rgba(5, 5, 5, 0.2)',
  lineAccent: '#155D78',
  muted: '#495055',
  mutedDark: '#555D61',
  primaryText: '#050505',
  screen: '#EAF0F2',
  surface: '#FFFFFF',
  surfaceRaised: '#DBE3E7',
  success: '#198F55',
  text: '#111111',
  textInverse: '#F4F7F8',
  textMuted: '#555D61',
  warning: '#B42318',
  white: '#0A0A0A',
};

const SYSTEM_TO_THEME_MAP: Record<NonNullable<ColorSchemeName>, ResolvedTheme> = {
  dark: 'dark',
  light: 'bright',
  unspecified: 'dark',
};

type ThemePreferenceContextValue = {
  activeTheme: ResolvedTheme;
  isAutomatic: boolean;
  setThemePreference: (value: ThemePreference) => void;
  theme: AppThemePalette;
  themePreference: ThemePreference;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function getResolvedTheme(preference: ThemePreference, colorScheme: ResolvedTheme | 'light' | 'dark'): ResolvedTheme {
  if (preference !== 'automatic') return preference;
  return colorScheme === 'light' ? 'bright' : 'dark';
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'automatic' || value === 'bright' || value === 'dark';
}

function themeForMode(mode: ResolvedTheme): AppThemePalette {
  return mode === 'bright' ? BRIGHT_THEME : DARK_THEME;
}

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const [themePreference, setThemePreference] = useState<ThemePreference>('automatic');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
    const initialSystem = Appearance.getColorScheme() ?? 'dark';
    return SYSTEM_TO_THEME_MAP[initialSystem];
  });

  const activeTheme = getResolvedTheme(themePreference, systemTheme);
  const theme = useMemo(() => themeForMode(activeTheme), [activeTheme]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const nextSystem = colorScheme ?? 'dark';
      setSystemTheme(SYSTEM_TO_THEME_MAP[nextSystem]);
    });

    void (async () => {
      const rawPreference = await AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
      if (!rawPreference) return;
      if (isThemePreference(rawPreference)) setThemePreference(rawPreference);
    })();

    return () => subscription?.remove();
  }, []);

  const updateThemePreference = useCallback((next: ThemePreference) => {
    setThemePreference(next);
    void AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      activeTheme,
      isAutomatic: themePreference === 'automatic',
      setThemePreference: updateThemePreference,
      theme,
      themePreference,
    }),
    [activeTheme, themePreference, theme, updateThemePreference],
  );

  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext);
  if (!value) throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  return value;
}
