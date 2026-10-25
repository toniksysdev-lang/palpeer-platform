import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useFocusAnchor } from '@/components/layout/FocusScroll';
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
  /** When false, do not pad trailing zeros on blur (rates). Default true for money amounts. */
  padOnBlur?: boolean;
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

/**
 * Display-only currency formatting (thousand separators).
 * When `padFraction` is true (blurred field), always shows fixed decimals (`1,234.00`).
 */
export function formatAmountDisplay(
  raw: string,
  precision: number,
  options: { padFraction?: boolean } = {},
): string {
  if (!raw) return '';
  const padFraction = options.padFraction === true && precision > 0;
  const trailingDot = precision > 0 && raw.endsWith('.');
  const sanitized = sanitizeAmount(raw, precision);
  if (!sanitized) return trailingDot ? '0.' : '';
  const [intPart = '0', fracPart = ''] = sanitized.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (trailingDot && !padFraction) return `${grouped}.`;
  if (precision <= 0) return grouped;
  // Only pad trailing zeros when explicitly requested (blurred money fields).
  // While typing (or for rates), show exactly what the user entered.
  if (padFraction) {
    return `${grouped}.${fracPart.padEnd(precision, '0').slice(0, precision)}`;
  }
  if (sanitized.includes('.')) {
    return `${grouped}.${fracPart}`;
  }
  return grouped;
}

const AMOUNT_MAX_LENGTH = 32;

/** Amount field driven by the shared in-app number pad (decimal key when precision > 0). */
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
  padOnBlur = true,
  testID,
}: Props) {
  const theme = useTheme();
  const elevated = appearance === 'elevated';
  const { ref: anchorRef, reveal } = useFocusAnchor();

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

  const a11yLabel = label.trim() || (currencyCode ? `Amount in ${currencyCode}` : 'Amount');

  const openPad = () => {
    select();
    reveal();
  };

  return (
    <View ref={anchorRef} collapsable={false} style={{ gap: theme.spacing.xs }}>
      {label.trim() ? (
        <AppText
          variant={elevated ? 'body' : 'caption'}
          tone={elevated ? 'primary' : 'secondary'}
          style={styles.label}
        >
          {label}
        </AppText>
      ) : null}
      <Pressable
        onPress={openPad}
        disabled={!editable || !padAvailable}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
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
        <AppText tone={value ? 'primary' : 'muted'} style={[styles.value, theme.typography.body]}>
          {value
            ? formatAmountDisplay(value, precision, { padFraction: padOnBlur && !active })
            : placeholder.includes('.')
              ? placeholder
              : precision > 0 && padOnBlur
                ? `0.${''.padEnd(Math.min(precision, 2), '0')}`
                : placeholder}
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
