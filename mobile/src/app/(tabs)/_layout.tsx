import { Tabs } from 'expo-router';

export default function CustomerTabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      tabBar={() => null}
      screenOptions={{
        headerShown: false,
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
