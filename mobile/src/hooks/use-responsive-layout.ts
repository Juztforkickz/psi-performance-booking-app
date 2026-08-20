import { useWindowDimensions } from 'react-native';

/**
 * One responsive contract for every native screen. Layout thresholds include the
 * user's text scale so larger accessibility text gets the same room as a smaller
 * physical display instead of being forced into desktop-style columns.
 */
export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const landscape = width > height;
  const tablet = Math.min(width, height) >= 600;
  const largeText = fontScale > 1.3;
  const effectiveWidth = width / Math.max(fontScale, 1);
  const compact = width < 380 || effectiveWidth < 360;
  const short = height < 600;
  const shortLandscape = landscape && height < 520;
  const horizontalPadding = compact ? 16 : tablet ? 32 : 24;

  return {
    compact,
    fontScale,
    height,
    horizontalPadding,
    landscape,
    largeText,
    short,
    shortLandscape,
    tablet,
    useFieldColumns: width >= 720 && effectiveWidth >= 600,
    useHomeColumns: width >= 960 && height >= 600 && fontScale <= 1.25,
    width,
  };
}
