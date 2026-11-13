import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { apiRequest, type ApiResult } from '@/services/api/client';
import type { DeviceResponse, RegisterDeviceRequest } from '@/types/api/security';
import { secureStorage } from '@/services/storage/secureStorage';

/**
 * Hardware-backed id that survives APK reinstall on the same phone (Android ID / iOS IDFV).
 * Web and unsupported platforms return null → fall back to a random install UUID.
 */
async function stableHardwareId(): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      const id = Application.getAndroidId();
      if (id && id.length > 0 && id.toLowerCase() !== 'unknown') return id;
      return null;
    }
    if (Platform.OS === 'ios') {
      const id = await Application.getIosIdForVendorAsync();
      return id && id.length > 0 ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Stable per-install identifier; survives sign-out so the backend sees one record per install. */
export async function getDeviceIdentifier(): Promise<string> {
  const existing = await secureStorage.getDeviceIdentifier();
  if (existing) return existing;
  const hardware = await stableHardwareId();
  // Prefix hardware ids so they never collide with plain UUIDs from older builds.
  const created = hardware ? `hw:${hardware}` : Crypto.randomUUID();
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
 * True when other enabled device(s) look like this same phone after reinstall
 * (new install id, same OS — accounts keep one trusted device at a time).
 */
export function isSamePhoneAsOthers(
  devices: readonly DeviceResponse[],
  identifier: string,
  platform: string | undefined,
  deviceName: string | undefined,
): boolean {
  const others = devices.filter((d) => d.enabled && d.deviceIdentifier !== identifier);
  if (others.length === 0) return true;
  const plat = (platform || '').trim().toLowerCase();
  const name = (deviceName || '').trim().toLowerCase();
  // One-device policy: a single other row on the same OS is almost always this handset
  // after uninstall/reinstall (secure storage wiped → new install id).
  if (others.length === 1) {
    const otherPlat = (others[0]?.platform || '').trim().toLowerCase();
    if (!plat || !otherPlat || plat === otherPlat) return true;
    return false;
  }
  return others.every((d) => {
    const otherPlat = (d.platform || '').trim().toLowerCase();
    const otherName = (d.deviceName || '').trim().toLowerCase();
    if (plat && otherPlat && plat !== otherPlat) return false;
    if (!name && !otherName) return true;
    return !!name && !!otherName && name === otherName;
  });
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
