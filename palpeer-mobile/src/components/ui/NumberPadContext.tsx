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
};

const NumberPadContext = createContext<NumberPadApi | null>(null);

export function NumberPadProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<NumberPadField | null>(null);

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

  const api = useMemo(() => ({ active, open, sync, close }), [active, open, sync, close]);

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
}: BindOptions) {
  const pad = useOptionalNumberPad();
  const id = useId();
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
}: {
  testID?: string;
  /** Applied only while the pad is visible so inactive screens don't reserve empty space. */
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * When false, the parent (e.g. Screen sticky footer) owns the home-indicator inset so the
   * pad can sit directly above that footer without double padding.
   */
  includeBottomInset?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const insideTabs = useInsideTabs();
  const pad = useOptionalNumberPad();
  if (!pad?.active) return null;

  const { active } = pad;
  // Tab bar already clears the system nav; stack screens must pad the dock themselves.
  const bottomSafe = includeBottomInset && !insideTabs ? insets.bottom : 0;

  return (
    <View
      testID={testID}
      style={[
        contentStyle,
        {
          gap: 0,
          paddingTop: theme.spacing.md,
          paddingBottom: theme.spacing.lg + bottomSafe,
          borderTopWidth: 0,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <NumberPad
        value={active.value}
        onChange={active.onChange}
        maxLength={active.maxLength}
        bottomLeft={active.bottomLeft || '*'}
        onAccessoryPress={active.onAccessoryPress}
        variant="phone"
        testID={testID}
      />
    </View>
  );
}
