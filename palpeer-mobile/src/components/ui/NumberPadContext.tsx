import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInsideTabs } from '@/components/layout/tabScreen';
import { useTheme } from '@/providers/ThemeProvider';

import { NumberPad, type NumberPadBottomLeft, type NumberPadVariant } from './NumberPad';

export type NumberPadField = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  bottomLeft: NumberPadBottomLeft;
  variant: NumberPadVariant;
  onAccessoryPress?: () => void;
};

type NumberPadApi = {
  active: NumberPadField | null;
  open: (field: NumberPadField) => void;
  sync: (field: NumberPadField) => void;
  close: (id?: string) => void;
  /** Pages that render {@link NumberPadInlineDock} claim the pad so the screen dock stays hidden. */
  inlineHosts: number;
  registerInlineHost: () => void;
  unregisterInlineHost: () => void;
};

const NumberPadContext = createContext<NumberPadApi | null>(null);

/** Lets Screen scroll a focused number field so it sits above the keypad. */
type NumberPadScrollApi = {
  /** Approximate dock height reserved at the bottom while the pad is open. */
  dockHeight: number;
  /** Register the screen ScrollView so fields can request scroll-into-view. */
  registerScrollView: (ref: RefObject<{ scrollTo: (opts: { y: number; animated?: boolean }) => void } | null> | null) => void;
  /** Scroll so `anchor` ends above the keypad (with a little breathing room). */
  ensureAbovePad: (anchor: View | null) => void;
};

const NumberPadScrollContext = createContext<NumberPadScrollApi | null>(null);

export function NumberPadScrollProvider({
  children,
  dockHeight,
}: {
  children: ReactNode;
  dockHeight: number;
}) {
  const scrollRef = useRef<{ scrollTo: (opts: { y: number; animated?: boolean }) => void } | null>(null);
  const scrollY = useRef(0);
  const viewport = useRef({ y: 0, h: 0 });

  const registerScrollView = useCallback((ref: RefObject<{ scrollTo: (opts: { y: number; animated?: boolean }) => void } | null> | null) => {
    scrollRef.current = ref?.current ?? null;
  }, []);

  const ensureAbovePad = useCallback(
    (anchor: View | null) => {
      if (!anchor || dockHeight <= 0) return;
      const run = () => {
        const scroller = scrollRef.current as
          | (View & { scrollTo: (opts: { y: number; animated?: boolean }) => void; measureInWindow?: View['measureInWindow'] })
          | null;
        if (!scroller?.measureInWindow) {
          // Fallback: nudge down enough for the dock.
          scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + dockHeight * 0.35), animated: true });
          return;
        }
        scroller.measureInWindow((_sx, sy, _sw, sh) => {
          viewport.current = { y: sy, h: sh };
          anchor.measureInWindow((_fx, fy, _fw, fh) => {
            const fieldBottom = fy + fh;
            const visibleBottom = sy + sh - dockHeight - 12;
            if (fieldBottom <= visibleBottom) return;
            const delta = fieldBottom - visibleBottom;
            const nextY = Math.max(0, scrollY.current + delta);
            scrollY.current = nextY;
            scrollRef.current?.scrollTo({ y: nextY, animated: true });
          });
        });
      };
      // Wait a frame so the dock has laid out and ScrollView height has settled.
      requestAnimationFrame(() => requestAnimationFrame(run));
    },
    [dockHeight],
  );

  const api = useMemo(
    () => ({
      dockHeight,
      registerScrollView,
      ensureAbovePad,
      /** Used by Screen to keep scroll offset in sync for delta math. */
      _setScrollY: (y: number) => {
        scrollY.current = y;
      },
    }),
    [dockHeight, registerScrollView, ensureAbovePad],
  );

  return (
    <NumberPadScrollContext.Provider value={api as NumberPadScrollApi & { _setScrollY: (y: number) => void }}>
      {children}
    </NumberPadScrollContext.Provider>
  );
}

export function useNumberPadScroll(): NumberPadScrollApi | null {
  return useContext(NumberPadScrollContext);
}

