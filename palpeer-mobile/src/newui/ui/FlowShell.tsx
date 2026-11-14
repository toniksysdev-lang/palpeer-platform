import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * Money-flow body wrapper. BottomNav is persistent in `(design)/_layout`
 * (DesignTabDock) — do not mount a second footer here.
 */
export function FlowShell({ children }: { children: ReactNode; active?: string; unread?: number }) {
  return <View style={{ flex: 1, width: '100%', minHeight: 0 }}>{children}</View>;
}
