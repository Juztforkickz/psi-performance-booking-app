import { Tabs } from 'expo-router';

import { AmbientScreen } from '@/components/ambient-background';

export default function CustomerTabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      tabBar={() => null}
      screenLayout={({ children, route }) => <AmbientScreen routeName={route.name}>{children}</AmbientScreen>}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'My Garage',
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Settings & Notifications',
        }}
      />
    </Tabs>
  );
}
