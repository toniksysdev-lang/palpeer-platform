import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { useNumberPadField } from './NumberPadContext';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  /** Called once all digits are entered. */
  onComplete?: (value: string) => void;
  length?: number;
  error?: string | null;
  /** When true, opens the shared pad on mount. Default false — pad opens on tap. */
  autoFocus?: boolean;
  editable?: boolean;
  testID?: string;
};

/** OTP boxes driven by the shared in-app number pad. Digits are never logged. */
export function OtpInput({
  value,
  onChangeText,
  onComplete,
  length = 6,
  error,
  autoFocus = false,
  editable = true,
  testID,
}: Props) {
  const theme = useTheme();

  const handleChange = useCallback(
    (next: string) => {
      const digits = next.replace(/\D/g, '').slice(0, length);
      onChangeText(digits);
      if (digits.length === length) onComplete?.(digits);
    },
    [length, onChangeText, onComplete],
  );

  const { select, active } = useNumberPadField({
    value,
    onChange: handleChange,
    maxLength: length,
    bottomLeft: '*',
    variant: 'phone',
    autoFocus,
    disabled: !editable,
  });

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Pressable
        onPress={select}
        disabled={!editable}
        accessible={false}
        testID={testID ? `${testID}-cells` : undefined}
        style={[styles.row, { gap: theme.spacing.sm }]}
      >
        {Array.from({ length }, (_, index) => {
          const char = value[index] ?? '';
          const highlight = active && index === Math.min(value.length, length - 1);
          const borderColor = error
            ? theme.colors.danger
            : highlight
              ? theme.colors.primary
              : char
                ? theme.colors.borderStrong
                : theme.colors.border;
          return (
            <View
              key={index}
              style={[
                styles.cell,
                {
                  borderColor,
                  borderWidth: highlight ? 2 : 1,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <AppText variant="h2">{char}</AppText>
            </View>
          );
        })}
      </Pressable>
      <View
        testID={testID}
        accessibilityLabel={`Verification code, ${length} digits`}
        accessibilityHint={error ?? undefined}
        accessibilityValue={{ text: value }}
        nativeID={value}
      />
      {error ? (
        <AppText variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center' },
  cell: { width: 48, height: 56, alignItems: 'center', justifyContent: 'center' },
});
