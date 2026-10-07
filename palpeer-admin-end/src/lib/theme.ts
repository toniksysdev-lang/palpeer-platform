export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'palpeer-admin-theme';

export function getStoredTheme(): ThemeMode {
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'light';
}

export function storeTheme(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyThemeClass(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
}
