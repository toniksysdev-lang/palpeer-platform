import { forwardRef, useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { useNumberPadField } from './NumberPadContext';
import type { NumberPadBottomLeft } from './NumberPad';

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

function keyboardTypeFor(mode: NumberPadMode): TextInputProps['keyboardType'] {
  if (mode === 'decimal') return 'decimal-pad';
  if (mode === 'phone') return 'phone-pad';
  return 'number-pad';
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

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText
        variant={elevated ? 'body' : 'caption'}
        tone={elevated ? 'primary' : 'secondary'}
        style={styles.label}
      >
        {label}
      </AppText>
      {usePad ? (
        <Pressable
          onPress={pad.select}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={error ?? hint ?? 'Opens number pad'}
          accessibilityState={{ disabled: !editable, selected: pad.active }}
          testID={testID}
          style={fieldStyle}
        >
          {left}
          <AppText
            tone={stringValue ? 'primary' : 'muted'}
            style={[styles.input, theme.typography.body]}
          >
            {stringValue || placeholder || ''}
          </AppText>
          {right}
        </Pressable>
      ) : (
        <View style={fieldStyle}>
          {left}
          <TextInput
            ref={ref}
            testID={testID}
            editable={editable}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            accessibilityLabel={label}
            accessibilityHint={error ?? hint}
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.primary}
            keyboardType={numberPad ? keyboardTypeFor(numberPad) : rest.keyboardType}
            onFocus={(event) => {
              setFocused(true);
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
        </View>
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
  input: { flex: 1, paddingVertical: 12 },
});
