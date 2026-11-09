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

/** ComplyCube capture / submit — Simple Home look (matches design Start KYC). */
export default function KycLayout() {
  const { appearance } = useAppearance();
  const designDark = appearance === 'dark';
  const [fontsLoaded] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
    NotoSans_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <LookContext.Provider value={{ dark: designDark }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: designDark ? DARK_PAGE : '#F3F6F4' },
        }}
      />
    </LookContext.Provider>
  );
}
