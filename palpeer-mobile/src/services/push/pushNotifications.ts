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

/**
 * Must match `defaultChannel` in app.config.ts and backend FCM/Expo `channelId`.
 * New id (not `palpeer_default`) so upgrades get HIGH importance — Android won't raise an
 * existing channel's importance after it was created as DEFAULT.
 */
export const ANDROID_CHANNEL_ID = 'palpeer_alerts';

/**
 * Ensures the Android alert channel exists with heads-up importance (sound + vibrate).
 * Safe to call repeatedly; required before FCM can pop the system notification UI.
 */
export async function ensureAndroidAlertChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Use the phone's notification UI (banner + sound) even while the app is open; background and
 * killed delivery still rely on FCM + the high-importance Android channel.
 */
export function configureForegroundPresentation() {
  // expo-notifications has limited/no web support; skip so web preview doesn't throw at import.
  if (Platform.OS === 'web') return;
  try {
    void ensureAndroidAlertChannel();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
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
  // Android 13+ only shows the permission prompt once a channel exists.
  await ensureAndroidAlertChannel();
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

/** Expo Push API tokens — delivered by the backend via exp.host (not Firebase Admin). */
export function isExpoPushToken(token: string): boolean {
  const t = token.trim();
  return t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');
}

/**
 * Raw APNs device tokens are hex (often 64 chars). Our API delivers native tokens only via FCM
 * Admin, which rejects APNs hex — registering them just disables the row after every push.
 */
export function isRawApnsDeviceToken(token: string): boolean {
  const t = token.trim().replace(/\s+/g, '');
  return /^[0-9a-fA-F]{64}$/.test(t) || /^[0-9a-fA-F]{8}([0-9a-fA-F]{8}){7}$/.test(t);
}

/** True when the backend can deliver this token (Expo Push API or Android FCM). */
export function isDeliverablePushToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (isExpoPushToken(t)) return true;
  // Never treat raw APNs as deliverable — FCM Admin returns INVALID_ARGUMENT.
  if (isRawApnsDeviceToken(t)) return false;
  // Native FCM registration tokens are opaque strings (typically 100+ chars; allow shorter).
  return t.length >= 32;
}

function missingFirebaseCredentials(detail: string): boolean {
  // Match real missing-plugin errors only — not every Expo message that mentions "FCM"/"APNs".
  return /FirebaseApp is not initialized|Default FirebaseApp|google.?services|GOOGLE_SERVICES|FirebaseApp\.initializeApp/i.test(
    detail,
  );
}

/**
 * Resolves a push token the backend can actually deliver.
 *
 * Android: native FCM first (Firebase Admin on the API), then Expo Push token.
 * iOS: Expo only — never register raw APNs hex (FCM Admin rejects it).
 */
async function resolvePushToken(): Promise<string> {
  if (Platform.OS === 'web') {
    throw new PushUnavailableError("Push notifications aren't available on web.");
  }
  if (Device.isDevice === false) {
    throw new PushUnavailableError('Push notifications need a physical device.');
  }

  const projectId = resolveEasProjectId();
  const errors: string[] = [];

  // Android: prefer native FCM — works whenever google-services.json is in the binary, even if
  // Expo's FCM credentials for getExpoPushTokenAsync are missing/misconfigured.
  if (Platform.OS === 'android') {
    try {
      const token = await Notifications.getDevicePushTokenAsync();
      if (typeof token.data === 'string' && isDeliverablePushToken(token.data)) {
        return token.data.trim();
      }
      errors.push('Native device push token response was empty or not an FCM token');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Native: ${message}`);
      logger.warn('Native FCM token unavailable; trying Expo push token', { error });
    }
  }

  if (projectId) {
    try {
      const expo = await Notifications.getExpoPushTokenAsync({ projectId });
      if (typeof expo.data === 'string' && expo.data.trim()) {
        return expo.data.trim();
      }
      errors.push('Expo push token response was empty');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Expo: ${message}`);
      logger.warn('Expo push token unavailable', { error });
    }
  } else {
    errors.push('EAS projectId missing from app config');
    logger.warn('EAS projectId missing from app config; Expo push tokens unavailable');
  }

  const detail = errors.join(' | ');
  logger.warn('Push token resolution failed', { detail, projectId: projectId ?? null });
  if (missingFirebaseCredentials(detail)) {
    throw new PushUnavailableError(
      Platform.OS === 'android'
        ? "Couldn't enable push on this install. Update to a PALPEER build that includes Firebase (google-services), then try again."
        : "Couldn't enable push on this install. Use a build with push credentials configured, then try again.",
    );
  }
  if (Platform.OS === 'ios') {
    throw new PushUnavailableError(
      "Couldn't enable push on this iPhone yet. Install an updated PALPEER build, then turn push on again.",
    );
  }
  throw new PushUnavailableError(
    "Push notifications aren't available in this version of the app.",
  );
}

export async function buildPushRegistration(token?: string): Promise<RegisterDeviceTokenRequest> {
  // OS token listeners often emit raw APNs/FCM blobs — only keep ones we can deliver; otherwise
  // resolve a proper Expo/FCM token instead of uploading a token the API will disable.
  const candidate = typeof token === 'string' ? token.trim() : '';
  const resolved =
    candidate && isDeliverablePushToken(candidate) ? candidate : await resolvePushToken();
  return {
    token: resolved,
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
