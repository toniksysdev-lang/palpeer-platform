import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';

import { PinStep } from '@/newui/features/PinStep';
import { useC } from '@/newui/lib/theme';
import { Btn, Circle, H1, Screen, Txt } from '@/newui/ui/kit';
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

import { checkDeviceTrust } from '../biometricUnlock';
import { isPinLocked, pinLockedMessage, securityErrorMessage } from '../errors';

type Mode = 'choose' | 'pin';

/**
 * Design Timeout overlay — shown after inactivity (or a long background trip).
 * Unlock with Face/Fingerprint (when enabled) or PIN; “Log in again” parks on Login.
 * Uses the same newui kit as the rest of the mobile app.
 */
export function LockScreen() {
  const c = useC();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const biometricEnabled = useAppSelector((state) => state.appLock.biometricEnabled);
  const [label, setLabel] = useState('Face or Fingerprint');
  const [mode, setMode] = useState<Mode>('choose');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pinBlocked, setPinBlocked] = useState(false);
  const autoPrompted = useRef(false);

  const showBio = biometricEnabled;

  const logInAgain = useCallback(async () => {
    setBusy(true);
    await sessionManager.dismissToLogin();
  }, []);

  const finishUnlock = useCallback(() => {
    setBusy(false);
    dispatch(appUnlocked());
  }, [dispatch]);

  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricEnabled) return;
    setBusy(true);
    setMessage(null);
    const result = await authenticateWithBiometrics('Unlock Palpeer');
    if (result !== 'success') {
      setBusy(false);
      if (result === 'lockout') {
        setMessage('Too many tries. Use your PIN, or tap Log in again.');
      } else if (result === 'unavailable') {
        setMessage(`${label} isn't available right now. Use your PIN, or tap Log in again.`);
      } else if (result === 'failed') {
        setMessage("We couldn't confirm it's you. Try again, use your PIN, or log in again.");
      }
      return;
    }
    if (biometricEnabled) {
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
    }
    finishUnlock();
  }, [biometricEnabled, finishUnlock, label, toast]);

  useEffect(() => {
    let active = true;
    void getBiometricCapability().then((capability) => {
      if (!active) return;
      if (capability.status !== 'unsupported') {
        setLabel(capability.label === 'Face ID or Fingerprint' ? 'Face or Fingerprint' : capability.label);
      }
      if (biometricEnabled && capability.status === 'available' && !autoPrompted.current) {
        autoPrompted.current = true;
        void unlockWithBiometrics();
      }
    });
    return () => {
      active = false;
    };
  }, [biometricEnabled, unlockWithBiometrics]);

  return (
    <Modal visible animationType="fade" onRequestClose={() => {}} testID="lock-screen">
      {mode === 'pin' ? (
        <PinStep
          title="Enter your PIN"
          onBack={() => {
            setMode('choose');
            setMessage(null);
          }}
          onDone={() => finishUnlock()}
          confirmPin={async (pin) => {
            if (pinBlocked) return false;
            setMessage(null);
            const result = await securityCommands.verifyPin({ pin });
            if (result.ok) return true;
            if (isPinLocked(result.error)) {
              dispatch(baseApi.util.invalidateTags([{ type: 'Security', id: 'PIN' }]));
              setPinBlocked(true);
              const status = await authorizedRequest<PinStatusResponse>('/security/pin');
              setMessage(pinLockedMessage(status.ok ? status.data.lockedUntil : null));
              return false;
            }
            setMessage(securityErrorMessage(result.error));
            return false;
          }}
          confirmBiometric={
            showBio
              ? async () => {
                  const result = await authenticateWithBiometrics('Unlock Palpeer');
                  return result === 'success';
                }
              : undefined
          }
        />
      ) : (
        <Screen gap={14}>
          <View style={{ alignItems: 'center', gap: 12, marginTop: 14 }}>
            <Circle icon="lock" size={92} iconSize={52} bg="#0E1F19" />
            <H1 center>You were logged out</H1>
            {message ? (
              <Txt size={16} w="700" color="red" role="alert">
                {message}
              </Txt>
            ) : null}
          </View>
          <View style={{ flex: 1 }} />
          {showBio ? (
            <Btn
              kind="outline"
              size="mid"
              label={busy ? 'Checking…' : `Unlock with ${label}`}
              busy={busy}
              disabled={busy}
              onPress={() => void unlockWithBiometrics()}
              testID="lock-unlock"
            />
          ) : null}
          <Btn
            kind="outline"
            size="mid"
            label="Use my PIN"
            disabled={busy}
            onPress={() => {
              setMessage(null);
              setMode('pin');
            }}
            testID="lock-use-pin"
            style={{ borderColor: c.brandText }}
          />
          <Btn
            kind="link"
            label="Log in again"
            disabled={busy}
            style={{ alignSelf: 'center' }}
            onPress={() => void logInAgain()}
            testID="lock-use-password"
          />
        </Screen>
      )}
    </Modal>
  );
}
