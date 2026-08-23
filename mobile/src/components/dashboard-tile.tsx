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

import { colors, mobileFrame, spacing } from '@/constants/brand';

export type DashboardTileProps = {
  accessibilityHint?: string;
  imageResizeMode?: 'center' | 'contain' | 'cover' | 'repeat' | 'stretch';
  imageStyle?: StyleProp<ImageStyle>;
  disabled?: boolean;
  image: ImageSourcePropType;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * A static, illustrated PSI dashboard destination. The parent controls the
 * responsive grid width; the 4:5 frame keeps every illustration consistent.
 */
export function DashboardTile({
  accessibilityHint,
  imageResizeMode = 'cover',
  imageStyle,
  disabled = false,
  image,
  label,
  onPress,
  style,
}: DashboardTileProps) {
  const isGarageTile = label === 'My Garage';
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
      <Image
        accessible={false}
        resizeMode={imageResizeMode}
        source={image}
        style={[
          styles.image,
          isGarageTile && styles.garageImage,
          imageStyle,
        ]}
      />
      <View style={styles.shade} />
      <View style={styles.labelBand}>
        <Text maxFontSizeMultiplier={1.6} numberOfLines={2} style={styles.label}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    ...mobileFrame,
    width: '100%',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.panel,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  garageImage: {
    transform: [{ translateY: -14 }, { scale: 1.04 }],
  },
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
    minHeight: 58,
    justifyContent: 'center',
    borderTopWidth: mobileFrame.borderWidth,
    borderTopColor: mobileFrame.borderColor,
    backgroundColor: 'rgba(5, 5, 5, 0.94)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.7,
    lineHeight: 19,
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
