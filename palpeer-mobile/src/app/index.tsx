import '@/design/dc/shims';

import {
  NotoSans_400Regular,
  NotoSans_500Medium,
  NotoSans_600SemiBold,
  NotoSans_700Bold,
  NotoSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/noto-sans';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { useLiveStart } from '@/design/bridge/useLiveStart';
import { useGo } from '@/design/dc/route';
import { LookContext, Screen } from '@/design/dc/runtime';
import StartScreen from '@/design/screens/Start';
import { useAppearance } from '@/hooks/useAppearance';
import { useAppSelector } from '@/store';

/**
 * App entry — design landing (change map). Signed-in users go to design Home (`/Main`).
 * Dark/Light on this screen sets App look for the whole app.
 */
export default function Index() {
  const isAuthenticated = useAppSelector((state) => state.session.status === 'authenticated');
  const { scheme, dark, setAppearance } = useAppearance();
  const [fontsLoaded] = useFonts({
    NotoSans_400Regular,
    NotoSans_500Medium,
    NotoSans_600SemiBold,
    NotoSans_700Bold,
    NotoSans_800ExtraBold,
  });
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  const live = useLiveStart();
  const go = useGo();

  useEffect(() => {
    const timer = setTimeout(() => setFontsTimedOut(true), 2_500);
    return () => clearTimeout(timer);
  }, []);

  const onLookChange = useCallback(
    (next: 'dark' | 'light') => {
      setAppearance(next === 'light' ? 'light' : 'dark');
    },
    [setAppearance],
  );

  if (isAuthenticated) return <Redirect href="/Main" />;
  if (!fontsLoaded && !fontsTimedOut) {
    return <View style={{ flex: 1, backgroundColor: dark ? '#081410' : '#F3F6F4' }} />;
  }

  return (
    <LookContext.Provider value={{ dark }}>
      <Screen bg={StartScreen.background} go={go}>
        <StartScreen
          {...live}
          stage="land"
          look={scheme}
          onLookChange={onLookChange}
        />
      </Screen>
    </LookContext.Provider>
  );
}
