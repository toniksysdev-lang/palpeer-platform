import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import { appConfig } from '@/config/env';

export function appVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

export function platformLabel(): string {
  if (Platform.OS === 'ios') return 'iOS';
  if (Platform.OS === 'android') return 'Android';
  return Platform.OS;
}

/** "0.1.0 · Android" plus the environment outside production. No user data is included. */
export function appInfoLine(): string {
  return [
    appVersion() ?? 'unknown version',
    platformLabel(),
    appConfig.env === 'production' ? null : appConfig.env,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function supportMailto(email: string, subject: string): string {
  const body = `\n\n---\nApp: PALPEER ${appInfoLine()}\nPlease don't include your password, PIN, one-time codes or full card numbers.`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^+0-9]/g, '')}`;
}

/** Opens an external link (mail, phone, https) and reports whether the phone could handle it. */
export async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
