import { createContext, useContext } from 'react';

/** True once expo-font has registered Noto faces (from root `_layout` useFonts). */
export const NotoFontsLoadedContext = createContext(false);

export function useNotoFontsLoaded() {
  return useContext(NotoFontsLoadedContext);
}
