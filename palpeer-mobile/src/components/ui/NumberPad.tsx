import { ClipboardPaste, Delete } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { usePressScale } from './usePressScale';

export type NumberPadBottomLeft = '' | '*' | '.';
/** Full-width pad. Use for phone, PIN, OTP, and amount fields. */
export type NumberPadVariant = 'compact' | 'phone';

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
  /**
   * Bottom-left key: blank, decorative `*` (ignored), or `.` (decimal for amounts).
   * When `onAccessoryPress` is set, `*` becomes a Paste action.
   */
  bottomLeft?: NumberPadBottomLeft;
  /** Fired when the bottom-left `*` key is pressed (OTP/PIN paste). */
  onAccessoryPress?: () => void;
  variant?: NumberPadVariant;
  testID?: string;
};

type Key = string;

const KEY_HEIGHT = 64;
const ROW_GAP = 12;
const COL_GAP = 12;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PadKeyProps = {
  label: Key;
  disabled?: boolean;
  pasteAction?: boolean;
  onPress: () => void;
  testID?: string;
};

function NumberPadKey({ label, disabled, pasteAction, onPress, testID }: PadKeyProps) {
  const theme = useTheme();
  const press = usePressScale(0.94);
  const [pressed, setPressed] = useState(false);
  const inactive = !!disabled;
  const decorative = label === '*' && !pasteAction;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        if (inactive || decorative) return;
        setPressed(true);
        press.onPressIn();
      }}
      onPressOut={() => {
        setPressed(false);
        press.onPressOut();
      }}
      disabled={inactive || decorative}
      accessibilityRole="button"
      accessibilityLabel={
        label === 'back'
          ? 'Delete last digit'
          : label === '.'
            ? 'Decimal point'
            : pasteAction
              ? 'Paste code'
              : label
      }
      accessibilityState={{ disabled: inactive || decorative }}
      testID={testID}
      style={[
        styles.key,
        {
          borderColor: pressed ? theme.colors.borderStrong : theme.colors.border,
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
          opacity: inactive ? 0.5 : 1,
        },
        press.animatedStyle,
      ]}
    >
      {label === 'back' ? (
        <Icon icon={Delete} size={28} color={theme.colors.textPrimary} strokeWidth={1.75} />
      ) : pasteAction ? (
        <Icon icon={ClipboardPaste} size={26} color={theme.colors.textPrimary} strokeWidth={1.75} />
      ) : (
        <AppText
          align="center"
          style={{
            fontSize: 32,
            fontWeight: '500',
            color: theme.colors.textPrimary,
            lineHeight: 32,
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
          }}
        >
          {label}
        </AppText>
      )}
    </AnimatedPressable>
  );
}

/**
 * Numeric keypad (1–9, bottom-left, 0, delete) with rounded key chrome.
 * Full-width 3×4 grid; digits and icons are centered in each key.
 */
export function NumberPad({
  value,
  onChange,
  maxLength = 15,
  disabled,
  bottomLeft = '*',
  onAccessoryPress,
  testID,
}: Props) {
  const rows: Key[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [bottomLeft || '*', '0', 'back'],
  ];
  const pasteAction = bottomLeft === '*' && !!onAccessoryPress;

  const handlePress = (key: Key) => {
    if (disabled) return;
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '*' && onAccessoryPress) {
      onAccessoryPress();
      return;
    }
    if (!key || key === '*') return;
    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value.length === 0 ? '0.' : `${value}.`);
      return;
    }
    if (value.length < maxLength) onChange(value + key);
  };

  return (
    <View
      style={[styles.grid, { rowGap: ROW_GAP }]}
      testID={testID ? `${testID}-grid` : undefined}
      accessibilityLabel="Number pad"
    >
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={[styles.row, { columnGap: COL_GAP }]}>
          {row.map((key) =>
            key === '' ? (
              <View key={`blank-${rowIndex}`} style={styles.keySlot} />
            ) : (
              <NumberPadKey
                key={`${key}-${rowIndex}`}
                label={key}
                disabled={disabled}
                pasteAction={key === '*' && pasteAction}
                onPress={() => handlePress(key)}
                testID={
                  testID
                    ? `${testID}-key-${key === 'back' ? 'back' : key === '.' ? 'dot' : key === '*' && pasteAction ? 'paste' : key}`
                    : undefined
                }
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'stretch',
  },
  keySlot: {
    flex: 1,
    height: KEY_HEIGHT,
  },
  key: {
    flex: 1,
    height: KEY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
