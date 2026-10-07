import { Delete } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { Icon } from './Icon';

export type NumberPadBottomLeft = '' | '*' | '.';

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  disabled?: boolean;
  /**
   * Bottom-left key: blank (PIN), `*` (phone OTP mockups), or `.` (amounts).
   * `*` is decorative / disabled; `.` inserts a decimal point once.
   */
  bottomLeft?: NumberPadBottomLeft;
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
  testID,
}: Props) {
  const theme = useTheme();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', bottomLeft, '0', 'back'] as const;

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
      style={styles.grid}
      testID={testID ? `${testID}-grid` : undefined}
      accessibilityLabel="Number pad"
    >
      {keys.map((key, index) =>
        key === '' ? (
          <View key={`blank-${index}`} style={styles.key} />
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
              styles.key,
              {
                borderRadius: theme.radius.pill,
                backgroundColor: pressed && key !== '*' ? theme.colors.surfaceMuted : 'transparent',
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            {key === 'back' ? (
              <Icon icon={Delete} size="lg" />
            ) : (
              <AppText variant="h2" tone={key === '*' ? 'muted' : 'primary'}>
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
    rowGap: 8,
    alignSelf: 'center',
    width: 264,
  },
  key: { width: 80, height: 64, alignItems: 'center', justifyContent: 'center' },
});
