import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';
import type { Theme } from '@/theme';

export type TextVariant = keyof Theme['typography'];
export type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'inverse'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

type Props = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
};

function colorFor(theme: Theme, tone: TextTone): string {
  const c = theme.colors;
  switch (tone) {
    case 'primary':
      return c.textPrimary;
    case 'secondary':
      return c.textSecondary;
    case 'muted':
      return c.textMuted;
    case 'inverse':
      return c.textInverse;
    case 'brand':
      return c.primary;
    case 'info':
      return c.info;
    case 'success':
      return c.success;
    case 'warning':
      return c.warning;
    case 'danger':
      return c.danger;
  }
}

export function AppText({ variant = 'body', tone = 'primary', align, style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[theme.typography[variant], { color: colorFor(theme, tone), textAlign: align }, style]}
    />
  );
}
