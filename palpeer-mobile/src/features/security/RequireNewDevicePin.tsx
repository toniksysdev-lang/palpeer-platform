import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import {
  findThisDevice,
  getDeviceIdentifier,
} from '@/services/biometrics/deviceRegistration';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppSelector } from '@/store';

import {
  clearDeviceVerifiedSession,
  isDeviceVerifiedForSession,
  markDeviceVerifiedForSession,
} from './deviceSession';

const CONFIRM_PATH = '/ConfirmPin';
const DESIGN_BG = '#F3F6F4';

function onConfirmPath(pathname: string | undefined): boolean {
  if (!pathname) return false;
  return pathname.includes('/ConfirmPin');
}

/** First-time PIN / security-questions / profile setup must not bounce to ConfirmPin. */
function onSecuritySetupPath(pathname: string | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.includes('/StartPinSet') ||
    pathname.includes('/StartPinAgain') ||
    pathname.includes('/StartBio') ||
    pathname.includes('/StartMethod') ||
    pathname.includes('/StartQuestions') ||
    pathname.includes('/StartDetails') ||
    pathname.includes('/security/pin') ||
    pathname.includes('/security/questions') ||
    pathname.includes('/PinReset')
  );
}

/**
 * When the user signs in on an install that is not yet a trusted device and they already have a
 * transaction PIN, require Face/Fingerprint or PIN once before using the app — via ConfirmPin.
 */
export function RequireNewDevicePin() {
  const theme = useTheme();
  const pathname = usePathname();
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const userId = useAppSelector((state) => state.session.userId);
  const locked = useAppSelector((state) => state.appLock.locked);
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const redirected = useRef(false);
  const checking = useRef(false);

  const onConfirm = onConfirmPath(pathname);
  const onSetup = onSecuritySetupPath(pathname);
  const deferConfirm = onConfirm || onSetup;

  useEffect(() => {
    if (!authenticated) {
      clearDeviceVerifiedSession();
      redirected.current = false;
      checking.current = false;
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || locked || !userId) return;
    if (isDeviceVerifiedForSession(userId)) return;
    if (pinStatus.isLoading || pinStatus.isFetching || !pinStatus.data) return;
    // First-time PIN setup is handled by RequirePinSetup.
    if (!pinStatus.data.pinSet) return;
    // Stay on StartQuestions / PIN setup — do not yank users back to ConfirmPin.
    if (deferConfirm || redirected.current || checking.current) return;

    checking.current = true;
    let cancelled = false;
    (async () => {
      const identifier = await getDeviceIdentifier();
      const list = await securityCommands.listDevices();
      if (cancelled) return;
      if (!list.ok) {
        markDeviceVerifiedForSession(userId);
        checking.current = false;
        return;
      }
      const known = findThisDevice(list.data ?? [], identifier);
      if (known?.enabled) {
        markDeviceVerifiedForSession(userId);
        checking.current = false;
        return;
      }
      redirected.current = true;
      checking.current = false;
      router.replace(CONFIRM_PATH);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authenticated,
    locked,
    userId,
    deferConfirm,
    pinStatus.data,
    pinStatus.isFetching,
    pinStatus.isLoading,
  ]);

  const needsGate =
    authenticated &&
    !locked &&
    !!userId &&
    !isDeviceVerifiedForSession(userId) &&
    !!pinStatus.data?.pinSet &&
    !deferConfirm;

  if (!needsGate) return null;

  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, { backgroundColor: DESIGN_BG }]}
      accessibilityViewIsModal
      testID="require-new-device-pin-gate"
    >
      <View style={[styles.body, { padding: theme.spacing.xxl, gap: theme.spacing.lg }]}>
        <AppText
          align="center"
          accessibilityRole="header"
          style={{ fontSize: 30, fontWeight: '800', color: '#0E1F19', lineHeight: 34 }}
        >
          Confirm it&apos;s you
        </AppText>
        <AppText
          align="center"
          style={{ fontSize: 18, fontWeight: '600', color: '#33453D', lineHeight: 24 }}
        >
          This looks like a new device. Only one device can stay signed in. Unlock with Face or Fingerprint or your PIN — if another phone already owns this account, we will email a code to continue.
        </AppText>
        {pinStatus.isLoading || pinStatus.isFetching || checking.current ? (
          <ActivityIndicator color="#0B6E4F" />
        ) : (
          <Button
            label="Continue"
            shape="pill"
            onPress={() => {
              redirected.current = true;
              router.replace(CONFIRM_PATH);
            }}
            testID="require-new-device-pin-continue"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
