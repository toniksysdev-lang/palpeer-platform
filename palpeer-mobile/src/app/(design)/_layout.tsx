import '@/design/dc/shims';

import { Stack } from 'expo-router';
import { View } from 'react-native';

import { LookContext } from '@/design/dc/runtime';
import { DARK_PAGE } from '@/design/dc/theme';
import { useAppearance } from '@/hooks/useAppearance';
import { NewUiProviders } from '@/newui/providers';
import { DesignTabDock } from '@/newui/ui/DesignTabDock';

/**
 * Design UI route group — Palpeer Simple Home artboards (change map).
 * Fonts load once in root `_layout` (with BrandSplash), so this layout never
 * returns a blank view on Android after splash hide.
 *
 * Persistent BottomNav lives here (not per-screen) so the APK footer stays
 * fixed like localhost:8082 instead of sliding with stack transitions.
 */
export default function DesignLayout() {
  const { appearance } = useAppearance();
  const designDark = appearance === 'dark';

  return (
    <LookContext.Provider value={{ dark: designDark }}>
      <NewUiProviders>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, minHeight: 0, width: '100%' }}>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                // Keep inactive design screens mounted so keypad/form state survives back nav.
                // Cast: native-stack typings omit this option in our current RN Screens version.
                ...({ detachInactiveScreens: true } as object),
                contentStyle: {
                  flex: 1,
                  backgroundColor: designDark ? DARK_PAGE : '#F3F6F4',
                },
              }}
            />
          </View>
          <DesignTabDock />
        </View>
      </NewUiProviders>
    </LookContext.Provider>
  );
}
