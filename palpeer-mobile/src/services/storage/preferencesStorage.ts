import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppearancePreference, PreferencesState } from '@/store/slices/preferencesSlice';
import { logger } from '@/utils/logger';

/** Non-sensitive UI preferences only. Tokens and identity live in secureStorage. */
const KEYS = {
  appearance: 'palpeer.pref.appearance',
  onboardingSeen: 'palpeer.pref.onboardingSeen',
  biometricUnlockPrompted: 'palpeer.pref.biometricUnlockPrompted',
  /** ISO2 chosen on phone signup — seeds Complete profile Country. */
  signupCountryIso2: 'palpeer.pref.signupCountryIso2',
  /**
   * Explicit opt-out for "Push notifications on this phone".
   * Unset = prefer ON (default). 'true' = user turned the switch off.
   */
  pushOptedOut: 'palpeer.pref.pushOptedOut',
} as const;

const APPEARANCES: readonly AppearancePreference[] = ['system', 'light', 'dark'];

export type StoredPreferences = Omit<PreferencesState, 'loaded'>;

export const preferencesStorage = {
  async load(): Promise<StoredPreferences> {
    try {
      const [appearance, onboardingSeen, biometricUnlockPrompted] = await Promise.all([
        AsyncStorage.getItem(KEYS.appearance),
        AsyncStorage.getItem(KEYS.onboardingSeen),
        AsyncStorage.getItem(KEYS.biometricUnlockPrompted),
      ]);
      return {
        appearance:
          appearance && (APPEARANCES as readonly string[]).includes(appearance)
            ? (appearance as AppearancePreference)
            : 'light',
        onboardingSeen: onboardingSeen === 'true',
        biometricUnlockPrompted: biometricUnlockPrompted === 'true',
      };
    } catch (error) {
      logger.warn('Preferences load failed', { error });
      return { appearance: 'light', onboardingSeen: false, biometricUnlockPrompted: false };
    }
  },

  async setAppearance(value: AppearancePreference): Promise<void> {
    await AsyncStorage.setItem(KEYS.appearance, value);
  },

  async setOnboardingSeen(): Promise<void> {
    await AsyncStorage.setItem(KEYS.onboardingSeen, 'true');
  },

  async setBiometricUnlockPrompted(): Promise<void> {
    await AsyncStorage.setItem(KEYS.biometricUnlockPrompted, 'true');
  },

  async setSignupCountryIso2(iso2: string): Promise<void> {
    const code = iso2.trim().toUpperCase();
    if (code.length !== 2) return;
    await AsyncStorage.setItem(KEYS.signupCountryIso2, code);
  },

  async getSignupCountryIso2(): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(KEYS.signupCountryIso2);
      const code = value?.trim().toUpperCase() ?? '';
      return code.length === 2 ? code : null;
    } catch (error) {
      logger.warn('Signup country load failed', { error });
      return null;
    }
  },

  async clearSignupCountryIso2(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.signupCountryIso2);
  },

  /** Default is ON — only true after the user turns the switch off. */
  async getPushOptedOut(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(KEYS.pushOptedOut)) === 'true';
    } catch (error) {
      logger.warn('Push opt-out load failed', { error });
      return false;
    }
  },

  async setPushOptedOut(optedOut: boolean): Promise<void> {
    if (optedOut) {
      await AsyncStorage.setItem(KEYS.pushOptedOut, 'true');
    } else {
      await AsyncStorage.removeItem(KEYS.pushOptedOut);
    }
  },
};
