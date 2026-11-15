import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLayout } from '@/newui/lib/layout';
import { useC } from '@/newui/lib/theme';

import type { TabKey } from './BottomNav';

export type { TabKey };

/**
 * Shared Home / History / Messages / More body chrome.
 * BottomNav is owned by `(design)/_layout` (DesignTabDock) so it stays fixed.
 * Sheets use Modal Overlay on native — `overlays` can still be passed for web absolute sheets.
 */
export function TabRootShell({
  gap = 14,
  refreshing,
  onRefresh,
  children,
  overlays,
  bodyStyle,
}: {
  /** @deprecated Dock is persistent in design layout; kept for call-site compat. */
  active?: TabKey;
  /** @deprecated Dock unread comes from DesignTabDock. */
  unread?: number;
  /** @deprecated Dock is always shown by DesignTabDock for tab roots. */
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
      <View style={{ flex: 1, width: '100%', minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={[
            {
              padding: s(16),
              paddingTop: s(12),
              // Tight bottom so content sits just above the persistent DesignTabDock.
              paddingBottom: s(8),
              gap: s(gap),
              width: '100%',
            },
            bodyStyle,
          ]}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
    </SafeAreaView>
  );
}
