import '../../global.css';
import '@/boot/previewSoftKeyboard';
import '@/design/dc/shims';

import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
  NotoSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/noto-sans';
import { Stack, type SuspenseFallbackProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { BrandSplash } from '@/features/auth/components/BrandSplash';
import { OfferBiometricUnlock } from '@/features/security/OfferBiometricUnlock';
import { RequireProfileSetup } from '@/features/profile/RequireProfileSetup';
import { RequireNewDevicePin } from '@/features/security/RequireNewDevicePin';
import { RequirePinSetup } from '@/features/security/RequirePinSetup';
import { RequireSecurityQuestions } from '@/features/security/RequireSecurityQuestions';
import { LockScreen } from '@/features/security/lock/LockScreen';
import {
  markUserActive,
  useAppLockLifecycle,
} from '@/features/security/lock/useAppLockLifecycle';
import { useAppSwitcherPrivacy } from '@/features/security/lock/useAppSwitcherPrivacy';
import { useApplyPendingReferral } from '@/features/promotions/useApplyPendingReferral';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useSignedOutWelcomeLanding } from '@/hooks/useSignedOutWelcomeLanding';
import { AppProviders } from '@/providers/AppProviders';
import { useTheme } from '@/providers/ThemeProvider';
import { useAppSelector } from '@/store';

// Belt-and-suspenders with src/boot/preventSplashAutoHide (runs even earlier).
SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Prefer `/` (Welcome content) over any signed-out stack sibling. */
export const unstable_settings = {
  initialRouteName: 'index',
};

/**
 * While a route module is still loading, keep BrandSplash (logo + progress) instead of
 * Expo Router's default DEV "Bundling…" toast / blank production fallback.
 */
export function SuspenseFallback(_props: SuspenseFallbackProps) {
  return <BrandSplash />;
}

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

function hideNativeSplash() {
  SplashScreen.hideAsync().catch(() => undefined);
}

function RootNavigator() {
  const { ready } = useAppBootstrap();
  const theme = useTheme();
  const isAuthenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const locked = useAppSelector((state) => state.appLock.locked);
  const [fontsLoaded] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
    NotoSans_800ExtraBold,
  });
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  useAppLockLifecycle();
  useAppSwitcherPrivacy(isAuthenticated);
  useSignedOutWelcomeLanding(ready, isAuthenticated);
  useApplyPendingReferral();

  // Don't hold BrandSplash on slow font CDN — landing can paint with fallbacks, then swap.
  useEffect(() => {
    const timer = setTimeout(() => setFontsTimedOut(true), 700);
    return () => clearTimeout(timer);
  }, []);

  const fontsReady = fontsLoaded || fontsTimedOut;
  // Signed-out landing only needs session bootstrap; fonts can finish a beat later.
  const bootReady = ready && (fontsReady || !isAuthenticated);

  useEffect(() => {
    if (bootReady) {
      notifyPreviewSplashDone();
      // BrandSplash already requested hide onLayout; this covers the ready path if paint raced.
      hideNativeSplash();
    }
  }, [bootReady]);

  // Absolute cap only — normal path hides on BrandSplash onLayout (not a blind early timer).
  useEffect(() => {
    const timer = setTimeout(() => {
      hideNativeSplash();
    }, 12_000);
    return () => clearTimeout(timer);
  }, []);

  if (!bootReady) {
    // Preview iframe: parent overlay is the splash — avoid a second in-app splash.
    if (isWebPreviewFrame()) {
      return <View style={{ flex: 1, backgroundColor: '#081410' }} testID="boot-placeholder" />;
    }
    // Keep BrandSplash until session + design fonts are ready (avoids blank post-splash on APK).
    return (
      <View
        style={{ flex: 1, backgroundColor: '#081410' }}
        onLayout={() => {
          // Native splash can hide once BrandSplash has painted; stay on BrandSplash until bootReady.
          hideNativeSplash();
        }}
      >
        <BrandSplash />
      </View>
    );
  }

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        markUserActive();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        markUserActive();
        return false;
      }}
    >
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {/* Always first: design landing at `/`. */}
        <Stack.Screen name="index" />
        {/* Design UI artboards (Start*, Main, Change, Send, …) — change map. */}
        <Stack.Screen name="(design)" />
        <Stack.Protected guard={isAuthenticated}>
          {/* Legacy API-backed stacks kept for deep links / progressive wiring. */}
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
          <Stack.Screen name="loyalty" />
          <Stack.Screen name="promotions" />
          <Stack.Screen name="settings" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Screen name="view-rates" />
        <Stack.Screen name="support" />
        <Stack.Screen name="p2p-share/[id]" />
      </Stack>
      <OfflineBanner />
      {isAuthenticated ? <RequirePinSetup /> : null}
      {isAuthenticated ? <RequireNewDevicePin /> : null}
      {isAuthenticated ? <RequireSecurityQuestions /> : null}
      {isAuthenticated ? <RequireProfileSetup /> : null}
      {isAuthenticated ? <OfferBiometricUnlock /> : null}
      {isAuthenticated && locked ? <LockScreen /> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
