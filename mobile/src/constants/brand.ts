export const colors = {
  ink: '#050505',
  inkSoft: '#111111',
  panel: '#171717',
  panelRaised: '#202020',
  line: 'rgba(255, 255, 255, 0.18)',
  lineLight: '#D8D3C9',
  cream: '#F3F0E8',
  white: '#FFFFFF',
  muted: '#A7A49D',
  mutedDark: '#68655F',
  gold: '#D9B35B',
  goldDark: '#8B641B',
  danger: '#FF9F91',
  success: '#82D6A0',
} as const;

/**
 * The public web booking surfaces deliberately replace the PSI gold signal
 * with a restrained silver/white system. Keep this scoped to booking UI so the
 * broader workshop brand, parts and editorial surfaces retain their gold.
 */
export const bookingColors = {
  background: '#000000',
  raised: '#050505',
  surface: '#0D0D0D',
  surfaceAlt: '#111111',
  text: '#FFFFFF',
  textSecondary: '#AAA9A5',
  textMuted: '#85847F',
  placeholder: '#666560',
  label: '#D1D0CC',
  border: 'rgba(255, 255, 255, 0.18)',
  borderStrong: 'rgba(255, 255, 255, 0.42)',
  inputBorder: '#E0E0E0',
  ghostBorder: '#4C4B47',
  accent: '#F2F2F2',
  accentBright: '#FFFFFF',
  accentDark: '#A8A8A8',
  accentText: '#050505',
  selectedSecondary: '#464646',
  error: '#FF9F91',
  errorSurface: 'rgba(180, 35, 24, 0.12)',
  errorText: '#FFD7D1',
} as const;

/** One consistent frame for every rectangular mobile surface and control. */
export const mobileFrame = {
  borderWidth: 3,
  borderColor: colors.white,
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
