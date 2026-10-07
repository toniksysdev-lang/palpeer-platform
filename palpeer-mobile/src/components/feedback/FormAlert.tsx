import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';
import { toneColors } from '@/theme';

type Props = {
  message: string | null | undefined;
  tone?: 'danger' | 'success' | 'info' | 'warning';
  testID?: string;
};

/** Inline, form-level message (e.g. wrong credentials). Renders nothing without a message. */
export function FormAlert({ message, tone = 'danger', testID }: Props) {
  const theme = useTheme();
  if (!message) return null;
  const { fg, bg } = toneColors(theme, tone);
  const icon = tone === 'success' ? CircleCheck : tone === 'info' ? Info : CircleAlert;

  return (
    <Animated.View entering={FadeIn.duration(theme.motion.base)}>
      <View
        testID={testID}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.radius.md,
          backgroundColor: bg,
        }}
      >
        <Icon icon={icon} size="md" color={fg} />
        <AppText variant="caption" style={{ color: fg, flex: 1, fontWeight: '600' }}>
          {message}
        </AppText>
      </View>
    </Animated.View>
  );
}
