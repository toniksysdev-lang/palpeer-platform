import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLayout } from '@/newui/lib/layout';
import { useC } from '@/newui/lib/theme';
import { BottomNav } from './BottomNav';

export type TabKey = 'home' | 'history' | 'messages' | 'more';

/**
 * Shared Home / History / Messages / More chrome: one SafeArea + scroll metrics +
 * BottomNav. Keep dockVisible false under full-screen Overlays so Android elevation
 * cannot stretch or crush the footer.
 */
export function TabRootShell({
  active,
  unread = 0,
  dockVisible = true,
  gap = 14,
  refreshing,
  onRefresh,
  children,
  overlays,
  bodyStyle,
}: {
  active: TabKey;
  unread?: number;
  dockVisible?: boolean;
  gap?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
  overlays?: ReactNode;
  bodyStyle?: StyleProp<ViewStyle>;
}) {
  const c = useC();
  const { s, page } = useLayout();

  return (
    <SafeAreaView edges={['top']} style={[page, { backgroundColor: c.bg }]}>
      <ScrollView
        style={{ flex: 1, width: '100%' }}
        contentContainerStyle={[
          {
            padding: s(16),
            paddingTop: s(12),
            paddingBottom: s(24),
            gap: s(gap),
            width: '100%',
          },
          bodyStyle,
        ]}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={c.brand}
              colors={[c.brand]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {/* flexShrink:0 dock — always the same bar; hide only while a full-screen sheet covers it. */}
      {dockVisible ? (
        <View style={{ flexShrink: 0, width: '100%' }}>
          <BottomNav active={active} unread={unread} />
        </View>
      ) : null}
      {overlays}
    </SafeAreaView>
  );
}
