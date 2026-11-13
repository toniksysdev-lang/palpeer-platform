import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { languageChanged, type AppLanguage } from '@/store/slices/preferencesSlice';
import { logger } from '@/utils/logger';

/** Legacy newui key — must stay cleared so it cannot override English. */
const LEGACY_LANG_KEY = 'palpeer-lang';

export function useLanguage() {
  const dispatch = useAppDispatch();
  const language = useAppSelector((state) => state.preferences.language);

  const setLanguage = useCallback(
    (next: AppLanguage) => {
      const lang: AppLanguage = next === 'fr' ? 'fr' : 'en';
      dispatch(languageChanged(lang));
      preferencesStorage.setLanguage(lang, { userPicked: true }).catch((error: unknown) => {
        logger.warn('Could not persist language', { error });
      });
      AsyncStorage.removeItem(LEGACY_LANG_KEY).catch(() => undefined);
    },
    [dispatch],
  );

  return { language, setLanguage };
}
