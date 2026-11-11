import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import {
  buildRegistration,
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
    pathname.includes('/StartMe') ||
    pathname.includes('/StartPhone') ||
    pathname.includes('/StartEmail') ||
    pathname.includes('/StartPass') ||
    pathname.includes('/StartName') ||
    pathname.includes('/security/pin') ||
    pathname.includes('/security/questions') ||
    pathname.includes('/PinReset')
  );
}

/**
 * When the user signs in on an install that is not a trusted device AND another phone already
 * owns this account, require Face/Fingerprint or PIN once before using the app — via ConfirmPin.
 *
 * First-time setup (no other trusted device yet) must not hit this screen.
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
  /** Only true after we know another enabled device owns the account. */
  const [takeoverRequired, setTakeoverRequired] = useState(false);

  const onConfirm = onConfirmPath(pathname);
  const onSetup = onSecuritySetupPath(pathname);
  const deferConfirm = onConfirm || onSetup;

  useEffect(() => {
    if (!authenticated) {
      clearDeviceVerifiedSession();
      redirected.current = false;
      checking.current = false;
      setTakeoverRequired(false);
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || locked || !userId) return;
    if (isDeviceVerifiedForSession(userId)) {
      setTakeoverRequired(false);
      return;
    }
    if (pinStatus.isLoading || pinStatus.isFetching || !pinStatus.data) return;
    // First-time PIN setup is handled by RequirePinSetup.
    if (!pinStatus.data.pinSet) {
      setTakeoverRequired(false);
      return;
    }
    // Stay on StartQuestions / PIN setup — do not yank users back to ConfirmPin.
    if (deferConfirm || redirected.current || checking.current) return;

    checking.current = true;
    let cancelled = false;
    (async () => {
      const identifier = await getDeviceIdentifier();
      const list = await securityCommands.listDevices();
      if (cancelled) return;
      if (!list.ok) {
        // Fail open — do not block first-time setup when the device list is unreachable.
        markDeviceVerifiedForSession(userId);
        setTakeoverRequired(false);
        checking.current = false;
        return;
      }

      const devices = list.data ?? [];
      const known = findThisDevice(devices, identifier);
      if (known?.enabled) {
        markDeviceVerifiedForSession(userId);
        setTakeoverRequired(false);
        checking.current = false;
        return;
      }

      const otherTrusted = devices.some(
        (device) => device.enabled && device.deviceIdentifier !== identifier,
      );

      // No other phone owns this account — first install / first-time setup.
      if (!otherTrusted) {
        markDeviceVerifiedForSession(userId);
        setTakeoverRequired(false);
        checking.current = false;
        // Best-effort register so later logins recognize this install.
        if (!known) {
          void buildRegistration()
            .then((registration) => securityCommands.registerDevice(registration))
            .catch(() => undefined);
        }
        return;
      }

      // Another trusted device exists and this install is not trusted → Confirm it's you.
      setTakeoverRequired(true);
      redirected.current = true;
      checking.current = false;
      router.replace(CONFIRM_PATH);
    })();

    return () => {
      cancelled = true;
      checking.current = false;
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
    !deferConfirm &&
    takeoverRequired;

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
