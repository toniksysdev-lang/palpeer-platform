import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { NumberPad, type NumberPadBottomLeft, type NumberPadVariant } from './NumberPad';
import { TextLink } from './TextLink';

export type NumberPadField = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  bottomLeft: NumberPadBottomLeft;
  variant: NumberPadVariant;
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
    setActive((current) => (current?.id === field.id ? field : current));
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
  /** Open the pad as soon as the field mounts. */
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
  autoFocus = false,
  disabled = false,
}: BindOptions) {
  const pad = useOptionalNumberPad();
  const id = useId();
  const active = pad?.active?.id === id;

  const field = useMemo<NumberPadField>(
    () => ({ id, value, onChange, maxLength, bottomLeft, variant }),
    [id, value, onChange, maxLength, bottomLeft, variant],
  );

  useEffect(() => {
    if (active) pad?.sync(field);
  }, [active, field, pad]);

  useEffect(() => {
    if (autoFocus && !disabled) pad?.open(field);
    return () => {
      pad?.close(id);
    };
    // Claim on mount when autoFocus; release on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount lifecycle only
  }, [id]);

  const select = useCallback(() => {
    if (disabled || !pad) return;
    pad.open(field);
  }, [disabled, field, pad]);

  return { select, active, padAvailable: !!pad };
}

/** Renders the active field's keypad above the screen footer. */
export function NumberPadDock({ testID = 'number-pad-dock' }: { testID?: string }) {
  const theme = useTheme();
  const pad = useOptionalNumberPad();
  if (!pad?.active) return null;

  const { active, close } = pad;

  const phone = active.variant === 'phone';

  return (
    <View
      testID={testID}
      style={{
        gap: phone ? 0 : theme.spacing.md,
        paddingTop: phone ? theme.spacing.sm : theme.spacing.md,
        borderTopWidth: phone ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      {phone ? null : (
        <View style={{ alignItems: 'flex-end', paddingHorizontal: theme.spacing.sm }}>
          <TextLink label="Done" tone="info" onPress={() => close(active.id)} testID={`${testID}-done`} />
        </View>
      )}
      <NumberPad
        value={active.value}
        onChange={active.onChange}
        maxLength={active.maxLength}
        bottomLeft={active.bottomLeft}
        variant={active.variant}
        testID={testID}
      />
    </View>
  );
}
