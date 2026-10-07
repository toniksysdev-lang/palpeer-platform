import type { AppError } from '@/services/api/errors';
import { authenticateWithBiometrics, type BiometricResult } from '@/services/biometrics/biometrics';
import {
  buildRegistration,
  findThisDevice,
  getDeviceIdentifier,
} from '@/services/biometrics/deviceRegistration';
import { securityCommands } from '@/services/security/securityCommands';
import { secureStorage } from '@/services/storage/secureStorage';

export type EnableOutcome =
  | { status: 'enabled' }
  | { status: 'biometric'; result: Exclude<BiometricResult, 'success'> }
  | { status: 'error'; error: AppError };

/**
 * Turns on biometric unlock: confirm with the device biometric, register this install with
 * POST /security/devices (replacing a stale record with the same identifier), then bind the
 * setting to the signed-in user.
 */
export async function enableBiometricUnlock(userId: string, label: string): Promise<EnableOutcome> {
  const check = await authenticateWithBiometrics(`Confirm to turn on ${label} unlock`);
  if (check !== 'success') return { status: 'biometric', result: check };

  const registration = await buildRegistration();
  let result = await securityCommands.registerDevice(registration);
  if (!result.ok && result.error.code === 'DEVICE_EXISTS') {
    const list = await securityCommands.listDevices();
    if (!list.ok) return { status: 'error', error: list.error };
    const stale = findThisDevice(list.data ?? [], registration.deviceIdentifier);
    if (stale) {
      const removed = await securityCommands.deleteDevice(stale.id);
      if (!removed.ok) return { status: 'error', error: removed.error };
    }
    result = await securityCommands.registerDevice(registration);
  }
  if (!result.ok) return { status: 'error', error: result.error };

  await secureStorage.setBiometricUserId(userId);
  return { status: 'enabled' };
}

/** Turns off biometric unlock and removes this install's device record. */
export async function disableBiometricUnlock(): Promise<
  { ok: true } | { ok: false; error: AppError }
> {
  const identifier = await getDeviceIdentifier();
  const list = await securityCommands.listDevices();
  if (!list.ok) return { ok: false, error: list.error };
  const device = findThisDevice(list.data ?? [], identifier);
  if (device) {
    const removed = await securityCommands.deleteDevice(device.id);
    if (!removed.ok && removed.error.kind !== 'notFound')
      return { ok: false, error: removed.error };
  }
  await secureStorage.setBiometricUserId(null);
  return { ok: true };
}

export type DeviceTrust = 'trusted' | 'revoked' | 'unknown';

/**
 * After a successful biometric check: is this install still registered and enabled? A device
 * disabled or removed from another session must not unlock with biometrics. When the server
 * can't be reached the answer is 'unknown' and the unlock proceeds (the session itself is
 * still validated by every API call).
 */
export async function checkDeviceTrust(): Promise<DeviceTrust> {
  const identifier = await secureStorage.getDeviceIdentifier();
  if (!identifier) return 'revoked';
  const list = await securityCommands.listDevices();
  if (!list.ok) return 'unknown';
  const device = findThisDevice(list.data ?? [], identifier);
  return device?.enabled ? 'trusted' : 'revoked';
}
