import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';

import { usePressScale } from './usePressScale';

type Props = {
  children: ReactNode;
  variant?: 'elevated' | 'outlined' | 'muted';
  padding?: 'none' | 'md' | 'lg';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  children,
  variant = 'elevated',
  padding = 'lg',
  onPress,
  accessibilityLabel,
  style,
  testID,
}: Props) {
  const theme = useTheme();
  const press = usePressScale(0.98);

  const surface: ViewStyle = {
    borderRadius: theme.radius.lg,
    padding: padding === 'none' ? 0 : padding === 'md' ? theme.spacing.md : theme.spacing.lg,
    backgroundColor: variant === 'muted' ? theme.colors.surfaceMuted : theme.colors.surface,
    borderWidth: variant === 'outlined' || theme.scheme === 'dark' ? 1 : 0,
    borderColor: theme.colors.border,
    ...(variant === 'elevated' && theme.scheme === 'light' ? theme.shadows.card : null),
  };

  if (!onPress) {
    return (
      <View testID={testID} style={[surface, style]}>
        {children}
      </View>
    );
  }

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[surface, style, press.animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
