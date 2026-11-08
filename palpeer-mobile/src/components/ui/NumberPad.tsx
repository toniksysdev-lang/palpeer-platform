import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from './AppText';
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
  /**
   * Design-to-device scale (390×844 fit). When omitted, derived from window width
   * so the pad tracks phone size in the preview frame and on device.
   */
  scale?: number;
  /**
   * Shrink keys to fit the laid-out height (My phone number inline dock).
   * Caps at the scaled design key height — never larger than the design pad.
   */
  fitHeight?: boolean;
  testID?: string;
};

type Key = string;

/** Design artboard width used by FIT_TO_SCREEN. */
const DESIGN_W = 390;

/** Matches Palpeer Simple Home “Make my PIN” keypad. */
export const NUMBER_PAD_KEY_HEIGHT = 76;
export const NUMBER_PAD_ROW_GAP = 10;
export const NUMBER_PAD_COL_GAP = 10;
export const NUMBER_PAD_KEY_RADIUS = 18;
/** Dock chrome above/below the 3×4 grid (theme spacing.md + lg). */
export const NUMBER_PAD_DOCK_PADDING = 12 + 16;
/** Total height reserved when the shared pad overlays the bottom of a screen (design units). */
export const NUMBER_PAD_DOCK_HEIGHT =
  NUMBER_PAD_KEY_HEIGHT * 4 + NUMBER_PAD_ROW_GAP * 3 + NUMBER_PAD_DOCK_PADDING;

const KEY_FG = '#0E1F19';
const KEY_BG = '#FFFFFF';
const KEY_MUTED_BG = '#E0E7E3';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Scale factor from phone width so the pad tracks device / preview size. */
export function numberPadScaleForWidth(width: number): number {
  if (!(width > 0)) return 1;
  return Math.min(1, Math.max(0.72, width / DESIGN_W));
}

export function numberPadMetrics(scale = 1) {
  const s = scale > 0 ? scale : 1;
  const keyHeight = Math.max(44, Math.round(NUMBER_PAD_KEY_HEIGHT * s));
  const rowGap = Math.max(6, Math.round(NUMBER_PAD_ROW_GAP * s));
  const colGap = Math.max(6, Math.round(NUMBER_PAD_COL_GAP * s));
  const radius = Math.max(10, Math.round(NUMBER_PAD_KEY_RADIUS * s));
  const dockPadding = Math.max(16, Math.round(NUMBER_PAD_DOCK_PADDING * s));
  const digitFont = Math.max(20, Math.round(30 * s));
  const actionFont = Math.max(14, Math.round(17 * s));
  return {
    keyHeight,
    rowGap,
    colGap,
    radius,
    dockPadding,
    digitFont,
    actionFont,
    dockHeight: keyHeight * 4 + rowGap * 3 + dockPadding,
  };
}

type PadKeyProps = {
  label: Key;
  disabled?: boolean;
  muted?: boolean;
  pasteAction?: boolean;
  /** Fixed height, or omit when the key should fill a flex row (fitHeight). */
  height?: number;
  radius: number;
  digitFont: number;
  actionFont: number;
  onPress: () => void;
  testID?: string;
};

function NumberPadKey({
  label,
  disabled,
  muted,
  pasteAction,
  height,
  radius,
  digitFont,
  actionFont,
  onPress,
  testID,
}: PadKeyProps) {
  const press = usePressScale(0.96);
  const [pressed, setPressed] = useState(false);
  const inactive = !!disabled;
  const decorative = label === '*' && !pasteAction;
  const text =
    label === 'back' ? 'Delete' : pasteAction ? 'Paste' : label === '' ? '' : label;
  const fontSize = label === 'back' || pasteAction ? actionFont : digitFont;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        if (inactive || decorative || !label) return;
        setPressed(true);
        press.onPressIn();
      }}
      onPressOut={() => {
        setPressed(false);
        press.onPressOut();
      }}
      disabled={inactive || decorative || !label}
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
      accessibilityState={{ disabled: inactive || decorative || !label }}
      testID={testID}
      style={[
        styles.key,
        height != null ? { height } : styles.keyFill,
        {
          borderRadius: radius,
          backgroundColor: muted || pasteAction || label === 'back' ? KEY_MUTED_BG : KEY_BG,
          opacity: inactive ? 0.5 : pressed ? 0.92 : 1,
        },
        press.animatedStyle,
      ]}
    >
      {text ? (
        <AppText
          align="center"
          style={{
            fontSize,
            fontWeight: '800',
            color: KEY_FG,
            lineHeight: fontSize + 2,
            ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
          }}
        >
          {text}
        </AppText>
      ) : null}
    </AnimatedPressable>
  );
}

