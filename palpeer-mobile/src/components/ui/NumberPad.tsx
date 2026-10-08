import { Delete } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type NumberPadBottomLeft = '' | '*' | '.';
/** `phone` = Figma enter-phone pad (flat, full-width). `compact` = PIN/amount dock. */
export type NumberPadVariant = 'compact' | 'phone';

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
  /**
   * Bottom-left key: blank (PIN), `*` (decorative), or `.` (phone / amounts).
   * `*` is disabled; `.` inserts a decimal point once (ignored for digit-only phone fields).
   */
  bottomLeft?: NumberPadBottomLeft;
  variant?: NumberPadVariant;
  testID?: string;
};

/**
 * On-screen numeric keypad (1–9, 0, delete). Digits never go through the system keyboard.
 */
export function NumberPad({
  value,
  onChange,
  maxLength = 15,
  disabled,
  bottomLeft = '',
  variant = 'compact',
  testID,
}: Props) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const phone = variant === 'phone';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', bottomLeft, '0', 'back'] as const;
  const gridWidth = phone ? width - theme.spacing.xl * 2 : 264;
  const keyWidth = phone ? Math.floor(gridWidth / 3) : 80;
  const keyHeight = phone ? 56 : 64;

  const press = (key: (typeof keys)[number]) => {
    if (disabled) return;
    if (key === 'back') {
      onChange(value.slice(0, -1));
      return;
    }
    if (!key || key === '*') return;
    if (key === '.') {
      // Phone national digits are digits-only; keep `.` visible per Figma but ignore presses.
      if (phone) return;
      if (value.includes('.')) return;
      onChange(value.length === 0 ? '0.' : `${value}.`);
      return;
    }
    if (value.length < maxLength) onChange(value + key);
  };

  return (
    <View
      style={[
        styles.grid,
        {
          width: gridWidth,
          rowGap: phone ? theme.spacing.sm : 8,
        },
      ]}
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
            disabled={disabled || key === '*' || (phone && key === '.')}
            accessibilityRole="button"
            accessibilityLabel={
              key === 'back' ? 'Delete last digit' : key === '.' ? 'Decimal point' : key
            }
            accessibilityState={{
              disabled: disabled || key === '*' || (phone && key === '.'),
            }}
            testID={testID ? `${testID}-key-${key === 'back' ? 'back' : key}` : undefined}
            style={({ pressed }) => [
              {
                width: keyWidth,
                height: keyHeight,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: phone ? 0 : theme.radius.pill,
                backgroundColor:
                  !phone && pressed && key !== '*'
                    ? theme.colors.surfaceMuted
                    : phone && pressed
                      ? theme.colors.surfaceMuted
                      : 'transparent',
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            {key === 'back' ? (
              <Icon icon={Delete} size="lg" color={theme.colors.textSecondary} />
            ) : (
              <AppText
                variant={phone ? 'h1' : 'h2'}
                tone={key === '*' || (phone && key === '.') ? 'muted' : 'secondary'}
                style={
                  phone
                    ? {
                        fontSize: 28,
                        fontWeight: '400',
                        color: theme.colors.textSecondary,
                        lineHeight: 34,
                      }
                    : undefined
                }
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
