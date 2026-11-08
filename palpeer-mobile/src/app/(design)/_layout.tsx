import '@/design/dc/shims';

import { Stack } from 'expo-router';

import { LookContext } from '@/design/dc/runtime';
import { DARK_PAGE } from '@/design/dc/theme';
import { useAppearance } from '@/hooks/useAppearance';

/**
 * Design UI route group — Palpeer Simple Home artboards (change map).
 * Fonts load once in root `_layout` (with BrandSplash), so this layout never
 * returns a blank view on Android after splash hide.
 */
export default function DesignLayout() {
  const { dark } = useAppearance();

  return (
    <LookContext.Provider value={{ dark }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: dark ? DARK_PAGE : '#F3F6F4' },
        }}
      />
    </LookContext.Provider>
  );
}
