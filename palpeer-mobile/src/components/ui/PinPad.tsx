import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { NumberPad } from './NumberPad';

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
  testID?: string;
};

/**
 * On-screen PIN keypad. No TextInput is used, so the PIN never reaches the system keyboard,
 * its suggestions, or autofill. Digits are shown as dots only.
 */
export function PinPad({ value, onChange, maxLength = PIN_MAX_LENGTH, disabled, testID }: Props) {
  const theme = useTheme();
  const slots = Math.max(PIN_MIN_LENGTH, Math.min(maxLength, value.length + 1));

  return (
    <View style={{ gap: theme.spacing.xxl }} testID={testID}>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${value.length} of up to ${maxLength} digits entered`}
        testID={testID ? `${testID}-dots` : undefined}
      >
        {Array.from({ length: slots }, (_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                borderColor: theme.colors.primary,
                backgroundColor: index < value.length ? theme.colors.primary : 'transparent',
              },
            ]}
          />
        ))}
      </View>
      <NumberPad
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        disabled={disabled}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 14, minHeight: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
