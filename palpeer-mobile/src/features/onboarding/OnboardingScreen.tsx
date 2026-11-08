import { router, useFocusEffect } from 'expo-router';
import { Moon, Sun } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PalpeerLogo } from '@/components/brand/PalpeerLogo';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAppearance } from '@/hooks/useAppearance';
import { useT } from '@/i18n/useT';
import { useTheme } from '@/providers/ThemeProvider';
import { signupDraftStorage, type SignupDraft } from '@/services/storage/signupDraftStorage';
import { palette } from '@/theme';

import { GlobeIllustration } from './components/GlobeIllustration';

export function OnboardingScreen() {
  const theme = useTheme();
  const t = useT();
  const { setAppearance } = useAppearance();
  const isDark = theme.scheme === 'dark';
  const { width, height } = useWindowDimensions();
  const globeSize = Math.min(width * 0.58, height * 0.28, 240);
  const logoWidth = Math.min(width * 0.62, 240);
  const [draft, setDraft] = useState<SignupDraft | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void signupDraftStorage.load().then((value) => {
        if (active) setDraft(value);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const go = (destination: '/enter-phone' | '/login' | '/view-rates') => {
    router.push(destination);
  };

  const continueRegistration = () => {
    if (!draft) {
      go('/enter-phone');
      return;
    }
    switch (draft.step) {
      case 'EMAIL_OTP':
        if (draft.email) {
          router.push({
            pathname: '/verify-email',
            params: { email: draft.email, ...(draft.phone ? { phone: draft.phone } : null) },
          });
          return;
        }
        break;
      case 'REGISTER':
        if (draft.phone) {
          router.push({
            pathname: '/register',
            params: {
              phone: draft.phone,
              ...(draft.countryIso2 ? { countryIso2: draft.countryIso2 } : null),
            },
          });
          return;
        }
        break;
      case 'LOGIN':
        router.push({
          pathname: '/login',
          params: { email: draft.email ?? draft.phone, notice: 'verified' },
        });
        return;
      case 'PHONE_OTP':
        if (draft.phone) {
          router.push({
            pathname: '/verify-phone',
            params: {
              phone: draft.phone,
              signup: '1',
              ...(draft.countryIso2 ? { countryIso2: draft.countryIso2 } : null),
            },
          });
          return;
        }
        break;
    }
    go('/enter-phone');
  };

  const toggleLook = () => {
    // Design: Light is default; landing Dark/Light toggles App look (system not offered here).
    const next = isDark ? 'light' : 'dark';
    setAppearance(next);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.hero, { backgroundColor: palette.emerald900 }]}>
        <View style={styles.heroTop}>
          <Pressable
            onPress={toggleLook}
            accessibilityRole="button"
            accessibilityLabel={isDark ? 'Switch to light look' : 'Switch to dark look'}
            hitSlop={10}
            style={[styles.lookChip, { borderColor: 'rgba(255,255,255,0.35)' }]}
            testID="welcome-app-look"
          >
            <Icon icon={isDark ? Sun : Moon} size="sm" color={palette.neutral0} />
            <AppText variant="caption" style={{ color: palette.neutral0 }}>
              {isDark ? t('landing.light') : t('landing.dark')}
            </AppText>
          </Pressable>
        </View>
        <View style={styles.center}>
          <PalpeerLogo width={logoWidth} />
        </View>
        <Animated.View entering={FadeIn.duration(theme.motion.slow)} style={styles.center}>
          <GlobeIllustration size={globeSize} />
        </Animated.View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.xl,
            backgroundColor: theme.colors.background,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.block, { gap: theme.spacing.lg }]}>
          <AppText
            variant="h3"
            align="center"
            style={{ marginHorizontal: theme.spacing.md }}
            testID="welcome-tagline"
          >
            {t('landing.tagline')}
          </AppText>

          <View style={{ gap: theme.spacing.md, width: '100%' }}>
            {draft ? (
              <Button
                label="Continue registration"
                shape="pill"
                onPress={continueRegistration}
                testID="welcome-continue-registration"
              />
            ) : (
              <Button
                label={t('landing.getStarted')}
                shape="pill"
                onPress={() => go('/enter-phone')}
                testID="welcome-get-started"
              />
            )}
            <Button
              label={t('landing.seeBestRate')}
              variant="primaryOutline"
              shape="pill"
              onPress={() => go('/view-rates')}
              testID="welcome-view-rates"
            />
            {draft ? (
              <Button
                label="Start over"
                variant="primaryOutline"
                shape="pill"
                onPress={() => {
                  void signupDraftStorage.clear().then(() => {
                    setDraft(null);
                    go('/enter-phone');
                  });
                }}
                testID="welcome-start-over"
              />
            ) : null}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={() => go('/login')}
              hitSlop={10}
              accessibilityRole="link"
              testID="welcome-login"
            >
              <AppText
                variant="bodyStrong"
                style={{ color: theme.colors.info, textDecorationLine: 'underline' }}
              >
                {t('landing.login')}
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
  hero: {
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 16,
    alignItems: 'center',
  },
  heroTop: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  lookChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  content: {
    flexGrow: 1,
  },
  block: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
  },
  center: { alignItems: 'center' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
