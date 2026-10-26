import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { NumberPad } from './NumberPad';
import { numberFieldTextInputProps, suppressSystemKeyboard } from './numberFieldInput';
import { extractDigits, readDigitsFromClipboard } from './pasteDigits';

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
  const pasteRef = useRef<TextInput>(null);
  const slotCount =
    slots ??
    Math.max(PIN_MIN_LENGTH, Math.min(maxLength, Math.max(value.length + 1, PIN_MIN_LENGTH)));

  const setDigits = useCallback(
    (next: string) => {
      onChange(extractDigits(next, maxLength));
    },
    [maxLength, onChange],
  );

  const pasteFromClipboard = useCallback(async () => {
    if (disabled) return;
    const digits = await readDigitsFromClipboard(maxLength);
    if (!digits) return;
    setDigits(digits);
  }, [disabled, maxLength, setDigits]);

  return (
    <View style={{ flex: 1, width: '100%', minHeight: 0, gap: theme.spacing.xxl }} testID={testID}>
      <Pressable
        style={styles.dotsWrap}
        onPress={() => {
          pasteRef.current?.focus();
          suppressSystemKeyboard();
        }}
        onLongPress={() => void pasteFromClipboard()}
        delayLongPress={350}
        disabled={disabled}
        accessibilityLabel="PIN"
        accessibilityHint="Long press to paste a PIN from the clipboard"
      >
        <PinDots value={value} slots={slotCount} statusMessage={statusMessage} testID={testID} />
        <TextInput
          ref={pasteRef}
          value={value}
          onChangeText={setDigits}
          onFocus={suppressSystemKeyboard}
          editable={!disabled}
          caretHidden
          maxLength={Math.max(maxLength * 4, 32)}
          // Avoid secureTextEntry on the paste capture field — it blocks clipboard paste on some OEMs.
          accessibilityLabel="PIN paste field"
          testID={testID ? `${testID}-paste` : undefined}
          style={styles.hiddenPaste}
          {...numberFieldTextInputProps}
        />
      </Pressable>
      <View style={{ flexGrow: 1, flexShrink: 1, minHeight: 16 }} />
      <View style={{ width: '100%', flexShrink: 0 }}>
        <NumberPad
          value={value}
          onChange={setDigits}
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
  dotsWrap: { width: '100%', position: 'relative' },
  hiddenPaste: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: 'transparent',
    zIndex: 2,
  },
});
