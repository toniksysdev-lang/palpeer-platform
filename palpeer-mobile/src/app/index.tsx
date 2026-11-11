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
import { LookContext } from '@/design/dc/runtime';
import { useAppearance } from '@/hooks/useAppearance';
import { NewUiProviders } from '@/newui/providers';
import StartScreen from '@/newui/screens/Start';
import { useAppSelector } from '@/store';

/**
 * App entry — new UI Start landing (no DC FIT_TO_SCREEN).
 * Signed-in users go to design Home (`/Main`).
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

  const onLookChange = useCallback(
    (next: 'dark' | 'light') => {
      setAppearance(next === 'light' ? 'light' : 'dark');
    },
    [setAppearance],
  );

  if (isAuthenticated) return <Redirect href="/Main" />;

  const designDark = appearance === 'dark';

  return (
    <LookContext.Provider value={{ dark: designDark }}>
      <NewUiProviders>
        <StatusBar style="light" />
        <StartScreen
          {...live}
          stage="land"
          look={designDark ? 'dark' : 'light'}
          onLookChange={onLookChange}
        />
      </NewUiProviders>
    </LookContext.Provider>
  );
}
