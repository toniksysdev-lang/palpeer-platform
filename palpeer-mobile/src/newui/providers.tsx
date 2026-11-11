import { ReactNode } from 'react';
import { HideWebScrollbars } from '@/newui/lib/hideWebScrollbars';
import { LangProvider } from '@/newui/lib/i18n';
import { LayoutProvider } from '@/newui/lib/layout';
import { StoreProvider } from '@/newui/lib/store';
import { ThemeProvider } from '@/newui/lib/theme';

/** Providers required by the ported newui kit (theme, i18n, layout scale, transitional store). */
export function NewUiProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LangProvider>
        <LayoutProvider>
          <HideWebScrollbars />
          <StoreProvider>{children}</StoreProvider>
        </LayoutProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
