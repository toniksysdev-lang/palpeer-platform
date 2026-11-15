import { usePathname } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { useDesignDockUnread } from '@/design/bridge/useDesignDockUnread';

import { BottomNav, type TabKey } from './BottomNav';

const TAB_BY_LEAF: Record<string, TabKey> = {
  Main: 'home',
  History: 'history',
  Messages: 'messages',
  More: 'more',
};

/** Money flows keep the Home tab highlighted (same as :8082 tab chrome). */
const HOME_FLOW_LEAVES = new Set([
  'Add',
  'Send',
  'Change',
  'TakeOut',
  'Wallets',
  'WalletAdd',
  'Timeout',
  'People',
  'PeopleOffer',
  'PeoplePost',
  'PeopleTalk',
  'PeopleLive',
]);

/** Screens that should show the persistent dock (tab roots + common money flows). */
const DOCK_LEAVES = new Set([...Object.keys(TAB_BY_LEAF), ...HOME_FLOW_LEAVES]);

/** Feature stacks outside (design) that should still show the newui dock. */
const FEATURE_ROOT_TAB: Record<string, TabKey> = {
  p2p: 'messages',
  negotiation: 'messages',
  chat: 'messages',
};

function pathLeaf(pathname: string | null | undefined): string {
  if (!pathname) return '';
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function pathRoot(pathname: string | null | undefined): string {
  if (!pathname) return '';
  return pathname.split('/').filter(Boolean)[0] || '';
}

/**
 * One BottomNav for the whole design stack — does not remount/slide per screen,
 * so the APK footer stays uniform like localhost:8082.
 */
export function DesignTabDock() {
  const pathname = usePathname();
  const unread = useDesignDockUnread();
  const leaf = useMemo(() => pathLeaf(pathname), [pathname]);
  const root = useMemo(() => pathRoot(pathname), [pathname]);
  const featureTab = FEATURE_ROOT_TAB[root];
  const show = DOCK_LEAVES.has(leaf) || !!featureTab;
  const active: TabKey = featureTab ?? TAB_BY_LEAF[leaf] ?? 'home';

  if (!show) return null;

  return (
    <View style={{ flexShrink: 0, width: '100%' }}>
      <BottomNav active={active} unread={unread} />
    </View>
  );
}
