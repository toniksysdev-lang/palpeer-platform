import { useEffect } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  testID?: string;
};

export function Skeleton({ width = '100%', height = 16, radius, testID }: Props) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.sm,
          backgroundColor: theme.colors.surfaceMuted,
        },
        animatedStyle,
      ]}
    />
  );
}

/** Placeholder block for a list row while data loads. */
export function SkeletonRow() {
  const theme = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
      accessibilityLabel="Loading"
      accessible
    >
      <Skeleton width={40} height={40} radius={theme.radius.pill} />
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="35%" height={12} />
      </View>
      <Skeleton width={64} height={14} />
    </View>
  );
}