/** Internal: Screen updates tracked scroll offset. */
export function useNumberPadScrollInternal() {
  return useContext(NumberPadScrollContext) as (NumberPadScrollApi & { _setScrollY?: (y: number) => void }) | null;
}

export function NumberPadProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<NumberPadField | null>(null);
  const [inlineHosts, setInlineHosts] = useState(0);

  const open = useCallback((field: NumberPadField) => {
    setActive(field);
  }, []);

  const sync = useCallback((field: NumberPadField) => {
    setActive((current) => {
      if (!current || current.id !== field.id) return current;
      // Bail out when nothing meaningful changed — replacing with a new object every
      // render (e.g. fresh onChange closure) would loop: sync → setState → re-render → sync.
      if (
        current.value === field.value &&
        current.onChange === field.onChange &&
        current.maxLength === field.maxLength &&
        current.bottomLeft === field.bottomLeft &&
        current.variant === field.variant &&
        current.onAccessoryPress === field.onAccessoryPress
      ) {
        return current;
      }
      return field;
    });
  }, []);

  const close = useCallback((id?: string) => {
    setActive((current) => {
      if (!current) return null;
      if (id && current.id !== id) return current;
      return null;
    });
  }, []);

  const registerInlineHost = useCallback(() => {
    setInlineHosts((count) => count + 1);
  }, []);

  const unregisterInlineHost = useCallback(() => {
    setInlineHosts((count) => Math.max(0, count - 1));
  }, []);

  const api = useMemo(
    () => ({ active, open, sync, close, inlineHosts, registerInlineHost, unregisterInlineHost }),
    [active, open, sync, close, inlineHosts, registerInlineHost, unregisterInlineHost],
  );

  return <NumberPadContext.Provider value={api}>{children}</NumberPadContext.Provider>;
}

export function useNumberPad(): NumberPadApi {
  const ctx = useContext(NumberPadContext);
  if (!ctx) {
    throw new Error('useNumberPad requires NumberPadProvider');
  }
  return ctx;
}

/** Optional: returns null outside a provider (e.g. a field that falls back to the system keyboard). */
export function useOptionalNumberPad(): NumberPadApi | null {
  return useContext(NumberPadContext);
}

type BindOptions = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  bottomLeft?: NumberPadBottomLeft;
  variant?: NumberPadVariant;
  /** Bottom-left `*` key action (e.g. paste OTP from clipboard). */
  onAccessoryPress?: () => void;
  /**
   * When true, opens the pad on mount. Prefer false so the pad only appears after a tap.
   */
  autoFocus?: boolean;
  disabled?: boolean;
  /**
   * Stable pad field id (e.g. design Input `id="rate"`) so an inline dock can target this field.
   * Defaults to a React useId() value.
   */
  padKey?: string;
};

/**
 * Binds a field to the shared on-screen number pad. Call `select()` when the field is tapped.
 */
export function useNumberPadField({
  value,
  onChange,
  maxLength = 32,
  bottomLeft = '',
  variant = 'compact',
  onAccessoryPress,
  autoFocus = false,
  disabled = false,
  padKey,
}: BindOptions) {
  const pad = useOptionalNumberPad();
  const reactId = useId();
  const id = padKey && String(padKey).trim() ? String(padKey).trim() : reactId;
  const active = pad?.active?.id === id;

  // Keep a stable onChange identity so parent re-renders don't churn `field` / sync loops.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const stableOnChange = useCallback((next: string) => {
    onChangeRef.current(next);
  }, []);

  const onAccessoryPressRef = useRef(onAccessoryPress);
  onAccessoryPressRef.current = onAccessoryPress;
  const stableAccessoryPress = useCallback(() => {
    onAccessoryPressRef.current?.();
  }, []);
  const accessory = onAccessoryPress ? stableAccessoryPress : undefined;

  const field = useMemo<NumberPadField>(
    () => ({
      id,
      value,
      onChange: stableOnChange,
      maxLength,
      bottomLeft,
      variant,
      onAccessoryPress: accessory,
    }),
    [id, value, stableOnChange, maxLength, bottomLeft, variant, accessory],
  );

  const sync = pad?.sync;
  useEffect(() => {
    if (active) sync?.(field);
  }, [active, field, sync]);

  useEffect(() => {
    if (autoFocus && !disabled) pad?.open(field);
    return () => {
      pad?.close(id);
    };
    // Claim on mount when autoFocus; always release on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount lifecycle only
  }, [id]);

  const select = useCallback(() => {
    if (disabled || !pad) return;
    pad.open(field);
  }, [disabled, field, pad]);

  return { select, active, padAvailable: !!pad, fieldId: id };
}

