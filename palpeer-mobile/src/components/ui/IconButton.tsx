import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';

import { Icon } from './Icon';
import { usePressScale } from './usePressScale';

type Props = {
  icon: LucideIcon;
  /** Required: icon-only buttons have no visible text for screen readers. */
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'plain' | 'filled';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  loading = false,
  disabled,
  testID,
}: Props) {
  const theme = useTheme();
  const press = usePressScale(0.92);
  const inactive = disabled || loading;

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={inactive}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      style={[
        {
          width: theme.touchTarget,
          height: theme.touchTarget,
          borderRadius: theme.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: variant === 'filled' ? theme.colors.surfaceMuted : 'transparent',
          opacity: inactive && !loading ? 0.5 : 1,
        },
        press.animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={theme.colors.textPrimary}
          testID={testID ? `${testID}-spinner` : undefined}
        />
      ) : (
        <Icon icon={icon} size="lg" color={theme.colors.textPrimary} />
      )}
    </AnimatedPressable>
  );
}
