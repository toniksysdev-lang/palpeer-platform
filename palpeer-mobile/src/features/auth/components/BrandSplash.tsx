import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BrandMark } from '@/components/brand/BrandMark';
import { useTheme } from '@/providers/ThemeProvider';
import { palette } from '@/theme';

/**
 * Shown while preferences load and the session restores. Background matches the native splash
 * (white / #07140F) so the hand-off is seamless.
 */
export function BrandSplash() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    scale.set(
      withRepeat(
        withSequence(withTiming(1.04, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
      ),
    );
  }, [scale, reducedMotion]);

  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.scheme === 'dark' ? palette.neutral950 : palette.neutral0 },
      ]}
      accessibilityLabel="Loading PALPEER"
      accessibilityRole="progressbar"
      testID="brand-splash"
    >
      <Animated.View entering={FadeIn.duration(theme.motion.slow)} style={pulse}>
        <BrandMark size="lg" />
      </Animated.View>
      <ActivityIndicator style={{ marginTop: theme.spacing.huge }} color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
