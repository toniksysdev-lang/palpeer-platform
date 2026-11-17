import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '@/newui/lib/layout';
import { useC } from '@/newui/lib/theme';
import { Icon, IconName } from './Icon';
import { Txt } from './kit';

export type TabKey = 'home' | 'history' | 'messages' | 'more';

const TABS: { key: TabKey; label: string; icon: IconName; href: Href }[] = [
  { key: 'home', label: 'Home', icon: 'home', href: '/Main' as Href },
  { key: 'history', label: 'History', icon: 'receipt', href: '/History' as Href },
  { key: 'messages', label: 'Messages', icon: 'chat', href: '/Messages' as Href },
  { key: 'more', label: 'More', icon: 'dots', href: '/More' as Href },
];

export function BottomNav({
  active,
  unread = 0,
  /** Path leaf (e.g. Main, People) — Home stays highlighted on money flows but must still navigate. */
  leaf,
}: {
  active: TabKey | string;
  unread?: number;
  leaf?: string;
}) {
  const c = useC();
  const { s } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        width: '100%',
        backgroundColor: c.card,
        paddingTop: s(6),
        paddingHorizontal: s(8),
        // System nav / home-indicator inset only — keep icon+label band the same as :3333.
        paddingBottom: s(10) + insets.bottom,
      }}
    >
      {TABS.map((t) => {
        const on = t.key === active;
        const color = on ? c.brandText : c.text2;
        const tabRootLeaf =
          t.key === 'home'
            ? 'Main'
            : t.key === 'history'
              ? 'History'
              : t.key === 'messages'
                ? 'Messages'
                : 'More';
        const alreadyOnRoot = leaf === tabRootLeaf;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              // Home (and other tabs) must work from nested money-flow screens where the
              // tab is already highlighted — previously `!on` skipped navigation entirely.
              if (alreadyOnRoot && on) return;
              router.replace(t.href);
            }}
            style={{
              flex: 1,
              minHeight: s(62),
              alignItems: 'center',
              justifyContent: 'center',
              gap: s(2),
              minWidth: 0,
            }}
          >
            <View>
              <Icon name={t.icon === 'home' && !on ? 'homeLine' : t.icon} size={s(28)} color={color} />
              {t.key === 'messages' && unread > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -s(5),
                    left: s(18),
                    minWidth: s(20),
                    height: s(20),
                    paddingHorizontal: s(3),
                    borderRadius: s(10),
                    backgroundColor: c.redFill,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt size={12} w="800" color="#FFFFFF" lh={1.6} noTr>
                    {unread > 9 ? '9+' : String(unread)}
                  </Txt>
                </View>
              ) : null}
            </View>
            <Txt size={15} w={on ? '800' : '600'} color={color} lines={1}>
              {t.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}