/** Renders the active field's keypad above the system navigation bar. Hidden until a field is tapped. */
export function NumberPadDock({
  testID = 'number-pad-dock',
  contentStyle,
  includeBottomInset = true,
  host = 'screen',
  scale,
  fitHeight = false,
}: {
  testID?: string;
  /** Applied only while the pad is visible so inactive screens don't reserve empty space. */
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * When false, the parent (e.g. Screen sticky footer) owns the home-indicator inset so the
   * pad can sit directly above that footer without double padding.
   */
  includeBottomInset?: boolean;
  /**
   * `screen` = shared dock at the layout edge (skipped while an inline host is mounted).
   * `inline` = in-flow dock under page content (e.g. below terms on My phone number).
   */
  host?: 'screen' | 'inline';
  /** Design-to-device scale so key sizes track the phone frame. */
  scale?: number;
  /** Shrink keys to the dock's laid-out height (My phone number). */
  fitHeight?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const insideTabs = useInsideTabs();
  const pad = useOptionalNumberPad();
  if (!pad?.active) return null;
  // Prefer an in-page dock when present — but screens should overlay the pad so layout
  // size stays stable (inline hosts are opt-in and rare).
  if (host === 'screen' && pad.inlineHosts > 0) return null;

  const { active } = pad;
  // Tab bar already clears the system nav; stack screens must pad the dock themselves.
  const bottomSafe = includeBottomInset && !insideTabs ? insets.bottom : 0;
  const padScale = scale != null && scale > 0 ? scale : 1;
  const padTop = Math.max(8, Math.round(theme.spacing.md * padScale));
  const padBottom = Math.max(10, Math.round(theme.spacing.lg * padScale)) + bottomSafe;

  return (
    <View
      testID={testID}
      style={[
        {
          gap: 0,
          paddingTop: padTop,
          paddingBottom: padBottom,
          borderTopWidth: 0,
          flexShrink: fitHeight ? 1 : 0,
          flexGrow: fitHeight ? 1 : 0,
          minHeight: fitHeight ? 0 : undefined,
          // Match design page chrome behind the Make-my-PIN style pad.
          backgroundColor: '#F3F6F4',
          // Keep a little air under Continue when this dock is in-flow.
          marginTop: fitHeight ? 2 : undefined,
        },
        // Callers (e.g. inline My phone number) may tighten padding / flex.
        contentStyle,
      ]}
    >
      <NumberPad
        value={active.value}
        onChange={active.onChange}
        maxLength={active.maxLength}
        bottomLeft={active.bottomLeft || (active.onAccessoryPress ? '*' : '')}
        onAccessoryPress={active.onAccessoryPress}
        variant="phone"
        scale={scale}
        fitHeight={fitHeight}
        testID={testID}
      />
    </View>
  );
}

/**
 * In-flow number pad host. Mount under static page copy (e.g. terms text) so the pad
 * appears below that content without shrinking fields above. Claims the pad away from
 * the screen-level dock for as long as this host is mounted.
 */
export function NumberPadInlineDock({
  testID = 'number-pad-dock',
  contentStyle,
  includeBottomInset = false,
}: {
  testID?: string;
  contentStyle?: StyleProp<ViewStyle>;
  includeBottomInset?: boolean;
}) {
  const pad = useOptionalNumberPad();
  useEffect(() => {
    if (!pad) return undefined;
    pad.registerInlineHost();
    return () => pad.unregisterInlineHost();
  }, [pad]);

  return (
    <NumberPadDock
      host="inline"
      testID={testID}
      contentStyle={contentStyle}
      includeBottomInset={includeBottomInset}
    />
  );
}
