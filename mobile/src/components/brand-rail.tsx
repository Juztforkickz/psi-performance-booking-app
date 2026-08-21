import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, mobileFrame, spacing } from '@/constants/brand';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

type Brand = {
  name: string;
  source: ImageSourcePropType;
  /**
   * The supplied artwork all uses a 300 x 300 transparent canvas, while the
   * visible marks range from tall crests to very wide wordmarks. Render the
   * canvas at an optical size chosen for the artwork instead of forcing every
   * logo into the same short rectangle.
   */
  artworkSize: number;
};

const BRANDS: readonly Brand[] = [
  { name: 'Audi', source: require('../../assets/images/brands/audi.png'), artworkSize: 94 },
  { name: 'Holden', source: require('../../assets/images/brands/holden.png'), artworkSize: 60 },
  { name: 'Ford', source: require('../../assets/images/brands/ford.png'), artworkSize: 124 },
  { name: 'Mercedes-Benz', source: require('../../assets/images/brands/mercedes-benz.png'), artworkSize: 94 },
  { name: 'Porsche', source: require('../../assets/images/brands/porsche.png'), artworkSize: 74 },
  { name: 'Lamborghini', source: require('../../assets/images/brands/lamborghini.png'), artworkSize: 62 },
  { name: 'Škoda', source: require('../../assets/images/brands/skoda.png'), artworkSize: 60 },
  { name: 'Volkswagen', source: require('../../assets/images/brands/volkswagen.png'), artworkSize: 60 },
  { name: 'BMW', source: require('../../assets/images/brands/bmw.png'), artworkSize: 60 },
  { name: 'Haltech', source: require('../../assets/images/brands/haltech.png'), artworkSize: 128 },
  { name: 'FuelTech', source: require('../../assets/images/brands/fueltech.png'), artworkSize: 128 },
  { name: 'HP Tuners', source: require('../../assets/images/brands/hp-tuners.png'), artworkSize: 126 },
] as const;

const RAIL_SPEED_PX_PER_SECOND = 26;
type RailSize = 'compact' | 'regular' | 'tablet';

/**
 * A restrained marque rail for the bottom of the home screen. Motion stops for
 * both Reduce Motion and screen-reader users, leaving the complete list under
 * their direct control in a horizontal ScrollView.
 */
