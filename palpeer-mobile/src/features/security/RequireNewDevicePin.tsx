import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
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
import { usePinPrompt } from './PinPromptProvider';

/**
 * When the user signs in on an install that is not yet a trusted device and they already have a
 * transaction PIN, require PIN verification once before using the app.
 */
export function RequireNewDevicePin() {
  const theme = useTheme();
  const toast = useToast();
  const { requestPin } = usePinPrompt();
  const authenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const userId = useAppSelector((state) => state.session.userId);
  const locked = useAppSelector((state) => state.appLock.locked);
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const [blocking, setBlocking] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!authenticated) {
      clearDeviceVerifiedSession();
      autoStarted.current = false;
      setBlocking(false);
    }
  }, [authenticated]);

  const completeVerification = useCallback(
    async (uid: string) => {
      const registration = await buildRegistration();
      await securityCommands.registerDevice(registration);
      markDeviceVerifiedForSession(uid);
      setBlocking(false);
    },
    [],
  );

  const promptForPin = useCallback(async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const ok = await requestPin({
        title: 'Confirm it’s you',
        message: 'This looks like a new device. Enter your transaction PIN to continue.',
      });
      if (!ok) {
        toast.show({
          type: 'warning',
          title: 'PIN required',
          message: 'Enter your PIN to use Palpeer on this device.',
        });
        return;
      }
      await completeVerification(userId);
    } finally {
      setBusy(false);
    }
  }, [busy, completeVerification, requestPin, toast, userId]);

  useEffect(() => {
    if (!authenticated || locked || !userId) return;
    if (isDeviceVerifiedForSession(userId)) {
      setBlocking(false);
      return;
    }
    if (pinStatus.isLoading || pinStatus.isFetching || !pinStatus.data) return;
    // First-time PIN setup is handled by RequirePinSetup.
    if (!pinStatus.data.pinSet) {
      setBlocking(false);
      return;
    }
    if (autoStarted.current) return;
    autoStarted.current = true;

    let cancelled = false;
    (async () => {
      const identifier = await getDeviceIdentifier();
      const list = await securityCommands.listDevices();
      if (cancelled) return;
      if (!list.ok) {
        markDeviceVerifiedForSession(userId);
        setBlocking(false);
        return;
      }
      const known = findThisDevice(list.data ?? [], identifier);
      if (known?.enabled) {
        markDeviceVerifiedForSession(userId);
        setBlocking(false);
        return;
      }
      setBlocking(true);
      await promptForPin();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authenticated,
    locked,
    userId,
    pinStatus.data,
    pinStatus.isFetching,
    pinStatus.isLoading,
    promptForPin,
  ]);

  if (!blocking) return null;

  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]}
      accessibilityViewIsModal
      testID="require-new-device-pin-gate"
    >
      <View style={[styles.body, { padding: theme.spacing.xxl, gap: theme.spacing.lg }]}>
        <AppText variant="h3" align="center">
          New device
        </AppText>
        <AppText tone="secondary" align="center">
          Enter your transaction PIN to confirm it&apos;s you on this device.
        </AppText>
        {busy ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <Button
            label="Enter PIN"
            shape="pill"
            onPress={() => void promptForPin()}
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
