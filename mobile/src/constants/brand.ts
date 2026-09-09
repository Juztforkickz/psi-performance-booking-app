import { DynamicColorIOS, Platform } from 'react-native';

/**
 * Legacy screens still consume these established PSI names directly. Keep the
 * names stable, but make their values theme-aware so one preference applies to
 * the complete app instead of only newer screens using ThemePreference.
 *
 * iOS resolves DynamicColorIOS after Appearance.setColorScheme is updated.
 * Web resolves the same pairs through CSS variables installed by the theme
 * provider. Android keeps the existing dark palette until a native Android
 * release needs equivalent dynamic platform colours.
 */
function adaptiveColor(name: string, bright: string, dark: string): string {
  if (Platform.OS === 'ios') return DynamicColorIOS({ light: bright, dark }) as unknown as string;
  if (Platform.OS === 'web') return `var(--psi-${name}, ${dark})`;
  return dark;
}

export const colors = {
  ink: adaptiveColor('ink', '#FFFFFF', '#050505'),
  inkSoft: adaptiveColor('ink-soft', '#E7EDF0', '#111111'),
  panel: adaptiveColor('panel', '#F4F7F8', '#171717'),
  panelRaised: adaptiveColor('panel-raised', '#DBE3E7', '#202020'),
  line: adaptiveColor('line', 'rgba(5, 5, 5, 0.2)', 'rgba(255, 255, 255, 0.18)'),
  lineLight: adaptiveColor('line-light', '#050505', '#DBE3E7'),
  silver: adaptiveColor('silver', '#050505', '#DBE3E7'),
  white: adaptiveColor('white', '#0A0A0A', '#FFFFFF'),
  muted: adaptiveColor('muted', '#495055', '#AAB1B5'),
  mutedDark: adaptiveColor('muted-dark', '#555D61', '#555D61'),
  onSilverMuted: adaptiveColor('on-silver-muted', '#DBE3E7', '#464646'),
  noticeSurface: adaptiveColor('notice-surface', '#E7EDF0', '#DBE3E7'),
  onNotice: adaptiveColor('on-notice', '#050505', '#050505'),
  onNoticeMuted: adaptiveColor('on-notice-muted', '#495055', '#464646'),
  accent: adaptiveColor('accent', '#155D78', '#65CFF8'),
  accentDark: adaptiveColor('accent-dark', '#65CFF8', '#155D78'),
  danger: adaptiveColor('danger', '#B42318', '#FF9F91'),
  success: adaptiveColor('success', '#198F55', '#82D6A0'),
} as const;

/**
 * Booking surfaces mirror the current PSI website: ice blue for interaction
 * and focus, deep petrol for supporting contrast, and silver for primary
 * actions. The wider mobile app uses the same palette through `colors`.
 */
export const bookingColors = {
  background: adaptiveColor('booking-background', '#EAF0F2', '#000000'),
  raised: adaptiveColor('booking-raised', '#FFFFFF', '#050505'),
  surface: adaptiveColor('booking-surface', '#FFFFFF', '#0D0D0D'),
  surfaceAlt: adaptiveColor('booking-surface-alt', '#E7EDF0', '#111111'),
  text: adaptiveColor('booking-text', '#111111', '#FFFFFF'),
  textSecondary: adaptiveColor('booking-text-secondary', '#495055', '#B9C0C4'),
  textMuted: adaptiveColor('booking-text-muted', '#555D61', '#9CA4A8'),
  placeholder: adaptiveColor('booking-placeholder', '#5D666B', '#8F999E'),
  label: adaptiveColor('booking-label', '#111111', '#DBE3E7'),
  border: adaptiveColor('booking-border', 'rgba(5, 5, 5, 0.2)', 'rgba(255, 255, 255, 0.18)'),
  borderStrong: adaptiveColor('booking-border-strong', 'rgba(5, 5, 5, 0.42)', 'rgba(255, 255, 255, 0.42)'),
  inputBorder: adaptiveColor('booking-input-border', '#41474A', '#DBE3E7'),
  ghostBorder: adaptiveColor('booking-ghost-border', '#6B7479', '#495055'),
  accent: adaptiveColor('booking-accent', '#155D78', '#65CFF8'),
  accentBright: adaptiveColor('booking-accent-bright', '#050505', '#DBE3E7'),
  accentDark: adaptiveColor('booking-accent-dark', '#155D78', '#155D78'),
  accentText: adaptiveColor('booking-accent-text', '#FFFFFF', '#050505'),
  selectedSecondary: adaptiveColor('booking-selected-secondary', '#D8F3FD', '#0C3444'),
  error: adaptiveColor('booking-error', '#B42318', '#FF9F91'),
  errorSurface: adaptiveColor('booking-error-surface', 'rgba(180, 35, 24, 0.08)', 'rgba(180, 35, 24, 0.12)'),
  errorText: adaptiveColor('booking-error-text', '#7A1D14', '#FFD7D1'),
} as const;

/** One consistent frame for every rectangular mobile surface and control. */
export const mobileFrame = {
  borderWidth: 3,
  borderColor: colors.silver,
} as const;

export const contact = {
  phoneDisplay: '0433 431 781',
  phoneUrl: 'tel:+61433431781',
  email: 'info@psiperformance.com.au',
  emailUrl: 'mailto:info@psiperformance.com.au',
  address: '21 Exchange Drive, Pakenham VIC 3810',
  mapsUrl: 'https://maps.google.com/?q=21+Exchange+Drive+Pakenham+VIC+3810',
  website: 'https://www.psiperformance.com.au',
  privacy: 'https://www.psiperformance.com.au/policies/privacy-policy',
  facebook: 'https://www.facebook.com/psiperformancegarage/',
  instagram: 'https://www.instagram.com/psiperformancegarage/',
  youtube: 'https://www.youtube.com/channel/UCkJaKfpjPlHOuwOMH0xBIJQ',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
