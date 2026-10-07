import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';
import type { Theme } from '@/theme';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { usePressScale } from './usePressScale';

export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'primaryOutline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';
export type ButtonShape = 'rounded' | 'pill';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  /** Shows a spinner, keeps the button pressed-disabled, and optionally swaps the label. */
  loading?: boolean;
  /** Label while `loading` (defaults to the normal label so status stays readable). */
  loadingLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  accessibilityHint?: string;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function palette(theme: Theme, variant: ButtonVariant) {
  const c = theme.colors;
  switch (variant) {
    case 'primary':
      return { bg: c.primary, fg: c.onPrimary, border: c.primary };
    case 'secondary':
      return { bg: c.primarySoft, fg: c.primary, border: c.primarySoft };
    case 'outline':
      return { bg: 'transparent', fg: c.textPrimary, border: c.borderStrong };
    case 'primaryOutline':
      return { bg: 'transparent', fg: c.primary, border: c.primary };
    case 'ghost':
      return { bg: 'transparent', fg: c.primary, border: 'transparent' };
    case 'danger':
      return { bg: c.danger, fg: c.textInverse, border: c.danger };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  shape = 'rounded',
  loading = false,
  loadingLabel,
  disabled = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  accessibilityHint,
  testID,
}: Props) {
  const theme = useTheme();
  const press = usePressScale();
  const colors = palette(theme, variant);
  const inactive = disabled || loading;
  const displayLabel = loading ? (loadingLabel ?? label) : label;

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={displayLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        {
          minHeight: size === 'lg' ? 52 : theme.touchTarget,
          paddingHorizontal: size === 'lg' ? theme.spacing.xl : theme.spacing.lg,
          borderRadius: shape === 'pill' ? theme.radius.pill : theme.radius.md,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity: inactive && !loading ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        press.animatedStyle,
      ]}
    >
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        {loading ? (
          <ActivityIndicator color={colors.fg} testID={testID ? `${testID}-spinner` : undefined} />
        ) : leftIcon ? (
          <Icon icon={leftIcon} size="md" color={colors.fg} />
        ) : null}
        <AppText variant="bodyStrong" style={{ color: colors.fg }} numberOfLines={1}>
          {displayLabel}
        </AppText>
        {!loading && rightIcon ? <Icon icon={rightIcon} size="md" color={colors.fg} /> : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
