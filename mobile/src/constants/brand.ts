export const colors = {
  ink: '#050505',
  inkSoft: '#111111',
  panel: '#171717',
  panelRaised: '#202020',
  line: 'rgba(255, 255, 255, 0.18)',
  lineLight: '#DBE3E7',
  silver: '#DBE3E7',
  white: '#FFFFFF',
  muted: '#AAB1B5',
  mutedDark: '#555D61',
  accent: '#65CFF8',
  accentDark: '#155D78',
  danger: '#FF9F91',
  success: '#82D6A0',
} as const;

/**
 * Booking surfaces mirror the current PSI website: ice blue for interaction
 * and focus, deep petrol for supporting contrast, and silver for primary
 * actions. The wider mobile app uses the same palette through `colors`.
 */
export const bookingColors = {
  background: '#000000',
  raised: '#050505',
  surface: '#0D0D0D',
  surfaceAlt: '#111111',
  text: '#FFFFFF',
  textSecondary: '#B9C0C4',
  textMuted: '#9CA4A8',
  placeholder: '#8F999E',
  label: '#DBE3E7',
  border: 'rgba(255, 255, 255, 0.18)',
  borderStrong: 'rgba(255, 255, 255, 0.42)',
  inputBorder: '#DBE3E7',
  ghostBorder: '#495055',
  accent: '#65CFF8',
  accentBright: '#DBE3E7',
  accentDark: '#155D78',
  accentText: '#050505',
  selectedSecondary: '#0C3444',
  error: '#FF9F91',
  errorSurface: 'rgba(180, 35, 24, 0.12)',
  errorText: '#FFD7D1',
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
