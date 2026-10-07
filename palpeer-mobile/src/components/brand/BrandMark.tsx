import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeftRight } from 'lucide-react-native';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/providers/ThemeProvider';

type Props = {
  size?: 'md' | 'lg';
  showWordmark?: boolean;
};

/** Interim brand mark until the official logo assets are supplied (CFG-4). */
export function BrandMark({ size = 'md', showWordmark = true }: Props) {
  const theme = useTheme();
  const box = size === 'lg' ? 72 : 48;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
      accessibilityRole="image"
      accessibilityLabel="PALPEER"
    >
      <LinearGradient
        colors={[theme.colors.gradientStart, theme.colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: box,
          height: box,
          borderRadius: box / 3,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon icon={ArrowLeftRight} size={box / 2} color="#FFFFFF" strokeWidth={2.5} />
      </LinearGradient>
      {showWordmark ? (
        <AppText variant={size === 'lg' ? 'display' : 'h2'} style={{ letterSpacing: 1 }}>
          PALPEER
        </AppText>
      ) : null}
    </View>
  );
}
