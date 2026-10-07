import { createContext, useContext, type ReactNode } from 'react';

const InsideTabsContext = createContext(false);

/** Tab screens sit above the tab bar, which already reserves the bottom safe area. */
export function TabScreenLayout({ children }: { children: ReactNode }) {
  return <InsideTabsContext.Provider value>{children}</InsideTabsContext.Provider>;
}

export function useInsideTabs(): boolean {
  return useContext(InsideTabsContext);
}
