import type { LucideIcon } from 'lucide-react-native';

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
  return (
    <IconComponent
      size={px}
      color={color ?? theme.colors.textPrimary}
      strokeWidth={strokeWidth}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
