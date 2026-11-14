import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLayout } from '@/newui/lib/layout';
import { useC } from '@/newui/lib/theme';
import { BottomNav, type TabKey } from './BottomNav';

export type { TabKey };

/**
 * Shared Home / History / Messages / More chrome: one SafeArea + scroll + BottomNav.
 * Sheets sit in the content pane only so they never cover or resize the footer.
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
      {/* Content pane — overlays are scoped here so BottomNav stays fixed below. */}
      <View style={{ flex: 1, width: '100%', minHeight: 0 }}>
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
        {overlays}
      </View>
      {dockVisible ? (
        <View style={{ flexShrink: 0, width: '100%' }}>
          <BottomNav active={active} unread={unread} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
