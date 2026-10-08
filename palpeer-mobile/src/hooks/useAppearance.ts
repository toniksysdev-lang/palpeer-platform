import { useCallback } from 'react';

import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { appearanceChanged, type AppearancePreference } from '@/store/slices/preferencesSlice';
import { logger } from '@/utils/logger';

export function useAppearance() {
  const dispatch = useAppDispatch();
  const appearance = useAppSelector((state) => state.preferences.appearance);

  const setAppearance = useCallback(
    (_next: AppearancePreference) => {
      // App UI is light-only; ignore dark / system selections.
      dispatch(appearanceChanged('light'));
      preferencesStorage.setAppearance('light').catch((error: unknown) => {
        logger.warn('Could not persist appearance', { error });
      });
    },
    [dispatch],
  );

  return { appearance: 'light' as const, setAppearance };
}