export function BrandRail() {
  const { compact, horizontalPadding, tablet } = useResponsiveLayout();
  const [groupWidth, setGroupWidth] = useState(0);
  const [motionPreferenceReady, setMotionPreferenceReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [translateX] = useState(() => new Animated.Value(0));
  const showStaticRail = !motionPreferenceReady || reduceMotion || screenReaderEnabled;
  const railSize: RailSize = tablet ? 'tablet' : compact ? 'compact' : 'regular';

  useEffect(() => {
    let active = true;

    void Promise.all([
      AccessibilityInfo.isReduceMotionEnabled(),
      // React Native Web conservatively reports a screen reader as always on;
      // the web surface instead relies on Reduce Motion plus the pause control.
      Platform.OS === 'web' ? Promise.resolve(false) : AccessibilityInfo.isScreenReaderEnabled(),
    ])
      .then(([reduceMotionEnabled, readerEnabled]) => {
        if (!active) return;
        setReduceMotion(reduceMotionEnabled);
        setScreenReaderEnabled(readerEnabled);
        setMotionPreferenceReady(true);
      })
      .catch(() => {
        if (!active) return;
        // If the OS preference cannot be read, fail safely to the non-moving rail.
        setReduceMotion(true);
        setMotionPreferenceReady(true);
      });

    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    const screenReaderSubscription = Platform.OS === 'web'
      ? undefined
      : AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderEnabled);

    return () => {
      active = false;
      reduceMotionSubscription.remove();
      screenReaderSubscription?.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let runningAnimation: Animated.CompositeAnimation | undefined;

    if (showStaticRail || groupWidth <= 0) {
      translateX.stopAnimation();
      translateX.setValue(0);
      return;
    }

    if (isPaused) {
      translateX.stopAnimation();
      return;
    }

    const timingConfig = {
      easing: Easing.linear,
      isInteraction: false,
      useNativeDriver: Platform.OS !== 'web',
    } as const;

    const startFullLoop = () => {
      if (cancelled) return;
      translateX.setValue(0);
      runningAnimation = Animated.loop(
        Animated.timing(translateX, {
          ...timingConfig,
          toValue: -groupWidth,
          duration: Math.round((groupWidth / RAIL_SPEED_PX_PER_SECOND) * 1000),
        }),
      );
      runningAnimation.start();
    };

    // Native-driver values are read safely through stopAnimation. Resuming then
    // completes the remaining distance before entering the full seamless loop.
    translateX.stopAnimation((currentValue) => {
      if (cancelled) return;
      const remainder = currentValue % groupWidth;
      const normalizedOffset = remainder > 0 ? remainder - groupWidth : remainder;
      const remainingDistance = Math.max(0, groupWidth + normalizedOffset);

      if (remainingDistance < 1) {
        startFullLoop();
        return;
      }

      translateX.setValue(normalizedOffset);
      runningAnimation = Animated.timing(translateX, {
        ...timingConfig,
        toValue: -groupWidth,
        duration: Math.max(1, Math.round((remainingDistance / RAIL_SPEED_PX_PER_SECOND) * 1000)),
      });
      runningAnimation.start(({ finished }) => {
        if (finished) startFullLoop();
      });
    });

    return () => {
      cancelled = true;
      runningAnimation?.stop();
    };
  }, [groupWidth, isPaused, showStaticRail, translateX]);

  return (
    <View style={[styles.section, { marginHorizontal: -horizontalPadding }]}>
      <View style={[styles.heading, { paddingHorizontal: horizontalPadding }]}>
        <View style={styles.headingTop}>
          <View style={styles.headingCopy}>
            <Text style={styles.kicker}>Workshop capability</Text>
            <Text maxFontSizeMultiplier={2} style={styles.title}>Brands &amp; tuning platforms</Text>
          </View>
          {!showStaticRail ? (
            <Pressable
              accessibilityHint={isPaused ? 'Restarts the scrolling brand logos' : 'Stops the scrolling brand logos'}
              accessibilityLabel={isPaused ? 'Resume brand logo animation' : 'Pause brand logo animation'}
              accessibilityRole="button"
              accessibilityValue={{ text: isPaused ? 'Paused' : 'Playing' }}
              onPress={() => setIsPaused((paused) => !paused)}
              style={({ pressed }) => [styles.motionButton, pressed && styles.motionButtonPressed]}
            >
              <Text maxFontSizeMultiplier={1.5} style={styles.motionButtonText}>
                {isPaused ? 'Resume motion' : 'Pause motion'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.description}>
          Vehicle brands and tuning platforms PSI works with. Trademarks belong to their owners; no endorsement or
          affiliation is implied.
        </Text>
      </View>

      {showStaticRail ? (
        <ScrollView
          accessibilityHint="Swipe horizontally to explore every brand and tuning platform"
          contentContainerStyle={styles.staticTrack}
          directionalLockEnabled
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
        >
          <BrandGroup size={railSize} />
        </ScrollView>
      ) : (
        <View style={[styles.viewport, styles.noPointerEvents]}>
          <Animated.View style={[styles.animatedTrack, { transform: [{ translateX }] }]}>
            <BrandGroup onWidth={setGroupWidth} size={railSize} />
            <BrandGroup decorative size={railSize} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

function BrandGroup({
  decorative = false,
  onWidth,
  size,
}: {
  decorative?: boolean;
  onWidth?: (width: number) => void;
  size: RailSize;
}) {
  const artworkScale = size === 'compact' ? 0.92 : size === 'tablet' ? 1.12 : 1;

  return (
    <View
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      onLayout={onWidth ? (event) => onWidth(event.nativeEvent.layout.width) : undefined}
      style={[
        styles.group,
        size === 'compact' && styles.groupCompact,
        size === 'tablet' && styles.groupTablet,
      ]}
    >
      {BRANDS.map((brand) => (
        <View
          accessibilityLabel={decorative ? undefined : `${brand.name} logo`}
          accessibilityRole={decorative ? undefined : 'image'}
          accessible={!decorative}
          key={brand.name}
          style={[
            styles.tile,
            size === 'compact' && styles.tileCompact,
            size === 'tablet' && styles.tileTablet,
          ]}
        >
          <View
            style={[
              styles.logoViewport,
              size === 'compact' && styles.logoViewportCompact,
              size === 'tablet' && styles.logoViewportTablet,
            ]}
          >
            <Image
              accessible={false}
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={brand.source}
              style={[
                styles.logo,
                {
                  height: brand.artworkSize * artworkScale,
                  width: brand.artworkSize * artworkScale,
                },
              ]}
            />
          </View>
          <Text
            accessibilityElementsHidden
            maxFontSizeMultiplier={1.4}
            style={[styles.brandName, size === 'tablet' && styles.brandNameTablet]}
          >
            {brand.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.lg,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.goldDark,
    backgroundColor: colors.inkSoft,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heading: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: spacing.xs,
  },
  headingTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headingCopy: {
    flex: 1,
    minWidth: 190,
    gap: spacing.xs,
  },
  kicker: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.45,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  description: {
    maxWidth: 680,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
  },
  motionButton: {
    minWidth: 112,
    minHeight: 48,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...mobileFrame,
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  motionButtonPressed: {
    backgroundColor: colors.panelRaised,
  },
  motionButtonText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  viewport: {
    width: '100%',
    overflow: 'hidden',
  },
  noPointerEvents: {
    pointerEvents: 'none',
  },
  animatedTrack: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
  },
  staticTrack: {
    flexGrow: 0,
  },
  group: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 18,
    paddingHorizontal: 9,
  },
  groupCompact: {
    gap: 14,
    paddingHorizontal: 7,
  },
  groupTablet: {
    gap: 24,
    paddingHorizontal: 12,
  },
  tile: {
    width: 164,
    height: 106,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...mobileFrame,
    backgroundColor: '#080808',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tileCompact: {
    width: 152,
    height: 100,
    paddingVertical: spacing.sm,
  },
  tileTablet: {
    width: 184,
    height: 120,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  logoViewport: {
    width: 140,
    height: 62,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...mobileFrame,
    backgroundColor: '#F0EDE5',
  },
  logoViewportCompact: {
    width: 128,
    height: 56,
  },
  logoViewportTablet: {
    width: 158,
    height: 70,
  },
  logo: {
    flexShrink: 0,
    opacity: 0.98,
  },
  brandName: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.05,
    lineHeight: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  brandNameTablet: {
    fontSize: 10,
    letterSpacing: 1.2,
    lineHeight: 13,
  },
});
