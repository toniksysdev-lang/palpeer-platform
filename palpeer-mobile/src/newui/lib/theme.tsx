import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAppearance } from '@/hooks/useAppearance';

/** Colours taken from the Palpeer design. Dark values match the prototype's dark mode. */
const light = {
  bg: '#F3F6F4',
  card: '#FFFFFF',
  field: '#E9EEEB',
  key: '#E0E7E3',
  line: '#DDE5E0',
  ink: '#0E1F19', // strong dark buttons (Listen, selected)
  onInk: '#FFFFFF',
  text: '#0E1F19',
  text2: '#33453D',
  text3: '#46574F',
  text4: '#5B6B64',
  brand: '#0B6E4F', // brand fill (buttons, tiles)
  brandText: '#0B6E4F', // brand used as text or border
  deep: '#075E45',
  okBg: '#DDF1E7',
  red: '#B3231A',
  redFill: '#C2261C',
  orange: '#A84C08',
  warnBg: '#FFF4E5',
  blue: '#1D5BC7',
  purple: '#5E3AB8',
  off: '#8C9A94',
  tileGreen: '#DFF3E8',
  tileBlue: '#E1ECFB',
  tileOrange: '#FCEBD6',
  tilePurple: '#ECE6FA',
  white: '#FFFFFF',
  hero: '#081410',
};
export type Palette = typeof light;
const dark: Palette = {
  ...light,
  bg: '#0F1A16',
  card: '#1A2722',
  field: '#26352E',
  key: '#26352E',
  line: '#2E3E37',
  ink: '#33463D',
  text: '#F1F5F3',
  text2: '#BCC9C3',
  text3: '#BCC9C3',
  text4: '#A5B3AC',
  brandText: '#55D6A9',
  deep: '#8BE8C6',
  okBg: '#14362B',
  red: '#FF9A90',
  orange: '#F6B56E',
  warnBg: '#3B2A17',
  blue: '#93BBFF',
  purple: '#C7B6FF',
  tileGreen: '#14362B',
  tileBlue: '#1A2C47',
  tileOrange: '#3B2A17',
  tilePurple: '#2A2345',
};

export type Look = 'light' | 'dark';
type Ctx = { look: Look; setLook: (l: Look) => void; c: Palette };
const ThemeCtx = createContext<Ctx>({ look: 'light', setLook: () => {}, c: light });

/**
 * newui theme — Match :3333 light artboard unless the user explicitly chose Dark
 * (ignore system dark so APK OLED devices do not look unlike the preview).
 * More → Settings App look still writes light/dark via setAppearance.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { appearance, setAppearance } = useAppearance();
  const look: Look = appearance === 'dark' ? 'dark' : 'light';
  const setLook = useCallback(
    (l: Look) => {
      setAppearance(l);
    },
    [setAppearance],
  );
  const value = useMemo(() => ({ look, setLook, c: look === 'dark' ? dark : light }), [look, setLook]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/** Standalone theme for stories/tests without Redux preferences. */
export function LocalThemeProvider({
  children,
  initial = 'light',
}: {
  children: ReactNode;
  initial?: Look;
}) {
  const [look, setLookState] = useState<Look>(initial);
  useEffect(() => {
    setLookState(initial);
  }, [initial]);
  const setLook = useCallback((l: Look) => setLookState(l), []);
  const value = useMemo(() => ({ look, setLook, c: look === 'dark' ? dark : light }), [look, setLook]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
export const useC = () => useContext(ThemeCtx).c;
