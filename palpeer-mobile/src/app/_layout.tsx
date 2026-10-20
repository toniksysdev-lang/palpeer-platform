import '../../global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

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

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Prefer `/` (Welcome content) over any signed-out stack sibling. */
export const unstable_settings = {
  initialRouteName: 'index',
};

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
    // Hand off from the native splash to the in-app BrandSplash (logo + loading bar).
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  // BrandSplash runs on every cold open until bootstrap + minimum splash time complete.
  if (!ready) return <BrandSplash />;

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
