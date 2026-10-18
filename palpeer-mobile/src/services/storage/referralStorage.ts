import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

const KEY = 'palpeer.pendingReferralCode';

function normalize(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/**
 * Holds a referral code entered at sign-up until the user has a session and we can
 * call `POST /promotions/referrals/apply` (auth required; register itself has no referral field).
 */
export const referralStorage = {
  async save(raw: string): Promise<void> {
    const code = normalize(raw);
    if (!code) {
      await AsyncStorage.removeItem(KEY);
      return;
    }
    await AsyncStorage.setItem(KEY, code);
  },

  async peek(): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(KEY);
      return value ? normalize(value) || null : null;
    } catch (error) {
      logger.warn('Pending referral peek failed', { error });
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(KEY);
    } catch (error) {
      logger.warn('Pending referral clear failed', { error });
    }
  },
};
