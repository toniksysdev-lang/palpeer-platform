import { Tabs } from 'expo-router';
import {
  ArrowLeftRight,
  CreditCard,
  House,
  MessageSquareText,
  Users,
  WalletMinimal,
} from 'lucide-react-native';

import { TabScreenLayout } from '@/components/layout/tabScreen';
import { usePendingNavigation } from '@/features/notifications/usePendingNavigation';
import { useTheme } from '@/providers/ThemeProvider';

export default function TabsLayout() {
  const theme = useTheme();
  usePendingNavigation();

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
          title: 'Home',
          tabBarButtonTestID: 'tab-home',
          tabBarIcon: ({ color, size }) => <House color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="wallets"
        options={{
          title: 'Wallet',
          tabBarButtonTestID: 'tab-wallets',
          tabBarIcon: ({ color, size }) => <WalletMinimal color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="exchange"
        options={{
          title: 'Exchange',
          tabBarButtonTestID: 'tab-exchange',
          tabBarIcon: ({ color, size }) => <ArrowLeftRight color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="p2p"
        options={{
          title: 'P2P',
          tabBarButtonTestID: 'tab-p2p',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Cards',
          tabBarButtonTestID: 'tab-cards',
          tabBarIcon: ({ color, size }) => <CreditCard color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Messages',
          tabBarButtonTestID: 'tab-messages',
          tabBarIcon: ({ color, size }) => <MessageSquareText color={color} size={size - 2} />,
        }}
      />
      {/* Reached from Home's "see all"; kept as a tab route so `/activity` stays stable. */}
      <Tabs.Screen name="activity" options={{ title: 'Activity', href: null }} />
    </Tabs>
  );
}
