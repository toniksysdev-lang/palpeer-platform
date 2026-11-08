import { Redirect, Slot, usePathname } from 'expo-router';

import { useChatUnreadRealtime } from '@/features/chat/useChatUnreadRealtime';
import { usePendingNavigation } from '@/features/notifications/usePendingNavigation';

/**
 * Legacy Expo Tabs shell — design screens own the painted bottom bar.
 * Keep this group for deep links (`/(tabs)/…`); each child redirects to design.
 */
export default function TabsLayout() {
  usePendingNavigation();
  useChatUnreadRealtime();
  const pathname = usePathname();

  if (pathname === '/(tabs)' || pathname === '/(tabs)/') {
    return <Redirect href="/Main" />;
  }

  return <Slot />;
}
