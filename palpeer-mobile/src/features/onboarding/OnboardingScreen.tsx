import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PalpeerLogo } from '@/components/brand/PalpeerLogo';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';

import { GlobeIllustration } from './components/GlobeIllustration';

export function OnboardingScreen() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const globeSize = Math.min(width * 0.58, height * 0.28, 240);
  const logoWidth = Math.min(width * 0.48, 190);

  const go = (destination: '/enter-phone' | '/login' | '/view-rates') => {
    router.push(destination);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.block, { gap: theme.spacing.lg }]}>
          <View style={styles.center}>
            <PalpeerLogo width={logoWidth} />
          </View>

          <Animated.View entering={FadeIn.duration(theme.motion.slow)} style={styles.center}>
            <GlobeIllustration size={globeSize} />
          </Animated.View>

          <AppText
            variant="h3"
            align="center"
            style={{ marginHorizontal: theme.spacing.md }}
            testID="welcome-tagline"
          >
            Exchange currencies with ease and confidence, anytime, anywhere.
          </AppText>

          <View style={{ gap: theme.spacing.md, width: '100%' }}>
            <Button
              label="View Best Rate Now"
              variant="primaryOutline"
              shape="pill"
              onPress={() => go('/view-rates')}
              testID="welcome-view-rates"
            />
            <Button
              label="Get started"
              shape="pill"
              onPress={() => go('/enter-phone')}
              testID="welcome-get-started"
            />
          </View>

          <View style={styles.footer}>
            <AppText tone="secondary">Already have an account? </AppText>
            <Pressable
              onPress={() => go('/login')}
              hitSlop={10}
              accessibilityRole="link"
              testID="welcome-login"
            >
              <AppText variant="bodyStrong" style={{ color: theme.colors.info }}>
                Login
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  block: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
  },
  center: { alignItems: 'center', width: '100%' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
