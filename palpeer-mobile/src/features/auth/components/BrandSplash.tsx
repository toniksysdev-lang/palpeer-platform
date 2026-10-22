import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';

import { PALPEER_LOGO } from '@/components/brand/logo';
import { useTheme } from '@/providers/ThemeProvider';
import { palette } from '@/theme';

/** Indeterminate progress cycle length while bootstrap runs. */
const PROGRESS_CYCLE_MS = 1200;
const PROGRESS_TRACK_WIDTH = 148;

/** Dismiss any static HTML boot splash once React BrandSplash is painting (web only). */
function hideWebBootSplash() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const el = document.getElementById('palpeer-boot-splash');
  if (!el) return;
  el.classList.add('is-hidden');
  window.setTimeout(() => el.remove(), 120);
}

/**
 * Branded splash while preferences and session restore.
 * Uses RN Animated (not Reanimated) so cold start cannot die on worklets/OEM quirks.
 * Tagline lives in the logo artwork — do not add duplicate “Your rate, your way” text.
 */
export function BrandSplash() {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0.08)).current;
  const [barWidth, setBarWidth] = useState(12);

  useEffect(() => {
    hideWebBootSplash();
  }, []);

  useEffect(() => {
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
    progressAnim.start();
    const id = progress.addListener(({ value }) => {
      setBarWidth(Math.max(12, Math.min(PROGRESS_TRACK_WIDTH, value * PROGRESS_TRACK_WIDTH)));
    });
    return () => {
      progressAnim.stop();
      progress.removeListener(id);
    };
  }, [progress]);

  return (
    <View
      style={[styles.container, { backgroundColor: palette.neutral0 }]}
      accessibilityLabel="Loading PALPEER"
      accessibilityRole="progressbar"
      testID="brand-splash"
    >
      <Image
        source={PALPEER_LOGO}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />

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
