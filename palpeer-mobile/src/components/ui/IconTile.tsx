import type { LucideIcon } from 'lucide-react-native';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type IconTileTone = 'brand' | 'surface' | 'neutral';

type Props = {
  /** Either an icon or up to two initials. */
  icon?: LucideIcon;
  initials?: string;
  shape?: 'circle' | 'rounded';
  size?: 'sm' | 'md' | 'lg';
  /** `brand`: soft green fill. `surface`: white tile with a soft shadow. `neutral`: muted fill. */
  tone?: IconTileTone;
  style?: StyleProp<ViewStyle>;
};

const SIZES = { sm: 36, md: 44, lg: 52 } as const;
const ICON_SIZES = { sm: 18, md: 22, lg: 28 } as const;

/** A coloured tile holding an icon or initials: list avatars, quick actions and similar. */
export function IconTile({
  icon,
  initials,
  shape = 'circle',
  size = 'md',
  tone = 'brand',
  style,
}: Props) {
  const theme = useTheme();
  const px = SIZES[size];
  const background =
    tone === 'brand'
      ? theme.colors.primarySoft
      : tone === 'surface'
        ? theme.colors.surface
        : theme.colors.surfaceMuted;

  return (
    <View
      style={[
        {
          width: px,
          height: px,
          borderRadius: shape === 'circle' ? theme.radius.pill : theme.radius.sm,
          backgroundColor: background,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tone === 'surface' && theme.scheme === 'light' ? theme.shadows.card : null,
        tone === 'surface' && theme.scheme === 'dark'
          ? { borderWidth: 1, borderColor: theme.colors.border }
          : null,
        style,
      ]}
    >
      {icon ? (
        <Icon icon={icon} size={ICON_SIZES[size]} color={theme.colors.primary} />
      ) : initials ? (
        <AppText variant="bodyStrong" tone="brand">
          {initials.slice(0, 2).toUpperCase()}
        </AppText>
      ) : null}
    </View>
  );
}
