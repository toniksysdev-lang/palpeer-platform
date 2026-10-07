import { Pressable, View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.md,
        padding: theme.spacing.xxs,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: theme.radius.sm,
              backgroundColor: selected ? theme.colors.surface : 'transparent',
              ...(selected && theme.scheme === 'light' ? theme.shadows.card : null),
            }}
          >
            <AppText variant="bodyStrong" tone={selected ? 'primary' : 'secondary'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
