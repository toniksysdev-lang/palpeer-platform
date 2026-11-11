import { useEffect } from 'react';
import { Platform } from 'react-native';

const STYLE_ID = 'palpeer-hide-web-scrollbars';

/**
 * RN-web ScrollViews paint desktop scrollbar gutters. Hide them while keeping scroll.
 * Injected at runtime so it applies even when +html.tsx is cached.
 */
export function HideWebScrollbars() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = `
html, body, #root {
  height: 100% !important;
  max-height: 100% !important;
  overflow: hidden !important;
  overscroll-behavior: none !important;
}
#root {
  display: flex !important;
  flex-direction: column !important;
}
#root > div {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  max-height: 100% !important;
}
/* Keep scroll, kill desktop scrollbar gutters (RN-web ScrollView uses overflow:scroll). */
* {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
*::-webkit-scrollbar,
*::-webkit-scrollbar-thumb,
*::-webkit-scrollbar-track {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
  background: transparent !important;
  appearance: none !important;
}
`;
  }, []);
  return null;
}
