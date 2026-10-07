import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { apiRequest, type ApiResult } from '@/services/api/client';
import type { DeviceResponse, RegisterDeviceRequest } from '@/types/api/security';
import { secureStorage } from '@/services/storage/secureStorage';

/** Stable per-install identifier; survives sign-out so the backend sees one record per install. */
export async function getDeviceIdentifier(): Promise<string> {
  const existing = await secureStorage.getDeviceIdentifier();
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await secureStorage.setDeviceIdentifier(created);
  return created;
}

/**
 * The backend requires an opaque `biometricCredential` but never uses it to authenticate
 * (CONTRACT_PENDING: biometric login). A fresh random value is sent and not kept on the device.
 */
export async function buildRegistration(): Promise<RegisterDeviceRequest> {
  const name = Device.deviceName ?? Device.modelName ?? undefined;
  return {
    deviceIdentifier: await getDeviceIdentifier(),
    platform: Platform.OS,
    deviceName: name ? name.slice(0, 120) : undefined,
    biometricCredential: `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, ''),
  };
}

export function findThisDevice(
  devices: readonly DeviceResponse[],
  identifier: string,
): DeviceResponse | undefined {
  return devices.find((device) => device.deviceIdentifier === identifier);
}

/**
 * Best-effort removal of this install's device record with an explicit token (no refresh), used
 * while signing out. Failures are ignored; the record stays visible in the device list.
 */
export async function removeThisDeviceWithToken(accessToken: string | null): Promise<void> {
  if (!accessToken) return;
  const identifier = await secureStorage.getDeviceIdentifier();
  if (!identifier) return;
  const list: ApiResult<DeviceResponse[]> = await apiRequest('/security/devices', { accessToken });
  if (!list.ok) return;
  const device = findThisDevice(list.data ?? [], identifier);
  if (!device) return;
  await apiRequest(`/security/devices/${encodeURIComponent(device.id)}`, {
    method: 'DELETE',
    accessToken,
  });
}
