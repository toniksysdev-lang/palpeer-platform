import { requireOptionalNativeModule } from 'expo-modules-core';

import { appConfig } from '@/config/env';

/** True when env client IDs are set. */
export function isGoogleSignInConfigured(): boolean {
  return Boolean(appConfig.google.webClientId);
}

/**
 * expo-web-browser must be linked in the native binary. Debug APKs built before the
 * dependency was added throw "Cannot find native module 'ExpoWebBrowser'" on import.
 */
export function isGoogleNativeAvailable(): boolean {
  return requireOptionalNativeModule('ExpoWebBrowser') != null;
}

export function canUseGoogleSignIn(): boolean {
  return isGoogleSignInConfigured() && isGoogleNativeAvailable();
}
