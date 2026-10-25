import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { ScrollView, View } from 'react-native';

const EDGE_GAP = 12;

type FocusScrollApi = {
  /** Scroll so `target` sits fully inside the visible ScrollView area. */
  ensureVisible: (target: View | null) => void;
  /** Remember the last focused target so keyboard/pad layout changes can re-reveal it. */
  setActiveTarget: (target: View | null) => void;
  revealActive: () => void;
  scrollRef: RefObject<ScrollView | null>;
  registerScrollOffset: (y: number) => void;
};

const FocusScrollContext = createContext<FocusScrollApi | null>(null);

export function useFocusScroll(): FocusScrollApi | null {
  return useContext(FocusScrollContext);
}

/**
 * Anchor ref + helpers for amount/text fields so Screen can scroll them above the
 * in-app number pad or the system keyboard.
 */
export function useFocusAnchor() {
  const api = useFocusScroll();
  const ref = useRef<View>(null);

  const reveal = useCallback(() => {
    const run = () => api?.ensureVisible(ref.current);
    api?.setActiveTarget(ref.current);
    // Wait for pad/keyboard layout to settle before measuring.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(run, 64);
      });
    });
  }, [api]);

  return { ref, reveal };
}

type ProviderProps = {
  children: ReactNode;
  scrollRef: RefObject<ScrollView | null>;
};

/** Owns scroll-into-view for one Screen ScrollView. */
export function FocusScrollProvider({ children, scrollRef }: ProviderProps) {
  const offsetRef = useRef(0);
  const activeTargetRef = useRef<View | null>(null);

  const registerScrollOffset = useCallback((y: number) => {
    offsetRef.current = y;
  }, []);

  const setActiveTarget = useCallback((target: View | null) => {
    activeTargetRef.current = target;
  }, []);

  const ensureVisible = useCallback(
    (target: View | null) => {
      if (!target) return;
      const scroller = scrollRef.current;
      if (!scroller) return;

      target.measureInWindow((_x, y, _w, h) => {
        scroller.measureInWindow((_sx, sy, _sw, sh) => {
          if (sh <= 0 || h <= 0) return;
          const fieldTop = y;
          const fieldBottom = y + h;
          const visibleTop = sy + EDGE_GAP;
          const visibleBottom = sy + sh - EDGE_GAP;

          let delta = 0;
          if (fieldBottom > visibleBottom) {
            delta = fieldBottom - visibleBottom;
          } else if (fieldTop < visibleTop) {
            delta = fieldTop - visibleTop;
          }
          if (delta === 0) return;

          const nextY = Math.max(0, offsetRef.current + delta);
          offsetRef.current = nextY;
          scroller.scrollTo({ y: nextY, animated: true });
        });
      });
    },
    [scrollRef],
  );

  const revealActive = useCallback(() => {
    ensureVisible(activeTargetRef.current);
  }, [ensureVisible]);

  const api = useMemo<FocusScrollApi>(
    () => ({
      ensureVisible,
      setActiveTarget,
      revealActive,
      scrollRef,
      registerScrollOffset,
    }),
    [ensureVisible, setActiveTarget, revealActive, scrollRef, registerScrollOffset],
  );

  return <FocusScrollContext.Provider value={api}>{children}</FocusScrollContext.Provider>;
}
