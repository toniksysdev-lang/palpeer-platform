import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { useNumberPadField } from './NumberPadContext';

type Props = {
  label: string;
  /** Raw decimal string. Never parsed to a JS number here. */
  value: string;
  onChangeText: (value: string) => void;
  /** Currency precision from the backend currency list. */
  precision: number;
  currencyCode?: string;
  error?: string | null;
  hint?: string;
  editable?: boolean;
  appearance?: 'outlined' | 'elevated';
  placeholder?: string;
  autoFocus?: boolean;
  testID?: string;
};

/**
 * Keeps digits and a single decimal separator, limits decimals to `precision` and strips leading
 * zeros. Commas are treated as a decimal separator for locales that type one.
 */
export function sanitizeAmount(input: string, precision: number): string {
  const normalized = input.replace(/,/g, '.').replace(/[^\d.]/g, '');
  const [rawInt = '', ...rest] = normalized.split('.');
  const hasDot = normalized.includes('.') && precision > 0;
  const fraction = rest.join('').slice(0, Math.max(precision, 0));
  const integer = rawInt.replace(/^0+(?=\d)/, '');
  if (!hasDot) return integer;
  return `${integer === '' ? '0' : integer}.${fraction}`;
}

const AMOUNT_MAX_LENGTH = 32;

/**
 * Amount field driven by the shared in-app number pad (decimal key when precision &gt; 0).
 */
export function AmountInput({
  label,
  value,
  onChangeText,
  precision,
  currencyCode,
  error,
  hint,
  editable = true,
  appearance = 'outlined',
  placeholder = '0',
  autoFocus = false,
  testID,
}: Props) {
  const theme = useTheme();
  const elevated = appearance === 'elevated';

  const handleChange = useCallback(
    (next: string) => onChangeText(sanitizeAmount(next, precision)),
    [onChangeText, precision],
  );

  const { select, active, padAvailable } = useNumberPadField({
    value,
    onChange: handleChange,
    maxLength: AMOUNT_MAX_LENGTH,
    bottomLeft: precision > 0 ? '.' : '*',
    variant: 'phone',
    autoFocus,
    disabled: !editable,
  });

  const borderColor = error
    ? theme.colors.danger
    : active
      ? theme.colors.primary
      : elevated
        ? 'transparent'
        : theme.colors.borderStrong;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText
        variant={elevated ? 'body' : 'caption'}
        tone={elevated ? 'primary' : 'secondary'}
        style={styles.label}
      >
        {label}
      </AppText>
      <Pressable
        onPress={select}
        disabled={!editable || !padAvailable}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={error ?? hint ?? 'Opens number pad'}
        accessibilityState={{ disabled: !editable, selected: active }}
        testID={testID}
        style={[
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
        ]}
      >
        <AppText
          tone={value ? 'primary' : 'muted'}
          style={[styles.value, theme.typography.body]}
        >
          {value || placeholder}
        </AppText>
        {currencyCode ? (
          <AppText variant="bodyStrong" tone="secondary">
            {currencyCode}
          </AppText>
        ) : null}
      </Pressable>
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
}

const styles = StyleSheet.create({
  label: { fontWeight: '600' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  value: { flex: 1, paddingVertical: 12 },
});
