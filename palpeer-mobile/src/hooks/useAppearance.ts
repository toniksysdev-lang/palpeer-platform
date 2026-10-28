import { useCallback } from 'react';

import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { appearanceChanged, type AppearancePreference } from '@/store/slices/preferencesSlice';
import { logger } from '@/utils/logger';

export function useAppearance() {
  const dispatch = useAppDispatch();
  const appearance = useAppSelector((state) => state.preferences.appearance);

  const setAppearance = useCallback(
    (next: AppearancePreference) => {
      dispatch(appearanceChanged(next));
      preferencesStorage.setAppearance(next).catch((error: unknown) => {
        logger.warn('Could not persist appearance', { error });
      });
    },
    [dispatch],
  );

  return { appearance, setAppearance };
}
