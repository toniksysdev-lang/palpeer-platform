import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, type Href } from 'expo-router';

import { maskEmail } from '@/features/auth/signupCountries';
import {
  isPinLocked,
  pinLockedMessage,
  securityErrorMessage,
} from '@/features/security/errors';
import { markDeviceVerifiedForSession } from '@/features/security/deviceSession';
import { accountCommands } from '@/services/auth/accountCommands';
import { authorizedRequest } from '@/services/api/authorized';
import { toAppError } from '@/services/api/errors';
import {
  buildRegistration,
  findThisDevice,
  getDeviceIdentifier,
} from '@/services/biometrics/deviceRegistration';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
} from '@/services/biometrics/biometrics';
import { securityCommands } from '@/services/security/securityCommands';
import { useAppSelector } from '@/store';
import type { PinStatusResponse } from '@/types/api/security';

type OkErr =
  | { ok: true; cooldownSec?: number; needsOtp?: boolean }
  | { ok: false; error?: string; needsOtp?: boolean };

/**
 * Live bridge for ConfirmPin (new-device) screen.
 * Face/Fingerprint or PIN first; if another device already owns the account
 * (`DEVICE_EXISTS`), email OTP then device takeover (one device at a time).
 */
export function useLiveConfirmPin() {
  const userId = useAppSelector((state) => state.session.userId);
  const email = useAppSelector((state) => state.session.email);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsOtp, setNeedsOtp] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(true);
  const [bioLabel, setBioLabel] = useState('Face or Fingerprint');

  const mailMask = useMemo(() => (email ? maskEmail(email) : 'your email'), [email]);

  useEffect(() => {
    let active = true;
    void getBiometricCapability().then((capability) => {
      if (!active) return;
      if (capability.status === 'available') {
        setBioAvailable(true);
        setBioLabel('Face or Fingerprint');
        return;
      }
      if (capability.status === 'notEnrolled') {
        setBioAvailable(false);
        setBioLabel(capability.label);
        return;
      }
      setBioAvailable(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const enterApp = useCallback((): OkErr => {
    if (!userId) return { ok: false, error: 'Sign in again to continue.' };
    markDeviceVerifiedForSession(userId);
    router.replace('/Main');
    return { ok: true };
  }, [userId]);

  // If we were sent here during first-time setup (no other trusted phone), leave automatically.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const identifier = await getDeviceIdentifier();
      const list = await securityCommands.listDevices();
      if (cancelled || !list.ok) return;
      const devices = list.data ?? [];
      const known = findThisDevice(devices, identifier);
      if (known?.enabled) {
        enterApp();
        return;
      }
      const otherTrusted = devices.some(
        (device) => device.enabled && device.deviceIdentifier !== identifier,
      );
      if (otherTrusted) return;
      if (!known) {
        const registration = await buildRegistration();
        await securityCommands.registerDevice(registration).catch(() => undefined);
      }
      if (!cancelled) enterApp();
    })();
    return () => {
      cancelled = true;
    };
  }, [enterApp, userId]);

  const beginEmailOtp = useCallback(async (): Promise<OkErr> => {
    setError(null);
    setBusy(true);
    try {
      const sent = await accountCommands.requestNewDeviceOtp();
      if (!sent.ok) {
        const msg = securityErrorMessage(sent.error);
        setError(msg);
        return { ok: false, error: msg };
      }
      setNeedsOtp(true);
      return { ok: true, needsOtp: true, cooldownSec: 45 };
    } catch (raw) {
      const msg = securityErrorMessage(toAppError(raw));
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setBusy(false);
    }
  }, []);

  const finishRegister = useCallback(async (): Promise<OkErr> => {
    if (!userId) return { ok: false, error: 'Sign in again to continue.' };
    try {
      const registration = await buildRegistration();
      const registered = await securityCommands.registerDevice(registration);
      if (!registered.ok) {
        if (registered.error.code === 'DEVICE_EXISTS') {
          return beginEmailOtp();
        }
        const msg = securityErrorMessage(registered.error);
        setError(msg);
        return { ok: false, error: msg };
      }
      return enterApp();
    } catch (raw) {
      const msg = securityErrorMessage(toAppError(raw));
      setError(msg);
      return { ok: false, error: msg };
    }
  }, [beginEmailOtp, enterApp, userId]);

  const onUnlockBio = useCallback(async (): Promise<OkErr> => {
    setError(null);
    setBusy(true);
    try {
      const result = await authenticateWithBiometrics("Confirm it's you");
      if (result !== 'success') {
        if (result === 'cancelled') return { ok: false };
        const msg =
          result === 'lockout'
            ? 'Too many tries. Use your PIN.'
            : result === 'unavailable'
              ? `${bioLabel} isn't available right now. Use your PIN.`
              : "We couldn't confirm it's you. Try again, or use your PIN.";
        setError(msg);
        return { ok: false, error: msg };
      }
      return finishRegister();
    } finally {
      setBusy(false);
    }
  }, [bioLabel, finishRegister]);

  const confirmPin = useCallback(
    async (pin: string): Promise<OkErr> => {
      setError(null);
      setBusy(true);
      try {
        const result = await securityCommands.verifyPin({ pin });
        if (!result.ok) {
          if (isPinLocked(result.error)) {
            const status = await authorizedRequest<PinStatusResponse>('/security/pin');
            const msg = pinLockedMessage(status.ok ? status.data.lockedUntil : null);
            setError(msg);
            return { ok: false, error: msg };
          }
          const msg = securityErrorMessage(result.error);
          setError(msg);
          return { ok: false, error: msg };
        }
        return finishRegister();
      } finally {
        setBusy(false);
      }
    },
    [finishRegister],
  );

  const onSendCode = useCallback(async (): Promise<OkErr> => {
    return beginEmailOtp();
  }, [beginEmailOtp]);

  const onVerifyCode = useCallback(
    async (code: string): Promise<OkErr> => {
      setError(null);
      setBusy(true);
      try {
        const verified = await accountCommands.verifyNewDeviceOtp(String(code || '').trim());
        if (!verified.ok) {
          const msg = securityErrorMessage(verified.error);
          setError(msg);
          return { ok: false, error: msg };
        }
        const registration = await buildRegistration();
        const taken = await securityCommands.takeoverDevice(registration);
        if (!taken.ok) {
          const msg = securityErrorMessage(taken.error);
          setError(msg);
          return { ok: false, error: msg };
        }
        setNeedsOtp(false);
        return enterApp();
      } finally {
        setBusy(false);
      }
    },
    [enterApp],
  );

  const goPinReset = useCallback(() => {
    router.push('/PinReset' as Href);
  }, []);

  const goHome = useCallback(() => {
    router.replace('/Main');
  }, []);

  return {
    backend: true as const,
    error,
    busy,
    needsOtp,
    mailMask,
    bioAvailable,
    bioLabel,
    clearError: () => setError(null),
    onUnlockBio,
    confirmPin,
    onSendCode,
    onVerifyCode,
    goPinReset,
    goHome,
  };
}
