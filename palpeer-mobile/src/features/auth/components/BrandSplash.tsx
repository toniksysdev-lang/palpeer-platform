import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/ThemeProvider';
import { palette } from '@/theme';

const LOGO = require('../../../../assets/brand-logo.png');

/** Indeterminate progress cycle length while bootstrap runs. */
const PROGRESS_CYCLE_MS = 1600;
const PROGRESS_TRACK_WIDTH = 148;

/**
 * Branded splash shown on every cold app open while preferences and session restore.
 * Logo centered with an animated loading bar directly underneath.
 */
export function BrandSplash() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(0.92);
  const progress = useSharedValue(0.08);

  useEffect(() => {
    if (reducedMotion) {
      scale.set(1);
      progress.set(0.55);
      return;
    }
    scale.set(withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }));
    progress.set(
      withRepeat(
        withSequence(
          withTiming(0.92, { duration: PROGRESS_CYCLE_MS, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.12, { duration: PROGRESS_CYCLE_MS * 0.55, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [progress, reducedMotion, scale]);

  const logoMotion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const barMotion = useAnimatedStyle(() => ({
    width: Math.max(12, Math.min(PROGRESS_TRACK_WIDTH, progress.get() * PROGRESS_TRACK_WIDTH)),
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: palette.neutral0 }]}
      accessibilityLabel="Loading PALPEER"
      accessibilityRole="progressbar"
      testID="brand-splash"
    >
      <Animated.View entering={FadeIn.duration(theme.motion.slow)} style={logoMotion}>
        <Image
          source={LOGO}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(180)}
        style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceMuted }]}
        testID="brand-splash-progress"
      >
        <Animated.View
          style={[styles.progressFill, { backgroundColor: theme.colors.primary }, barMotion]}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(240).duration(theme.motion.base)} style={styles.copy}>
        <AppText variant="h2" align="center" style={{ letterSpacing: 2 }}>
          PALPEER
        </AppText>
        <AppText tone="secondary" align="center">
          Your rate, your way
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  logo: { width: 168, height: 150 },
  copy: { gap: 6, alignItems: 'center' },
  progressTrack: {
    width: PROGRESS_TRACK_WIDTH,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
