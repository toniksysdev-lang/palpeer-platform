import { Delete } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type NumberPadBottomLeft = '' | '*' | '.';
export type NumberPadVariant = 'compact' | 'dialer';

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
  /**
   * Bottom-left key: blank (PIN), `*` (phone dialer), or `.` (amounts).
   * `*` is decorative / disabled; `.` inserts a decimal point once.
   */
  bottomLeft?: NumberPadBottomLeft;
  /** `dialer` matches a phone keypad (letters under digits, round keys). */
  variant?: NumberPadVariant;
  testID?: string;
};

const DIALER_LETTERS: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
  '0': '+',
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
  const dialer = variant === 'dialer';
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', bottomLeft, '0', 'back'] as const;
  const keySize = dialer ? Math.min(78, Math.floor((width - 64) / 3) - 12) : 80;
  const gridWidth = dialer ? Math.min(width - 32, keySize * 3 + 48) : 264;

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
      style={[styles.grid, { width: gridWidth, rowGap: dialer ? 14 : 8 }]}
      testID={testID ? `${testID}-grid` : undefined}
      accessibilityLabel="Number pad"
    >
      {keys.map((key, index) =>
        key === '' ? (
          <View key={`blank-${index}`} style={{ width: keySize, height: keySize }} />
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
                width: keySize,
                height: keySize,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: dialer ? keySize / 2 : theme.radius.pill,
                backgroundColor: dialer
                  ? pressed
                    ? theme.colors.surfaceMuted
                    : theme.colors.surface
                  : pressed && key !== '*'
                    ? theme.colors.surfaceMuted
                    : 'transparent',
                opacity: disabled ? 0.5 : 1,
                ...(dialer && key !== '*'
                  ? {
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: theme.colors.border,
                      ...theme.shadows.card,
                    }
                  : null),
              },
            ]}
          >
            {key === 'back' ? (
              <Icon icon={Delete} size="lg" />
            ) : (
              <View style={styles.keyContent}>
                <AppText
                  variant={dialer ? 'h1' : 'h2'}
                  tone={key === '*' ? 'muted' : 'primary'}
                  style={dialer ? { fontWeight: '400', lineHeight: keySize * 0.42 } : undefined}
                >
                  {key}
                </AppText>
                {dialer && DIALER_LETTERS[key] ? (
                  <AppText
                    variant="caption"
                    tone="muted"
                    style={{
                      letterSpacing: key === '0' ? 0 : 1.5,
                      fontSize: 10,
                      marginTop: -2,
                      textTransform: key === '0' ? 'none' : 'uppercase',
                    }}
                  >
                    {DIALER_LETTERS[key]}
                  </AppText>
                ) : null}
              </View>
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
  keyContent: { alignItems: 'center', justifyContent: 'center' },
});
