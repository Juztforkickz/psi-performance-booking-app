import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { colors } from '@/constants/brand';

export default function CustomerTabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ink },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: '#B8B8B8',
        tabBarActiveBackgroundColor: colors.inkSoft,
        tabBarInactiveBackgroundColor: colors.ink,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.15,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarStyle: {
          paddingTop: 4,
          backgroundColor: colors.ink,
          borderTopWidth: 3,
          borderTopColor: colors.white,
          elevation: 0,
          ...(Platform.OS === 'web'
            ? { boxShadow: '0 -4px 10px rgba(0, 0, 0, 0.3)' }
            : {
                shadowColor: '#000000',
                shadowOpacity: 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: -4 },
              }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'My Garage',
          tabBarAccessibilityLabel: 'My Garage',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'car-sport' : 'car-sport-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarAccessibilityLabel: 'Bookings',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarAccessibilityLabel: 'Alerts',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
