import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';

import { usePressScale } from './usePressScale';

type Props = {
  children: ReactNode;
  /** Defaults to the theme's hero gradient. */
  colors?: readonly [string, string, ...string[]];
  padding?: 'md' | 'lg';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A card on a left-to-right gradient, for hero content such as balances. */
export function GradientCard({
  children,
  colors,
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
    padding: padding === 'md' ? theme.spacing.md : theme.spacing.lg,
    overflow: 'hidden',
    ...(theme.scheme === 'light' ? theme.shadows.card : null),
  };
  const background = (
    <LinearGradient
      colors={colors ?? [theme.colors.heroStart, theme.colors.heroEnd]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFill}
    />
  );

  if (!onPress) {
    return (
      <Animated.View testID={testID} style={[surface, style]}>
        {background}
        {children}
      </Animated.View>
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
      {background}
      {children}
    </AnimatedPressable>
  );
}
