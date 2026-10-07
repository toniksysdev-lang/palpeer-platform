import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyThemeClass,
  getStoredTheme,
  resolveTheme,
  storeTheme,
  type ThemeMode,
} from '@/lib/theme';

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const CYCLE: ThemeMode[] = ['light', 'dark', 'system'];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? 'light' : getStoredTheme(),
  );
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined' ? 'light' : resolveTheme(getStoredTheme()),
  );

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    storeTheme(next);
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      const index = CYCLE.indexOf(current);
      const next = CYCLE[(index + 1) % CYCLE.length] ?? 'system';
      storeTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const nextResolved = resolveTheme(mode);
    setResolved(nextResolved);
    applyThemeClass(nextResolved);

    if (mode !== 'system') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const systemResolved = resolveTheme('system');
      setResolved(systemResolved);
      applyThemeClass(systemResolved);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, resolved, setMode, cycleMode }),
    [mode, resolved, setMode, cycleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
