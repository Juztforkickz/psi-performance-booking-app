import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';

import { colors, spacing } from '@/constants/brand';
import { useThemePreference } from '@/lib/theme-preference';

export type DashboardTileProps = {
  accessibilityHint?: string;
  cornerBadge?: string;
  imageResizeMode?: 'center' | 'contain' | 'cover' | 'repeat' | 'stretch';
  imageStyle?: StyleProp<ImageStyle>;
  disabled?: boolean;
  image: ImageSourcePropType;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Home collections share one luminous frame, including the live Rewards tile. */
export const COLLECTION_TILE_FRAME: ViewStyle = {
  width: '100%',
  aspectRatio: 1,
  borderWidth: 2,
  borderColor: '#96EAFF',
  borderRadius: 21,
  backgroundColor: '#090F16',
  boxShadow: '0 0 3px #DCFAFF, 0 0 11px #39CAFFD9, 0 0 23px #16AAFF80',
};

/**
 * A static, illustrated PSI dashboard destination. The parent controls the
 * responsive grid width; the square frame keeps every illustration consistent.
 */
export function DashboardTile({
  accessibilityHint,
  cornerBadge,
  imageResizeMode = 'contain',
  imageStyle,
  disabled = false,
  image,
  label,
  onPress,
  style,
}: DashboardTileProps) {
  const { activeTheme } = useThemePreference();
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View pointerEvents="none" style={styles.surface}>
        <View style={[styles.imageArea, activeTheme === 'dark' && styles.refinedImage]}>
          <Image
            accessible={false}
            resizeMode={imageResizeMode}
            source={image}
            style={[styles.image, imageStyle]}
          />
        </View>
        <View style={styles.shade} />
        {cornerBadge ? <View style={styles.cornerBadge}><Text style={styles.cornerBadgeText}>{cornerBadge}</Text></View> : null}
        <View style={styles.labelBand}>
          <Text
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.2}
            minimumFontScale={0.82}
            numberOfLines={2}
            style={styles.label}
          >
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    ...COLLECTION_TILE_FRAME,
  },
  surface: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 19,
    backgroundColor: '#050505',
  },
  imageArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 50,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#050505',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#050505',
    transform: [{ scale: 1.55 }],
  },
  refinedImage: { filter: [{ brightness: 1.18 }] },
  cornerBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 17,
    backgroundColor: 'rgba(5,5,5,.92)',
  },
  cornerBadgeText: { color: colors.accent, fontSize: 18, fontWeight: '900', lineHeight: 21 },
  shade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  labelBand: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
    height: 50,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#88D7EE',
    backgroundColor: 'rgba(15, 34, 47, 0.96)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.55,
    lineHeight: 15,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.48,
  },
});
