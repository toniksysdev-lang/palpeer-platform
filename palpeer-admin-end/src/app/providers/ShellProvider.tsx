import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ShellContextValue = {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setMobileNavOpen: (value: boolean) => void;
  toggleMobileNav: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

const STORAGE_KEY = 'palpeer-admin-sidebar-collapsed';

export function ShellProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const setSidebarCollapsed = (value: boolean) => {
    setSidebarCollapsedState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  };

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      mobileNavOpen,
      setSidebarCollapsed,
      toggleSidebarCollapsed: () => setSidebarCollapsed(!sidebarCollapsed),
      setMobileNavOpen,
      toggleMobileNav: () => setMobileNavOpen((open) => !open),
    }),
    [sidebarCollapsed, mobileNavOpen],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error('useShell must be used within ShellProvider');
  }
  return ctx;
}
