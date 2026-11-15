import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useAppearance } from '@/hooks/useAppearance';
import { NewUiProviders } from '@/newui/providers';
import { DesignTabDock } from '@/newui/ui/DesignTabDock';
import { DARK_PAGE } from '@/design/dc/theme';

/**
 * Wraps legacy feature stacks (P2P request, negotiation, chat) so they share
 * the newui theme shell + persistent DesignTabDock used by (design) routes.
 */
export function NewUiStackShell({ children }: { children: ReactNode }) {
  const { appearance } = useAppearance();
  const dark = appearance === 'dark';
  return (
    <NewUiProviders>
      <View style={{ flex: 1, backgroundColor: dark ? DARK_PAGE : '#F3F6F4' }}>
        <View style={{ flex: 1, minHeight: 0, width: '100%' }}>{children}</View>
        <DesignTabDock />
      </View>
    </NewUiProviders>
  );
}
