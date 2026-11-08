import { Tabs, Redirect, usePathname } from 'expo-router';
import { View } from 'react-native';

import { useChatUnreadRealtime } from '@/features/chat/useChatUnreadRealtime';
import { usePendingNavigation } from '@/features/notifications/usePendingNavigation';

/**
 * Legacy Expo Tabs group kept for deep links (`/(tabs)/…`).
 * Design screens own the painted bottom bar — hide the Lucide tab bar and bounce
 * each tab file to `/Main`, `/Messages`, `/History`, `/More`, etc.
 */
export default function TabsLayout() {
  usePendingNavigation();
  useChatUnreadRealtime();
  const pathname = usePathname();

  if (pathname === '/(tabs)' || pathname === '/(tabs)/') {
    return <Redirect href="/Main" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Design dock replaces this chrome — keep routes, hide the bar.
        tabBarStyle: { display: 'none', height: 0, overflow: 'hidden' },
        tabBarItemStyle: { display: 'none', height: 0 },
        tabBarButton: () => <View style={{ width: 0, height: 0 }} />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="chat" options={{ title: 'Messages' }} />
      <Tabs.Screen name="activity" options={{ title: 'History' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
      <Tabs.Screen name="wallets" options={{ href: null }} />
      <Tabs.Screen name="exchange" options={{ href: null }} />
      <Tabs.Screen name="p2p" options={{ href: null }} />
      <Tabs.Screen name="cards" options={{ href: null }} />
    </Tabs>
  );
}
