import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, usePathname, useRouter } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemePreference } from '@/lib/theme-preference';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type NavigationItem = {
  accessibilityLabel: string;
  activeIcon: IoniconName;
  href: Href;
  inactiveIcon: IoniconName;
  isActive: (pathname: string) => boolean;
  label: string;
};

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    accessibilityLabel: 'Home',
    activeIcon: 'home',
    href: '/',
    inactiveIcon: 'home-outline',
    isActive: (pathname) => pathname === '/',
    label: 'Home',
  },
  {
    accessibilityLabel: 'My Garage',
    activeIcon: 'car-sport',
    href: '/garage',
    inactiveIcon: 'car-sport-outline',
    isActive: (pathname) => ['/garage', '/account', '/parts'].some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    label: 'My Garage',
  },
  {
    accessibilityLabel: 'Bookings',
    activeIcon: 'calendar',
    href: '/bookings',
    inactiveIcon: 'calendar-outline',
    isActive: (pathname) => pathname === '/bookings' || pathname === '/booking',
    label: 'Bookings',
  },
  {
    accessibilityLabel: 'Vehicle Reports',
    activeIcon: 'document-text',
    href: '/vehicle-reports',
    inactiveIcon: 'document-text-outline',
    isActive: (pathname) => pathname === '/vehicle-reports',
    label: 'Vehicle Reports',
  },
  {
    accessibilityLabel: 'Settings and Notifications',
    activeIcon: 'notifications',
    href: '/alerts',
    inactiveIcon: 'notifications-outline',
    isActive: (pathname) => pathname === '/alerts',
    label: 'Settings',
  },
] as const;

export function PersistentBottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useThemePreference();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <SafeAreaView
      edges={['right', 'bottom', 'left']}
      style={[styles.safeArea, { backgroundColor: theme.surfaceRaised, borderTopColor: theme.frame }]}
    >
      <View accessibilityRole="tablist" style={styles.navigationRow}>
        {NAVIGATION_ITEMS.map((item) => {
          const selected = item.isActive(pathname);
          return (
            <Pressable
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.label}
              onPress={() => {
                if (pathname !== item.href) router.replace(item.href);
              }}
              style={({ pressed }) => [
                styles.navigationItem,
                selected && { backgroundColor: theme.surface },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                color={selected ? theme.accent : theme.textMuted}
                name={selected ? item.activeIcon : item.inactiveIcon}
                size={22}
              />
              <Text
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.25}
                minimumFontScale={0.78}
                numberOfLines={2}
                style={[styles.label, { color: selected ? theme.accent : theme.textMuted }]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flexShrink: 0,
    borderTopWidth: 3,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 -4px 10px rgba(0, 0, 0, 0.25)' }
      : {
          shadowColor: '#000000',
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -4 },
          elevation: 0,
        }),
  },
  navigationRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: 4,
  },
  navigationItem: {
    minWidth: 0,
    minHeight: 62,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
    paddingVertical: 5,
  },
  label: {
    width: '100%',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.05,
    lineHeight: 11.5,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
