import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';
import { getDeviceIdentifier } from '@/services/biometrics/deviceRegistration';
import { secureStorage } from '@/services/storage/secureStorage';
import type {
  DeviceTokenPlatform,
  DeviceTokenResponse,
  RegisterDeviceTokenRequest,
} from '@/types/api/notification';
import { logger } from '@/utils/logger';

export type PushPermission = 'granted' | 'denied' | 'undetermined';

export type PushPermissionState = { status: PushPermission; canAskAgain: boolean };

export class PushUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PushUnavailableError';
  }
}

/** Must match `defaultChannel` in app.config.ts expo-notifications plugin. */
export const ANDROID_CHANNEL_ID = 'palpeer_default';

/**
 * While the app is open a push is not shown as a system banner; the app shows its own toast and
 * refreshes the notification center instead. It is still added to the system list.
 */
export function configureForegroundPresentation() {
  // expo-notifications has limited/no web support; skip so web preview doesn't throw at import.
  if (Platform.OS === 'web') return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Builds without push credentials must still launch.
  }
}

function toState(response: Notifications.NotificationPermissionsStatus): PushPermissionState {
  const status: PushPermission = response.granted
    ? 'granted'
    : response.status === 'denied'
      ? 'denied'
      : 'undetermined';
  return { status, canAskAgain: response.canAskAgain };
}

export async function getPushPermission(): Promise<PushPermissionState> {
  return toState(await Notifications.getPermissionsAsync());
}

/** Only called from an explicit user action (R-NT-2), never at launch. */
export async function requestPushPermission(): Promise<PushPermissionState> {
  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return toState(await Notifications.requestPermissionsAsync());
}

function platform(): DeviceTokenPlatform {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'OTHER';
}

/** EAS project id from the binary / Expo config (required for Expo push tokens). */
export function resolveEasProjectId(): string | undefined {
  const fromEas = Constants.easConfig?.projectId;
  if (typeof fromEas === 'string' && fromEas.trim()) return fromEas.trim();
  const fromExtra = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();
  return undefined;
}

/**
 * Resolves a push token for backend registration.
 *
 * Prefer an Expo push token — the API routes `ExponentPushToken[…]` via Expo Push (works without
 * client-side Firebase). Fall back to the native FCM/APNs token when Expo is unavailable but the
 * binary has Google/Apple push credentials.
 */
async function resolvePushToken(): Promise<string> {
  if (Platform.OS === 'web') {
    throw new PushUnavailableError("Push notifications aren't available on web.");
  }
  if (Device.isDevice === false) {
    throw new PushUnavailableError('Push notifications need a physical device.');
  }

  const projectId = resolveEasProjectId();
  let lastError: unknown;

  if (projectId) {
    try {
      const expo = await Notifications.getExpoPushTokenAsync({ projectId });
      if (typeof expo.data === 'string' && expo.data.trim()) {
        return expo.data.trim();
      }
    } catch (error) {
      lastError = error;
      logger.warn('Expo push token unavailable; trying native device token', { error });
    }
  } else {
    logger.warn('EAS projectId missing from app config; Expo push tokens unavailable');
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    if (typeof token.data === 'string' && token.data.trim()) {
      return token.data.trim();
    }
    throw new PushUnavailableError("Push notifications aren't available on this device.");
  } catch (error) {
    if (error instanceof PushUnavailableError) throw error;
    lastError = error;
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? '');
  logger.warn('Push token resolution failed', { detail, projectId: projectId ?? null });
  if (/FirebaseApp is not initialized|google.?services|FCM|APNs|aps-environment/i.test(detail)) {
    throw new PushUnavailableError(
      projectId
        ? "Couldn't enable push on this install. Try again, or reinstall a build that includes notification credentials."
        : "Push notifications aren't configured for this build.",
    );
  }
  throw new PushUnavailableError(
    "Push notifications aren't available in this version of the app.",
  );
}

export async function buildPushRegistration(token?: string): Promise<RegisterDeviceTokenRequest> {
  return {
    token: token ?? (await resolvePushToken()),
    platform: platform(),
    deviceIdentifier: await getDeviceIdentifier(),
  };
}

/** Remembers which backend record belongs to this install so it can be removed later. */
export function rememberPushRecord(record: DeviceTokenResponse | null): Promise<void> {
  return secureStorage.setPushTokenId(record?.id ?? null);
}

export function getRememberedPushRecordId(): Promise<string | null> {
  return secureStorage.getPushTokenId();
}

/**
 * Best-effort removal of this install's push registration with an explicit token (no refresh),
 * used while signing out so the next person on this phone doesn't get the previous user's pushes.
 */
export async function removePushRegistrationWithToken(accessToken: string | null): Promise<void> {
  const id = await secureStorage.getPushTokenId();
  if (!id) return;
  await secureStorage.setPushTokenId(null);
  if (!accessToken) return;
  await apiRequest(`/notifications/device-tokens/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    accessToken,
  });
}
