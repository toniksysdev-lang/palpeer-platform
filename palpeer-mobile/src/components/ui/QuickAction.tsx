import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { IconTile, type IconTileTone } from './IconTile';
import { usePressScale } from './usePressScale';

type Props = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: IconTileTone;
  disabled?: boolean;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** An icon tile with a short label underneath, for shortcut rows. */
export function QuickAction({ icon, label, onPress, tone = 'surface', disabled, testID }: Props) {
  const theme = useTheme();
  const press = usePressScale(0.94);
  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[
        {
          width: '18%',
          minWidth: 64,
          flexGrow: 1,
          alignItems: 'center',
          gap: theme.spacing.sm,
          opacity: disabled ? 0.5 : 1,
        },
        press.animatedStyle,
      ]}
    >
      <IconTile icon={icon} shape="rounded" size="lg" tone={tone} />
      <AppText variant="caption" align="center" numberOfLines={1}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

/** Lays out `QuickAction`s in a wrapping row (supports Fund / InstantEX / P2P / Withdraw / Transfer). */
export function QuickActionBar({ children, testID }: { children: ReactNode; testID?: string }) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: theme.spacing.md,
        columnGap: theme.spacing.sm,
      }}
    >
      {children}
    </View>
  );
}
