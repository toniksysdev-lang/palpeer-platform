import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

const KEY = 'palpeer.signup.draft';

export type SignupDraftStep =
  | 'PHONE_OTP'
  | 'REGISTER'
  | 'EMAIL_OTP'
  | 'LOGIN';

export type SignupDraft = {
  phone?: string | null;
  email?: string | null;
  maskedEmail?: string | null;
  countryIso2?: string | null;
  step: SignupDraftStep;
  updatedAt: string;
};

export const signupDraftStorage = {
  async load(): Promise<SignupDraft | null> {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SignupDraft;
      if (!parsed?.step) return null;
      if (!parsed.phone && !parsed.email) return null;
      return parsed;
    } catch (error) {
      logger.warn('Signup draft load failed', { error });
      return null;
    }
  },

  async save(draft: Omit<SignupDraft, 'updatedAt'> & { updatedAt?: string }): Promise<void> {
    const phone = draft.phone?.trim() || null;
    const email = draft.email?.trim() || null;
    if (!phone && !email) {
      logger.warn('Signup draft save skipped — need phone or email');
      return;
    }
    const next: SignupDraft = {
      ...draft,
      phone,
      email,
      maskedEmail: draft.maskedEmail?.trim() || null,
      countryIso2: draft.countryIso2?.trim().toUpperCase() || null,
      updatedAt: draft.updatedAt ?? new Date().toISOString(),
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
  },
};
