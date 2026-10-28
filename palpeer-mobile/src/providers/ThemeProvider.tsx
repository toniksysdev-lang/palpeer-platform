import { colorScheme as nativewindColorScheme } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

import { useAppSelector } from '@/store';
import { buildTheme, type ColorSchemeName, type Theme } from '@/theme';

const ThemeContext = createContext<Theme>(buildTheme('light'));

function resolveScheme(
  appearance: 'system' | 'light' | 'dark',
  systemScheme: string | null | undefined,
): ColorSchemeName {
  if (appearance === 'system') {
    return systemScheme === 'dark' ? 'dark' : 'light';
  }
  return appearance;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const appearance = useAppSelector((state) => state.preferences.appearance);

  const scheme = useMemo(
    () => resolveScheme(appearance, systemScheme),
    [appearance, systemScheme],
  );

  useEffect(() => {
    nativewindColorScheme.set(scheme);
  }, [scheme]);

  const theme = useMemo(() => buildTheme(scheme), [scheme]);
  return (
    <ThemeContext.Provider value={theme}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
