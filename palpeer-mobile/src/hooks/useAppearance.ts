import { useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { resolveScheme } from '@/providers/ThemeProvider';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { appearanceChanged, type AppearancePreference } from '@/store/slices/preferencesSlice';
import type { ColorSchemeName } from '@/theme';
import { logger } from '@/utils/logger';

export function useAppearance() {
  const dispatch = useAppDispatch();
  const appearance = useAppSelector((state) => state.preferences.appearance);
  const systemScheme = useColorScheme();

  const scheme = useMemo(
    (): ColorSchemeName => resolveScheme(appearance, systemScheme),
    [appearance, systemScheme],
  );

  const setAppearance = useCallback(
    (next: AppearancePreference) => {
      dispatch(appearanceChanged(next));
      preferencesStorage.setAppearance(next).catch((error: unknown) => {
        logger.warn('Could not persist appearance', { error });
      });
    },
    [dispatch],
  );

  return { appearance, setAppearance, scheme, dark: scheme === 'dark' };
}
