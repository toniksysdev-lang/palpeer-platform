import '@/design/dc/shims';

import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
  NotoSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/noto-sans';
import { Stack } from 'expo-router';

import { LookContext } from '@/design/dc/runtime';
import { DARK_PAGE } from '@/design/dc/theme';
import { useAppearance } from '@/hooks/useAppearance';

/**
 * Design UI route group — Palpeer Simple Home artboards (change map).
 * Screens live under `@/design/screens` and keep the design’s painted tab bar.
 * Look follows App look (preferences.appearance).
 */
export default function DesignLayout() {
  const { dark } = useAppearance();
  const [fontsLoaded] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
    NotoSans_800ExtraBold,
  });

  if (!fontsLoaded) return null;

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
