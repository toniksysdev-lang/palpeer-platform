import { colorScheme as nativewindColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useAppSelector } from '@/store';
import { buildTheme, type Theme } from '@/theme';

const ThemeContext = createContext<Theme>(buildTheme('light'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const appearance = useAppSelector((state) => state.preferences.appearance);
  const scheme =
    appearance === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearance;

  useEffect(() => {
    nativewindColorScheme.set(appearance);
  }, [appearance]);

  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
