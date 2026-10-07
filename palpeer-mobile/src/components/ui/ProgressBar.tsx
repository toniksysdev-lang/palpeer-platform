import { View } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  /** 0–1; values outside the range are clamped. */
  value: number;
  accessibilityLabel: string;
  testID?: string;
};

export function ProgressBar({ value, accessibilityLabel, testID }: Props) {
  const theme = useTheme();
  const percent = Math.round(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100);
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={{
        height: 8,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${percent}%`,
          height: '100%',
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.primary,
        }}
      />
    </View>
  );
}
