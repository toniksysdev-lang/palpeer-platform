import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
  NotoSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/noto-sans';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';

import { useLiveStart } from '@/design/bridge/useLiveStart';
import { useGo } from '@/design/dc/route';
import { LookContext, Screen } from '@/design/dc/runtime';
import StartScreen from '@/design/screens/Start';
import { useAppearance } from '@/hooks/useAppearance';
import { useAppSelector } from '@/store';

/**
 * App entry — same design Start landing as http://localhost:3333/?route=/.
 * Signed-in users go to design Home (`/Main`).
 * Fonts are loaded in root `_layout`; this keeps a soft useFonts call for HMR.
 */
export default function Index() {
  const isAuthenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const { appearance, setAppearance } = useAppearance();
  useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
    NotoSans_800ExtraBold,
  });
  const live = useLiveStart();
  const go = useGo();

  const onLookChange = useCallback(
    (next: 'dark' | 'light') => {
      setAppearance(next === 'light' ? 'light' : 'dark');
    },
    [setAppearance],
  );

  if (isAuthenticated) return <Redirect href="/Main" />;

  // Match :3333 light artboards unless the user explicitly chose dark (not system).
  const designDark = appearance === 'dark';

  return (
    <LookContext.Provider value={{ dark: designDark }}>
      {/* Land hero is always #081410 — light status icons like the :3333 phone frame. */}
      <StatusBar style="light" />
      <Screen bg={StartScreen.background} go={go}>
        <StartScreen
          {...live}
          stage="land"
          look={designDark ? 'dark' : 'light'}
          onLookChange={onLookChange}
        />
      </Screen>
    </LookContext.Provider>
  );
}
