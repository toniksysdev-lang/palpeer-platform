import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { NumberPad } from './NumberPad';

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;
/** Figma Set/Confirm PIN uses four circular slots. */
export const PIN_SETUP_LENGTH = 4;

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  /** Fixed number of circular slots (Figma = 4). Defaults to max(4, value length+1 capped). */
  slots?: number;
  disabled?: boolean;
  statusMessage?: string | null;
  testID?: string;
};

/**
 * On-screen PIN keypad with circular digit slots. Digits never reach the system keyboard.
 */
export function PinPad({
  value,
  onChange,
  maxLength = PIN_MAX_LENGTH,
  slots,
  disabled,
  statusMessage,
  testID,
}: Props) {
  const theme = useTheme();
  const slotCount = slots ?? Math.max(PIN_MIN_LENGTH, Math.min(maxLength, Math.max(value.length + 1, PIN_MIN_LENGTH)));

  return (
    <View style={{ gap: theme.spacing.xxl }} testID={testID}>
      {statusMessage ? (
        <AppText align="center" style={{ color: theme.colors.primary, fontWeight: '600' }}>
          {statusMessage}
        </AppText>
      ) : null}
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${value.length} of ${slotCount} digits entered`}
        testID={testID ? `${testID}-dots` : undefined}
      >
        {Array.from({ length: slotCount }, (_, index) => (
          <View
            key={index}
            style={[
              styles.slot,
              {
                borderColor: theme.colors.borderStrong,
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
        bottomLeft="*"
        variant="phone"
        disabled={disabled}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 18, minHeight: 28 },
  slot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5 },
});
