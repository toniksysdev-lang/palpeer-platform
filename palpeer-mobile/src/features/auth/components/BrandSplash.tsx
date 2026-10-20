import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

import { PALPEER_LOGO_URI } from '@/components/brand/logo';
import { useTheme } from '@/providers/ThemeProvider';
import { palette } from '@/theme';

/** Indeterminate progress cycle length while bootstrap runs. */
const PROGRESS_CYCLE_MS = 1600;
const PROGRESS_TRACK_WIDTH = 148;

/**
 * Branded splash shown on every cold app open while preferences and session restore.
 * Uses RN Animated (not Reanimated) so cold start cannot die on worklets/OEM quirks.
 */
export function BrandSplash() {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(0.92)).current;
  const progress = useRef(new Animated.Value(0.08)).current;
  const [barWidth, setBarWidth] = useState(12);

  useEffect(() => {
    const scaleAnim = Animated.timing(scale, {
      toValue: 1,
      duration: 560,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const progressAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 0.92,
          duration: PROGRESS_CYCLE_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0.12,
          duration: PROGRESS_CYCLE_MS * 0.55,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    scaleAnim.start();
    progressAnim.start();
    const id = progress.addListener(({ value }) => {
      setBarWidth(Math.max(12, Math.min(PROGRESS_TRACK_WIDTH, value * PROGRESS_TRACK_WIDTH)));
    });
    return () => {
      scaleAnim.stop();
      progressAnim.stop();
      progress.removeListener(id);
    };
  }, [progress, scale]);

  return (
    <View
      style={[styles.container, { backgroundColor: palette.neutral0 }]}
      accessibilityLabel="Loading PALPEER"
      accessibilityRole="progressbar"
      testID="brand-splash"
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image
          source={{ uri: PALPEER_LOGO_URI }}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      <View
        style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceMuted }]}
        testID="brand-splash-progress"
      >
        <View style={[styles.progressFill, { backgroundColor: theme.colors.primary, width: barWidth }]} />
      </View>
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
  logo: { width: 200, height: 84 },
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