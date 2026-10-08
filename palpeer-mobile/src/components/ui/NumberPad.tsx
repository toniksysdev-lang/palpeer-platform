import { Delete } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type NumberPadBottomLeft = '' | '*' | '.';
/** Flat Figma pad (full-width). Use for phone, PIN, OTP, and amount fields. */
export type NumberPadVariant = 'compact' | 'phone';

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
  /**
   * Bottom-left key: blank, decorative `*` (ignored), or `.` (decimal for amounts).
   */
  bottomLeft?: NumberPadBottomLeft;
  variant?: NumberPadVariant;
  testID?: string;
};

/**
 * Flat Figma numeric keypad (1–9, bottom-left, 0, delete). No letter legends or key borders.
 */
export function NumberPad({
  value,
  onChange,
  maxLength = 15,
  disabled,
  bottomLeft = '*',
  variant = 'phone',
  testID,
}: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const flat = variant === 'phone' || variant === 'compact';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', bottomLeft, '0', 'back'] as const;
  const gridWidth = flat ? width - theme.spacing.xl * 2 : 264;
  const keyWidth = flat ? Math.floor(gridWidth / 3) : 80;
  const keyHeight = 56;

  const press = (key: (typeof keys)[number]) => {
    if (disabled) return;
    if (key === 'back') {
      onChange(value.slice(0, -1));
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
      style={[styles.grid, { width: gridWidth, rowGap: theme.spacing.sm }]}
      testID={testID ? `${testID}-grid` : undefined}
      accessibilityLabel="Number pad"
    >
      {keys.map((key, index) =>
        key === '' ? (
          <View key={`blank-${index}`} style={{ width: keyWidth, height: keyHeight }} />
        ) : (
          <Pressable
            key={`${key}-${index}`}
            onPress={() => press(key)}
            disabled={disabled || key === '*'}
            accessibilityRole="button"
            accessibilityLabel={
              key === 'back' ? 'Delete last digit' : key === '.' ? 'Decimal point' : key
            }
            accessibilityState={{ disabled: disabled || key === '*' }}
            testID={testID ? `${testID}-key-${key === 'back' ? 'back' : key}` : undefined}
            style={({ pressed }) => [
              {
                width: keyWidth,
                height: keyHeight,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 0,
                backgroundColor: pressed && key !== '*' ? theme.colors.surfaceMuted : 'transparent',
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            {key === 'back' ? (
              <Icon icon={Delete} size="lg" color={theme.colors.textSecondary} />
            ) : (
              <AppText
                variant="h1"
                tone={key === '*' ? 'muted' : 'secondary'}
                style={{
                  fontSize: 28,
                  fontWeight: '400',
                  color: theme.colors.textSecondary,
                  lineHeight: 34,
                }}
              >
                {key}
              </AppText>
            )}
          </Pressable>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignSelf: 'center',
  },
});
