import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLayout } from '@/newui/lib/layout';
import { useC } from '@/newui/lib/theme';
import { BottomNav, type TabKey } from './BottomNav';

/**
 * Money-flow chrome (Add / Send / Change / Withdraw): same BottomNav as tab roots
 * so the footer does not jump when leaving Home.
 */
export function FlowShell({
  active = 'home',
  unread = 0,
  children,
}: {
  active?: TabKey;
  unread?: number;
  children: ReactNode;
}) {
  const c = useC();
  const { page } = useLayout();
  return (
    <SafeAreaView edges={['top']} style={[page, { backgroundColor: c.bg }]}>
      <View style={{ flex: 1, width: '100%', minHeight: 0 }}>{children}</View>
      <View style={{ flexShrink: 0, width: '100%' }}>
        <BottomNav active={active} unread={unread} />
      </View>
    </SafeAreaView>
  );
}
