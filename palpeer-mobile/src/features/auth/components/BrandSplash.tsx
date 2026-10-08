import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/ThemeProvider';
import { palette } from '@/theme';

const LOGO = require('../../../../assets/brand-logo.png');

/**
 * Animated light splash while preferences and session restore. Hands off to Welcome
 * (View best rate / Get started / Login) once bootstrap finishes.
 */
export function BrandSplash() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(0.86);
  const glow = useSharedValue(0.35);
  const orbit = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      scale.set(1);
      glow.set(0.55);
      return;
    }
    scale.set(
      withSequence(
        withTiming(1.06, { duration: 720, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 480, easing: Easing.inOut(Easing.quad) }),
      ),
    );
    glow.set(
      withRepeat(
        withSequence(withTiming(0.75, { duration: 900 }), withTiming(0.4, { duration: 900 })),
        -1,
        true,
      ),
    );
    orbit.set(
      withDelay(
        200,
        withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false),
      ),
    );
  }, [glow, orbit, reducedMotion, scale]);

  const logoMotion = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const ringMotion = useAnimatedStyle(() => ({
    opacity: glow.get(),
    transform: [{ rotate: `${orbit.get() * 360}deg` }, { scale: 0.92 + glow.get() * 0.12 }],
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: palette.neutral0 }]}
      accessibilityLabel="Loading PALPEER"
      accessibilityRole="progressbar"
      testID="brand-splash"
    >
      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: theme.colors.primarySoft,
              backgroundColor: theme.colors.primarySoft,
            },
            ringMotion,
          ]}
        />
        <Animated.View entering={FadeIn.duration(theme.motion.slow)} style={logoMotion}>
          <Image
            source={LOGO}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(280).duration(theme.motion.slow)} style={styles.copy}>
        <AppText variant="h2" align="center" style={{ letterSpacing: 2 }}>
          PALPEER
        </AppText>
        <AppText tone="secondary" align="center">
          Your rate, your way
        </AppText>
      </Animated.View>

      <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Animated.View
          entering={FadeIn.delay(400)}
          style={[styles.progressFill, { backgroundColor: theme.colors.primary }]}
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
    gap: 28,
  },
  stage: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 2,
    opacity: 0.5,
  },
  logo: { width: 120, height: 120 },
  copy: { gap: 6, alignItems: 'center' },
  progressTrack: {
    width: 120,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    width: '55%',
    height: '100%',
    borderRadius: 999,
  },
});
