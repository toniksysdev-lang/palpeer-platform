import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Hidden on entry screens that have nothing to go back to. */
  showBack?: boolean;
  header?: ReactNode;
  /** Centred, smaller title, as in the login design. */
  centered?: boolean;
};

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  showBack = true,
  header,
  centered = false,
}: Props) {
  const theme = useTheme();
  return (
    <Screen scroll keyboardAware footer={footer}>
      {showBack && router.canGoBack() ? (
        <View style={{ marginLeft: -theme.spacing.sm }}>
          <IconButton icon={ArrowLeft} accessibilityLabel="Go back" onPress={() => router.back()} />
        </View>
      ) : null}
      {header}
      <Animated.View
        entering={FadeInDown.duration(theme.motion.slow)}
        style={{ gap: theme.spacing.xs }}
      >
        <AppText
          variant={centered ? 'h2' : 'h1'}
          align={centered ? 'center' : undefined}
          accessibilityRole="header"
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText tone="secondary" align={centered ? 'center' : undefined}>
            {subtitle}
          </AppText>
        ) : null}
      </Animated.View>
      <View style={{ gap: theme.spacing.lg }}>{children}</View>
    </Screen>
  );
}