/**
 * Numeric keypad matching the design “Make my PIN” pad:
 * white rounded keys, muted Delete, empty bottom-left (or . / Paste).
 * Sizes track the phone width (and optional design scale) so the pad fits the device.
 */
export function NumberPad({
  value,
  onChange,
  maxLength = 15,
  disabled,
  bottomLeft = '*',
  onAccessoryPress,
  scale: scaleProp,
  fitHeight = false,
  testID,
}: Props) {
  const { width } = useWindowDimensions();
  const scale = scaleProp ?? numberPadScaleForWidth(width);
  const metrics = useMemo(() => numberPadMetrics(scale), [scale]);
  const [fittedKeyHeight, setFittedKeyHeight] = useState<number | null>(null);

  // fitHeight: rows share space equally (flex) so 1–3 are never clipped shorter than 4–0.
  // Fixed height only when not fitting — or as a cap once measured.
  const keyHeight = fitHeight ? undefined : metrics.keyHeight;
  const digitFont =
    fitHeight && fittedKeyHeight != null
      ? Math.max(18, Math.min(metrics.digitFont, Math.round(fittedKeyHeight * 0.42)))
      : metrics.digitFont;
  const actionFont =
    fitHeight && fittedKeyHeight != null
      ? Math.max(12, Math.min(metrics.actionFont, Math.round(fittedKeyHeight * 0.28)))
      : metrics.actionFont;

  const pasteAction = bottomLeft === '*' && !!onAccessoryPress;
  // Design pad leaves bottom-left blank unless decimal or paste is needed.
  const leftKey: Key = bottomLeft === '.' ? '.' : pasteAction ? '*' : '';

  const rows: Key[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [leftKey, '0', 'back'],
  ];

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

  const onGridLayout = (event: LayoutChangeEvent) => {
    if (!fitHeight) return;
    const h = event.nativeEvent.layout.height;
    if (!(h > 0)) return;
    // Track laid-out row height so fonts track the equal flex rows.
    const next = Math.max(44, Math.floor((h - metrics.rowGap * 3) / 4));
    setFittedKeyHeight((prev) => (prev === next ? prev : next));
  };

  return (
    <View
      style={[
        styles.grid,
        { rowGap: metrics.rowGap },
        fitHeight ? styles.gridFill : null,
      ]}
      testID={testID ? `${testID}-grid` : undefined}
      accessibilityLabel="Number pad"
      onLayout={onGridLayout}
    >
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[
            styles.row,
            { columnGap: metrics.colGap },
            fitHeight ? styles.rowFill : null,
            // Cap each flex row so keys never grow past the design key height.
            fitHeight && fittedKeyHeight != null
              ? { maxHeight: Math.min(metrics.keyHeight, fittedKeyHeight) }
              : fitHeight
                ? { maxHeight: metrics.keyHeight }
                : null,
          ]}
        >
          {row.map((key, colIndex) =>
            key === '' ? (
              <View
                key={`blank-${rowIndex}-${colIndex}`}
                style={[styles.keySlot, keyHeight != null ? { height: keyHeight } : styles.keyFill]}
              />
            ) : (
              <NumberPadKey
                key={`${key}-${rowIndex}`}
                label={key}
                disabled={disabled}
                muted={key === 'back'}
                pasteAction={key === '*' && pasteAction}
                height={keyHeight}
                radius={metrics.radius}
                digitFont={digitFont}
                actionFont={actionFont}
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
  gridFill: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    // Equal flex rows fill the slot — do not clip (that shaved the 1–3 row).
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'stretch',
  },
  rowFill: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 44,
  },
  keySlot: {
    flex: 1,
  },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  keyFill: {
    alignSelf: 'stretch',
    minHeight: 0,
  },
});
