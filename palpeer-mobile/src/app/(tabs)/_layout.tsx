import { Tabs } from 'expo-router';
import { Bell, Clock3, House, Menu } from 'lucide-react-native';

import { TabScreenLayout } from '@/components/layout/tabScreen';
import { useChatUnreadRealtime } from '@/features/chat/useChatUnreadRealtime';
import { badgeLabel } from '@/features/notifications/logic';
import { usePendingNavigation } from '@/features/notifications/usePendingNavigation';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetUnreadCountQuery } from '@/services/api/notificationApi';
import { palette } from '@/theme/colors';

/**
 * Bottom menu (design change map): Home, Messages, History, More.
 * Wallet / Exchange / P2P / Cards tabs removed — routes stay reachable via Home / More.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const t = useT();
  usePendingNavigation();
  useChatUnreadRealtime();
  const alertUnread = useGetUnreadCountQuery();
  const notificationUnread = alertUnread.data ?? 0;
  const messagesBadge = badgeLabel(notificationUnread);

  return (
    <Tabs
      screenLayout={({ children }) => <TabScreenLayout>{children}</TabScreenLayout>}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textPrimary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.2,
          textTransform: 'uppercase',
        },
        tabBarIconStyle: { marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarButtonTestID: 'tab-home',
          tabBarIcon: ({ color, size }) => <House color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('nav.messages'),
          tabBarButtonTestID: 'tab-messages',
          tabBarBadge: messagesBadge ?? undefined,
          tabBarBadgeStyle: messagesBadge
            ? { backgroundColor: theme.colors.danger, color: palette.neutral0 }
            : undefined,
          tabBarAccessibilityLabel: messagesBadge
            ? `${t('nav.messages')}, ${notificationUnread} unread notifications`
            : t('nav.messages'),
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: t('nav.history'),
          tabBarButtonTestID: 'tab-history',
          tabBarIcon: ({ color, size }) => <Clock3 color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('nav.more'),
          tabBarButtonTestID: 'tab-more',
          tabBarIcon: ({ color, size }) => <Menu color={color} size={size - 2} />,
        }}
      />
      {/* Deep-link / stack targets — hidden from the simplified bottom menu. */}
      <Tabs.Screen name="wallets" options={{ title: 'Wallet', href: null }} />
      <Tabs.Screen name="exchange" options={{ title: 'Exchange', href: null }} />
      <Tabs.Screen name="p2p" options={{ title: 'P2P', href: null }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards', href: null }} />
    </Tabs>
  );
}
