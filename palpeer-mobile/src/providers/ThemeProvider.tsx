import { colorScheme as nativewindColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useAppSelector } from '@/store';
import { buildTheme, type Theme } from '@/theme';

const ThemeContext = createContext<Theme>(buildTheme('light'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Product UI is light-mode only (ignore system / stored dark preference).
  useColorScheme();
  const appearance = useAppSelector((state) => state.preferences.appearance);

  useEffect(() => {
    nativewindColorScheme.set('light');
  }, [appearance]);

  const theme = useMemo(() => buildTheme('light'), []);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
