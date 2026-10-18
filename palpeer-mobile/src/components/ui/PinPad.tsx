import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { NumberPad } from './NumberPad';

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;
/** Figma Set/Confirm PIN uses four circular slots. */
export const PIN_SETUP_LENGTH = 4;

type DotsProps = {
  value: string;
  slots: number;
  statusMessage?: string | null;
  testID?: string;
};

/** Circular PIN slots (filled = entered digits). */
export function PinDots({ value, slots, statusMessage, testID }: DotsProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      {statusMessage ? (
        <AppText align="center" style={{ color: theme.colors.primary, fontWeight: '600' }}>
          {statusMessage}
        </AppText>
      ) : null}
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${value.length} of up to ${slots} digits entered`}
        testID={testID ? `${testID}-dots` : undefined}
      >
        {Array.from({ length: slots }, (_, index) => (
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
    </View>
  );
}

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  /** Fixed number of circular slots (Figma = 4). */
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
  const slotCount =
    slots ??
    Math.max(PIN_MIN_LENGTH, Math.min(maxLength, Math.max(value.length + 1, PIN_MIN_LENGTH)));

  return (
    <View style={{ flex: 1, width: '100%', minHeight: 0, gap: theme.spacing.xxl }} testID={testID}>
      <PinDots value={value} slots={slotCount} statusMessage={statusMessage} testID={testID} />
      <View style={{ flexGrow: 1, flexShrink: 1, minHeight: 16 }} />
      <View style={{ width: '100%', flexShrink: 0 }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 18, minHeight: 28 },
  slot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5 },
});
