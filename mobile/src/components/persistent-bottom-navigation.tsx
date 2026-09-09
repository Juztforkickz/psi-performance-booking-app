import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { type ComponentProps, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemePreference } from '@/lib/theme-preference';
import { useNotifications } from '@/lib/notifications';
import { resolveStaffSection, staffTabForSection, type StaffTab } from '@/lib/staff-navigation';
import { useStaffNavigation } from '@/lib/staff-navigation-context';

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
    label: 'Reports',
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

const STAFF_NAVIGATION_ITEMS: readonly {
  accessibilityLabel: string;
  activeIcon: IoniconName;
  inactiveIcon: IoniconName;
  label: string;
  section: StaffTab;
}[] = [
  { accessibilityLabel: 'Staff dashboard', activeIcon: 'grid', inactiveIcon: 'grid-outline', label: 'Dashboard', section: 'dashboard' },
  { accessibilityLabel: 'Staff bookings', activeIcon: 'calendar', inactiveIcon: 'calendar-outline', label: 'Bookings', section: 'bookings' },
  { accessibilityLabel: 'Staff customers', activeIcon: 'people', inactiveIcon: 'people-outline', label: 'Customers', section: 'customers' },
  { accessibilityLabel: 'Staff records', activeIcon: 'document-text', inactiveIcon: 'document-text-outline', label: 'Records', section: 'records' },
  { accessibilityLabel: 'Staff workspace menu', activeIcon: 'menu', inactiveIcon: 'menu-outline', label: 'Menu', section: 'menu' },
];

export function PersistentBottomNavigation() {
  const pathname = usePathname();
  const { section, bookingId, customerId } = useGlobalSearchParams<{ section?: string | string[]; bookingId?: string | string[]; customerId?: string | string[] }>();
  const router = useRouter();
  const { navigateToSection } = useStaffNavigation();
  const { theme } = useThemePreference();
  const { unreadCount } = useNotifications();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const isStaffWorkspace = pathname === '/staff' || pathname === '/staff-security';
  const currentStaffSection = resolveStaffSection(section);
  const hasBookingDetail = currentStaffSection === 'bookings' && Boolean(Array.isArray(bookingId) ? bookingId[0] : bookingId);
  const hasCustomerDetail = currentStaffSection === 'customers' && Boolean(Array.isArray(customerId) ? customerId[0] : customerId);
  const currentStaffTab = pathname === '/staff-security' ? 'menu' : staffTabForSection(currentStaffSection);
  const navigationItems = isStaffWorkspace ? STAFF_NAVIGATION_ITEMS : NAVIGATION_ITEMS;

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
      <View accessibilityLabel={isStaffWorkspace ? 'Staff workspace navigation' : 'Customer app navigation'} accessibilityRole="tablist" style={styles.navigationRow}>
        {navigationItems.map((item) => {
          const selected = 'section' in item ? currentStaffTab === item.section : item.isActive(pathname);
          return (
            <Pressable
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.label}
              onPress={() => {
                if ('section' in item) {
                  if (pathname !== '/staff' || currentStaffSection !== item.section || (item.section === 'bookings' && hasBookingDetail) || (item.section === 'customers' && hasCustomerDetail)) navigateToSection(item.section);
                } else if (pathname !== item.href) router.replace(item.href);
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
                size={21}
              />
              {'href' in item && item.href === '/alerts' && unreadCount > 0 ? (
                <View accessibilityLabel={`${unreadCount} unread notifications`} style={[styles.notificationBadge, { backgroundColor: theme.accent }]}>
                  <Text style={[styles.notificationBadgeText, { color: theme.textInverse }]}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
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
    paddingHorizontal: 3,
    paddingTop: 4,
  },
  navigationItem: {
    position: 'relative',
    minWidth: 0,
    minHeight: 62,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  notificationBadge: { position: 'absolute', right: 8, top: 2, minWidth: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notificationBadgeText: { fontSize: 8, fontWeight: '900' },
  label: {
    width: '100%',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 11,
    paddingHorizontal: 1,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
