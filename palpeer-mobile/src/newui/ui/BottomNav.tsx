import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '@/newui/lib/layout';
import { useC } from '@/newui/lib/theme';
import { Icon, IconName } from './Icon';
import { Txt } from './kit';

const TABS: { key: string; label: string; icon: IconName; href: Href }[] = [
  { key: 'home', label: 'Home', icon: 'home', href: '/Main' as Href },
  { key: 'history', label: 'History', icon: 'receipt', href: '/History' as Href },
  { key: 'messages', label: 'Messages', icon: 'chat', href: '/Messages' as Href },
  { key: 'more', label: 'More', icon: 'dots', href: '/More' as Href },
];

export function BottomNav({ active, unread = 0 }: { active: string; unread?: number }) {
  const c = useC();
  const { s } = useLayout();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        width: '100%',
        backgroundColor: c.card,
        paddingTop: s(6),
        paddingHorizontal: s(8),
        paddingBottom: s(10) + insets.bottom,
      }}
    >
      {TABS.map((t) => {
        const on = t.key === active;
        const color = on ? c.brandText : c.text2;
        return (
          <Pressable
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => !on && router.replace(t.href)}
            style={{ flex: 1, minHeight: s(62), alignItems: 'center', justifyContent: 'center', gap: s(2), minWidth: 0 }}
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
