import { useCallback } from 'react';

import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { languageChanged, type AppLanguage } from '@/store/slices/preferencesSlice';
import { logger } from '@/utils/logger';

export function useLanguage() {
  const dispatch = useAppDispatch();
  const language = useAppSelector((state) => state.preferences.language);

  const setLanguage = useCallback(
    (next: AppLanguage) => {
      dispatch(languageChanged(next));
      preferencesStorage.setLanguage(next).catch((error: unknown) => {
        logger.warn('Could not persist language', { error });
      });
    },
    [dispatch],
  );

  return { language, setLanguage };
}
