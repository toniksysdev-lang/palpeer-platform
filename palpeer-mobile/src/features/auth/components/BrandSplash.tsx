import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';

/** Newui lockup — same mark as the landing hero. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('@/newui/assets/logo.png') as number;

/** Indeterminate progress cycle length while bootstrap runs. */
const PROGRESS_CYCLE_MS = 1200;
const PROGRESS_TRACK_WIDTH = 148;
/** Match newui land hero (`c.hero` / brand green) before ThemeProvider mounts. */
const SPLASH_BG = '#081410';
const PROGRESS_TRACK = 'rgba(255,255,255,0.16)';
const PROGRESS_FILL = '#0B6E4F';

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
 * Width is driven by Animated values only — no per-frame setState (that starved JS on APK).
 * Tagline lives in the logo artwork — do not add duplicate “Your rate, your way” text.
 */
export function BrandSplash() {
  const progress = useRef(new Animated.Value(0.08)).current;

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
    return () => {
      progressAnim.stop();
    };
  }, [progress]);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PROGRESS_TRACK_WIDTH],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.container, { backgroundColor: SPLASH_BG }]}
      accessibilityLabel="Loading PALPEER"
      accessibilityRole="progressbar"
      testID="brand-splash"
    >
      <Image
        source={LOGO}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessibilityLabel="Palpeer. Your rate, your way."
      />

      <View
        style={[styles.progressTrack, { backgroundColor: PROGRESS_TRACK }]}
        testID="brand-splash-progress"
      >
        <Animated.View
          style={[styles.progressFill, { backgroundColor: PROGRESS_FILL, width: barWidth }]}
        />
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
  logo: { width: 220, height: 92 },
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
