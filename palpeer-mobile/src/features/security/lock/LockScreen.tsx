import { LockKeyhole } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SIMPLE_HOME as D } from '@/design/simpleHomeTokens';
import { useToast } from '@/providers/ToastProvider';
import { baseApi } from '@/services/api/baseApi';
import { authorizedRequest } from '@/services/api/authorized';
import { sessionManager } from '@/services/auth/session';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
} from '@/services/biometrics/biometrics';
import { securityCommands } from '@/services/security/securityCommands';
import { secureStorage } from '@/services/storage/secureStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { appUnlocked } from '@/store/slices/appLockSlice';
import type { PinStatusResponse } from '@/types/api/security';

import { PinEntry } from '../components/PinEntry';
import { checkDeviceTrust } from '../biometricUnlock';
import { isPinLocked, pinLockedMessage, securityErrorMessage } from '../errors';

type Mode = 'choose' | 'pin';

/**
 * Design Timeout overlay — shown after inactivity (or a long background trip).
 * Unlock with Face/Fingerprint (when enabled) or PIN; “Log in again” parks on Login.
 */
export function LockScreen() {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const biometricEnabled = useAppSelector((state) => state.appLock.biometricEnabled);
  const [label, setLabel] = useState('Face or Fingerprint');
  const [mode, setMode] = useState<Mode>('choose');
  const [busy, setBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pinBlocked, setPinBlocked] = useState(false);
  const autoPrompted = useRef(false);

  const logInAgain = useCallback(async () => {
    setBusy(true);
    // Keep the refresh token + biometric binding so Login can offer fingerprint sign-in.
    await sessionManager.dismissToLogin();
  }, []);

  const finishUnlock = useCallback(() => {
    setBusy(false);
    setPinBusy(false);
    dispatch(appUnlocked());
  }, [dispatch]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricEnabled) return;
    setBusy(true);
    setMessage(null);
    const result = await authenticateWithBiometrics('Unlock PALPEER');
    if (result !== 'success') {
      setBusy(false);
      if (result === 'lockout') {
        setMessage('Too many tries. Use your PIN, or tap Log in again.');
      } else if (result === 'unavailable') {
        setMessage(`${label} isn't available right now. Use your PIN, or tap Log in again.`);
      } else if (result === 'failed') {
        setMessage("We couldn't confirm it's you. Try again, use your PIN, or log in again.");
      }
      // cancelled: stay quiet, user can pick PIN
      return;
    }
    const trust = await checkDeviceTrust();
    if (trust === 'revoked') {
      await secureStorage.setBiometricUserId(null);
      toast.show({
        type: 'warning',
        title: 'Biometric unlock was turned off for this device',
        message: 'Sign in with your password to continue.',
      });
      await sessionManager.signOut();
      return;
    }
    finishUnlock();
  }, [biometricEnabled, finishUnlock, label, toast]);

  const unlockWithPin = useCallback(
    async (pin: string) => {
      if (pinBusy || pinBlocked) return;
      setPinBusy(true);
      setMessage(null);
      const result = await securityCommands.verifyPin({ pin });
      if (result.ok) {
        finishUnlock();
        return;
      }
      setPinBusy(false);
      if (isPinLocked(result.error)) {
        dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
        setPinBlocked(true);
        const status = await authorizedRequest<PinStatusResponse>('/security/pin');
        setMessage(pinLockedMessage(status.ok ? status.data.lockedUntil : null));
        return;
      }
      setMessage(securityErrorMessage(result.error));
    },
    [dispatch, finishUnlock, pinBlocked, pinBusy],
  );

  useEffect(() => {
    let active = true;
    void getBiometricCapability().then((capability) => {
      if (!active) return;
      if (capability.status !== 'unsupported') {
        setLabel(capability.label);
      }
      if (biometricEnabled && !autoPrompted.current) {
        autoPrompted.current = true;
        void unlockWithBiometrics();
      }
    });
    return () => {
      active = false;
    };
  }, [biometricEnabled, unlockWithBiometrics]);

  if (mode === 'pin') {
    return (
      <SafeAreaView
        style={[StyleSheet.absoluteFill, styles.safe]}
        accessibilityViewIsModal
        testID="lock-screen-pin"
      >
        <View style={styles.pinBody}>
          <PinEntry
            title="Enter my PIN"
            subtitle="Use your 4 numbers to open the app again."
            error={message}
            loading={pinBusy}
            loadingLabel="Opening…"
            disabled={pinBlocked}
            autoSubmit
            submitLabel="Open"
            onSubmit={(pin) => void unlockWithPin(pin)}
            testID="lock-pin-entry"
            footer={
              <View style={styles.pinFooter}>
                {biometricEnabled ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Unlock with ${label}`}
                    disabled={busy || pinBusy}
                    onPress={() => {
                      setMode('choose');
                      setMessage(null);
                      void unlockWithBiometrics();
                    }}
                    testID="lock-pin-use-bio"
                    style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.linkBtnLabel}>{`Use ${label}`}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  disabled={pinBusy}
                  onPress={() => {
                    setMode('choose');
                    setMessage(null);
                  }}
                  testID="lock-pin-back"
                  style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.linkBtnLabel}>Back</Text>
                </Pressable>
              </View>
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[StyleSheet.absoluteFill, styles.safe]}
      accessibilityViewIsModal
      testID="lock-screen"
    >
      <View style={styles.body}>
        <View style={styles.iconCircle} accessibilityElementsHidden>
          <LockKeyhole color={D.white} size={52} strokeWidth={2.4} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          You were logged out
        </Text>
        <Text style={styles.subtitle}>
          No use for 3 minutes. This keeps your money safe.
        </Text>
        {message ? (
          <Text style={styles.message} testID="lock-message" accessibilityRole="alert">
            {message}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        {biometricEnabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Unlock with ${label}`}
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void unlockWithBiometrics()}
            testID="lock-unlock"
            style={({ pressed }) => [
              styles.outlineBtn,
              busy && styles.btnDisabled,
              pressed && !busy && styles.pressed,
            ]}
          >
            <Text style={styles.outlineBtnLabel}>
              {busy ? 'Checking…' : `Unlock with ${label}`}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my PIN"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => {
            setMessage(null);
            setMode('pin');
          }}
          testID="lock-use-pin"
          style={({ pressed }) => [
            biometricEnabled ? styles.outlineBtn : styles.primaryBtn,
            busy && styles.btnDisabled,
            pressed && !busy && styles.pressed,
          ]}
        >
          <Text style={biometricEnabled ? styles.outlineBtnLabel : styles.primaryBtnLabel}>
            Use my PIN
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Log in again"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => void logInAgain()}
          testID="lock-use-password"
          style={({ pressed }) => [
            styles.secondaryBtn,
            busy && styles.btnDisabled,
            pressed && !busy && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryBtnLabel}>Log in again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: D.page,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  pinBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  pinFooter: {
    gap: 8,
    alignItems: 'center',
    paddingBottom: 8,
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: D.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 30,
    fontWeight: '800',
    color: D.ink,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 18,
    fontWeight: '600',
    color: D.secondary,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  message: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 16,
    fontWeight: '700',
    color: D.danger,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
  },
  primaryBtn: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: D.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  outlineBtn: {
    minHeight: 60,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: D.green,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryBtn: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  linkBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.88 },
  primaryBtnLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 22,
    fontWeight: '800',
    color: D.white,
  },
  outlineBtnLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 18,
    fontWeight: '800',
    color: D.green,
  },
  secondaryBtnLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '700',
    color: D.secondary,
    textDecorationLine: 'underline',
  },
  linkBtnLabel: {
    fontFamily: Platform.select({ web: D.font, default: undefined }),
    fontSize: 17,
    fontWeight: '700',
    color: D.green,
  },
});
