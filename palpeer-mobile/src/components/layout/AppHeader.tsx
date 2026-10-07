import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  title: string;
  /** Usually an `IconButton` (menu, back). */
  left?: ReactNode;
  right?: ReactNode;
  testID?: string;
};

/** Top bar for tab screens: optional left and right actions around a centred title. */
export function AppHeader({ title, left, right, testID }: Props) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
    >
      <View style={{ minWidth: theme.touchTarget, alignItems: 'flex-start' }}>{left}</View>
      <AppText
        variant="h3"
        align="center"
        numberOfLines={1}
        accessibilityRole="header"
        style={{ flex: 1 }}
      >
        {title}
      </AppText>
      <View style={{ minWidth: theme.touchTarget, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
