import '../../global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { BrandSplash } from '@/features/auth/components/BrandSplash';
import { OfferBiometricUnlock } from '@/features/security/OfferBiometricUnlock';
import { RequirePinSetup } from '@/features/security/RequirePinSetup';
import { RequireSecurityQuestions } from '@/features/security/RequireSecurityQuestions';
import { LockScreen } from '@/features/security/lock/LockScreen';
import { useAppLockLifecycle } from '@/features/security/lock/useAppLockLifecycle';
import { useAppSwitcherPrivacy } from '@/features/security/lock/useAppSwitcherPrivacy';
import { useApplyPendingReferral } from '@/features/promotions/useApplyPendingReferral';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useSignedOutWelcomeLanding } from '@/hooks/useSignedOutWelcomeLanding';
import { AppProviders } from '@/providers/AppProviders';
import { useTheme } from '@/providers/ThemeProvider';
import { useAppSelector } from '@/store';
import { palette } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Prefer `/` (Welcome content) over any signed-out stack sibling. */
export const unstable_settings = {
  initialRouteName: 'index',
};

/** True when the app is embedded in the phone-frame preview (parent already shows splash). */
function isWebPreviewFrame(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.parent != null && window.parent !== window;
  } catch {
    return true;
  }
}

function notifyPreviewSplashDone() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.parent?.postMessage({ type: 'palpeer-brand-splash-ready' }, '*');
  } catch {
    // Ignore cross-origin / missing parent.
  }
}

function RootNavigator() {
  const { ready } = useAppBootstrap();
  const theme = useTheme();
  const isAuthenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const locked = useAppSelector((state) => state.appLock.locked);
  useAppLockLifecycle();
  useAppSwitcherPrivacy(isAuthenticated);
  useSignedOutWelcomeLanding(ready, isAuthenticated);
  useApplyPendingReferral();

  useEffect(() => {
    if (ready) notifyPreviewSplashDone();
  }, [ready]);

  if (!ready) {
    // Preview iframe: parent overlay is the splash — avoid a second in-app splash.
    if (isWebPreviewFrame()) {
      return <View style={{ flex: 1, backgroundColor: palette.neutral0 }} testID="boot-placeholder" />;
    }
    // One splash only (like localhost:3333): hide the static native splash once BrandSplash paints.
    return (
      <View
        style={{ flex: 1, backgroundColor: palette.neutral0 }}
        onLayout={() => {
          SplashScreen.hideAsync().catch(() => undefined);
        }}
      >
        <BrandSplash />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {/* Always first: forces Welcome (not Login) when signed out. */}
        <Stack.Screen name="index" />
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="kyc" />
          <Stack.Screen name="security" />
          <Stack.Screen name="wallet" />
          <Stack.Screen name="exchange" />
          <Stack.Screen name="p2p" />
          <Stack.Screen name="negotiation" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="transaction" />
          <Stack.Screen name="cards" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="referrals" />
          <Stack.Screen name="promotions" />
          <Stack.Screen name="settings" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          {/* One unsigned group; its initialRouteName is Welcome (not Login). */}
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        {/* Public, but must stay last: a guarded-out `/` falls back to the first allowed screen. */}
        <Stack.Screen name="view-rates" />
        <Stack.Screen name="support" />
        <Stack.Screen name="p2p-share/[id]" />
      </Stack>
      <OfflineBanner />
      {isAuthenticated ? <RequirePinSetup /> : null}
      {isAuthenticated ? <RequireSecurityQuestions /> : null}
      {isAuthenticated ? <OfferBiometricUnlock /> : null}
      {isAuthenticated && locked ? <LockScreen /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
