import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppearancePreference, PreferencesState } from '@/store/slices/preferencesSlice';
import { logger } from '@/utils/logger';

/** Non-sensitive UI preferences only. Tokens and identity live in secureStorage. */
const KEYS = {
  appearance: 'palpeer.pref.appearance',
  onboardingSeen: 'palpeer.pref.onboardingSeen',
  biometricUnlockPrompted: 'palpeer.pref.biometricUnlockPrompted',
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
        // Dark / system prefs are ignored — the app ships light-only.
        appearance: 'light',
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
};
