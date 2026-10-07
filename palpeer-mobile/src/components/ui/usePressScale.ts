import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';

/** Subtle scale-down on press used by every tappable surface. */
export function usePressScale(target?: number) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const pressedScale = target ?? theme.motion.pressScale;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return {
    animatedStyle,
    onPressIn: () => scale.set(withTiming(pressedScale, { duration: theme.motion.fast })),
    onPressOut: () => scale.set(withTiming(1, { duration: theme.motion.fast })),
  };
}
