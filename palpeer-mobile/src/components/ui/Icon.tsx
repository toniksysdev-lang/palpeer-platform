import type { LucideIcon } from 'lucide-react-native';
import { Platform } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';
import type { Theme } from '@/theme';

type Props = {
  icon: LucideIcon;
  size?: keyof Theme['iconSize'] | number;
  color?: string;
  strokeWidth?: number;
  /** Decorative icons are hidden from screen readers; pass a label when the icon carries meaning. */
  accessibilityLabel?: string;
};

export function Icon({
  icon: IconComponent,
  size = 'md',
  color,
  strokeWidth = 2,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const px = typeof size === 'number' ? size : theme.iconSize[size];
  // Lucide renders an SVG on web; RN accessibility props are not valid DOM attributes.
  const a11y =
    Platform.OS === 'web'
      ? accessibilityLabel
        ? { 'aria-label': accessibilityLabel, role: 'img' as const }
        : { 'aria-hidden': true as const }
      : {
          accessible: !!accessibilityLabel,
          accessibilityLabel,
          importantForAccessibility: (accessibilityLabel ? 'yes' : 'no-hide-descendants') as
            | 'yes'
            | 'no-hide-descendants',
        };

  return (
    <IconComponent
      size={px}
      color={color ?? theme.colors.textPrimary}
      strokeWidth={strokeWidth}
      {...a11y}
    />
  );
}
