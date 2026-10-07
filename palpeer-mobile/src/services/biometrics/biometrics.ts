import * as LocalAuthentication from 'expo-local-authentication';

import { logger } from '@/utils/logger';

export type BiometricCapability =
  | { status: 'available'; label: string }
  | { status: 'notEnrolled'; label: string }
  | { status: 'unsupported' };

export type BiometricResult = 'success' | 'cancelled' | 'lockout' | 'unavailable' | 'failed';

function labelFor(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
  return 'Biometrics';
}

/** What the device offers. Asking never shows a prompt. */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const [hasHardware, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hasHardware || types.length === 0) return { status: 'unsupported' };
    const label = labelFor(types);
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled ? { status: 'available', label } : { status: 'notEnrolled', label };
  } catch (error) {
    logger.warn('Biometric capability check failed', { error });
    return { status: 'unsupported' };
  }
}

/**
 * Device biometric prompt. Device-passcode fallback is disabled: the app's fallback is signing in
 * with the account password, so a device PIN never unlocks the app on its own.
 */
export async function authenticateWithBiometrics(promptMessage: string): Promise<BiometricResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: true,
    });
    if (result.success) return 'success';
    switch (result.error) {
      case 'user_cancel':
      case 'system_cancel':
      case 'app_cancel':
      case 'user_fallback':
        return 'cancelled';
      case 'lockout':
        return 'lockout';
      case 'not_available':
      case 'not_enrolled':
      case 'passcode_not_set':
        return 'unavailable';
      default:
        return 'failed';
    }
  } catch (error) {
    logger.warn('Biometric prompt failed', { error });
    return 'failed';
  }
}
