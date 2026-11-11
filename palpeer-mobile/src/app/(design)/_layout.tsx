import '@/design/dc/shims';

import { Stack } from 'expo-router';

import { LookContext } from '@/design/dc/runtime';
import { DARK_PAGE } from '@/design/dc/theme';
import { useAppearance } from '@/hooks/useAppearance';
import { NewUiProviders } from '@/newui/providers';

/**
 * Design UI route group — Palpeer Simple Home artboards (change map).
 * Fonts load once in root `_layout` (with BrandSplash), so this layout never
 * returns a blank view on Android after splash hide.
 *
 * Match :3333: design screens are authored for the light artboard. Only remap
 * via LookContext when the user explicitly chose dark (not system dark).
 * NewUiProviders wrap the ported React UI kit (theme / i18n).
 */
export default function DesignLayout() {
  const { appearance } = useAppearance();
  // Explicit dark only — same rule as newui ThemeProvider / :3333 light artboard.
  const designDark = appearance === 'dark';

  return (
    <LookContext.Provider value={{ dark: designDark }}>
      <NewUiProviders>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: designDark ? DARK_PAGE : '#F3F6F4' },
          }}
        />
      </NewUiProviders>
    </LookContext.Provider>
  );
}
