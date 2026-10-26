import { forwardRef, useCallback, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useFocusAnchor } from '@/components/layout/FocusScroll';
import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import type { NumberPadBottomLeft } from './NumberPad';
import { useNumberPadField, useOptionalNumberPad } from './NumberPadContext';
import { numberFieldTextInputProps, suppressSystemKeyboard } from './numberFieldInput';

export type NumberPadMode = 'digits' | 'phone' | 'decimal';

export type InputProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  error?: string | null;
  hint?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** `elevated`: a white card with a soft shadow and no border until focused or invalid. */
  appearance?: 'outlined' | 'elevated';
  /**
   * When set, editing uses the shared in-app number pad instead of the system keyboard.
   * `digits` = 0–9, `phone` = 0–9 with decorative `*`, `decimal` = 0–9 with `.`.
   * Paste still works via TextInput; the OS keypad is never shown.
   */
  numberPad?: NumberPadMode;
  /** Max digits for `numberPad` fields (ignored for free-text). */
  numberPadMaxLength?: number;
  testID?: string;
};

function bottomLeftFor(mode: NumberPadMode): NumberPadBottomLeft {
  if (mode === 'phone') return '*';
  if (mode === 'decimal') return '.';
  return '';
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    hint,
    left,
    right,
    appearance = 'outlined',
    editable = true,
    onFocus,
    onBlur,
    numberPad,
    numberPadMaxLength = 32,
    value,
    onChangeText,
    placeholder,
    testID,
    ...rest
  },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const elevated = appearance === 'elevated';
  const localRef = useRef<TextInput>(null);
  const { ref: anchorRef, reveal } = useFocusAnchor();
  const sharedPad = useOptionalNumberPad();
  const stringValue = typeof value === 'string' ? value : value != null ? String(value) : '';

  const handlePadChange = useCallback(
    (next: string) => {
      onChangeText?.(next);
    },
    [onChangeText],
  );

  const pad = useNumberPadField({
    value: stringValue,
    onChange: handlePadChange,
    maxLength: numberPadMaxLength,
    bottomLeft: numberPad ? bottomLeftFor(numberPad) : '*',
    variant: 'phone',
    disabled: !editable || !numberPad,
  });

  const usePad = !!numberPad && pad.padAvailable;
  const showFocus = usePad ? pad.active : focused;

  const borderColor = error
    ? theme.colors.danger
    : showFocus
      ? theme.colors.primary
      : elevated
        ? 'transparent'
        : theme.colors.borderStrong;

  const fieldStyle = [
    styles.field,
    elevated ? theme.shadows.card : null,
    {
      borderColor,
      borderRadius: elevated ? theme.radius.lg : theme.radius.md,
      backgroundColor: editable ? theme.colors.surface : theme.colors.surfaceMuted,
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
      minHeight: elevated ? 56 : 52,
    },
  ];

  const setRefs = (node: TextInput | null) => {
    localRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const openPad = () => {
    localRef.current?.focus();
    suppressSystemKeyboard();
    pad.select();
    reveal();
  };

  return (
    <View ref={anchorRef} collapsable={false} style={{ gap: theme.spacing.xs }}>
      <AppText
        variant={elevated ? 'body' : 'caption'}
        tone={elevated ? 'primary' : 'secondary'}
        style={styles.label}
      >
        {label}
      </AppText>
      {usePad ? (
        <Pressable
          onPress={openPad}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={error ?? hint ?? 'Opens number pad'}
          accessibilityState={{ disabled: !editable, selected: pad.active }}
          style={fieldStyle}
        >
          {left}
          <TextInput
            ref={setRefs}
            testID={testID}
            editable={editable}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            accessibilityLabel={label}
            accessibilityHint={error ?? hint}
            accessibilityState={{ selected: pad.active }}
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.primary}
            onFocus={(event) => {
              suppressSystemKeyboard();
              pad.select();
              reveal();
              onFocus?.(event);
            }}
            onBlur={onBlur}
            style={[styles.input, theme.typography.body, { color: theme.colors.textPrimary }]}
            maxFontSizeMultiplier={1.6}
            {...numberFieldTextInputProps}
          />
          {right}
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            if (!editable) return;
            sharedPad?.close();
            localRef.current?.focus();
            reveal();
          }}
          disabled={!editable}
          accessibilityRole="none"
          style={fieldStyle}
        >
          {left}
          <TextInput
            ref={setRefs}
            testID={testID}
            editable={editable}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            accessibilityLabel={label}
            accessibilityHint={error ?? hint}
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.primary}
            onFocus={(event) => {
              // Password / email fields must dismiss the OTP/amount pad or it covers
              // lower fields (e.g. Confirm new password) and blocks typing.
              sharedPad?.close();
              setFocused(true);
              reveal();
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={[styles.input, theme.typography.body, { color: theme.colors.textPrimary }]}
            maxFontSizeMultiplier={1.6}
            {...rest}
          />
          {right}
        </Pressable>
      )}
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { fontWeight: '600' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  input: { flex: 1, paddingVertical: 12, margin: 0, minHeight: 24 },
});
