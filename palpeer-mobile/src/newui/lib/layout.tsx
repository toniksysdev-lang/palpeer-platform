import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useWindowDimensions, ViewStyle } from 'react-native';

/** Design was authored around a ~390×844 phone. Scale UI from the live window. */
const BASE_W = 390;
const BASE_H = 844;

type LayoutValue = {
  width: number;
  height: number;
  /** 0.82–1.12 scale vs 390pt design width */
  scale: number;
  /** Scale a design token (font size, spacing, control height). */
  s: (n: number) => number;
  /** Full-bleed page root style for web + native. */
  page: ViewStyle;
};

const LayoutCtx = createContext<LayoutValue>({
  width: BASE_W,
  height: BASE_H,
  scale: 1,
  s: (n) => n,
  page: { flex: 1, width: '100%', maxWidth: '100%', minHeight: 0 },
});

export function LayoutProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const value = useMemo<LayoutValue>(() => {
    const w = Math.max(280, width || BASE_W);
    const h = Math.max(480, height || BASE_H);
    const byW = w / BASE_W;
    const byH = h / BASE_H;
    // Prefer width; compress further on short phones (SE / Flip cover) so chrome + CTAs fit.
    let scale = byW;
    if (byH < 0.85) scale = Math.min(byW, byW * (0.9 + byH * 0.1));
    if (byH < 0.78) scale = Math.min(scale, byW * 0.92);
    scale = Math.min(1.1, Math.max(0.78, scale));
    const s = (n: number) => Math.max(1, Math.round(n * scale));
    return {
      width: w,
      height: h,
      scale,
      s,
      // Clip the page shell; intentional ScrollViews handle overflow without a document bar.
      page: { flex: 1, width: '100%', maxWidth: '100%', alignSelf: 'stretch', minHeight: 0, overflow: 'hidden' },
    };
  }, [width, height]);

  return <LayoutCtx.Provider value={value}>{children}</LayoutCtx.Provider>;
}

export function useLayout() {
  return useContext(LayoutCtx);
}
