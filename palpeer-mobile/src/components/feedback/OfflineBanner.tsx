import { WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/providers/ThemeProvider';
import { useAppSelector } from '@/store';

export function OfflineBanner() {
  const isOnline = useAppSelector((state) => state.network.isOnline);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (isOnline !== false) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(theme.motion.base)}
      exiting={FadeOutUp.duration(theme.motion.base)}
      style={[
        styles.wrapper,
        { paddingTop: insets.top + theme.spacing.xs, backgroundColor: theme.colors.warning },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.row}>
        <WifiOff size={16} color={theme.colors.textInverse} />
        <Text style={[theme.typography.caption, styles.text, { color: theme.colors.textInverse }]}>
          You&apos;re offline. Balances may be out of date and money actions are paused.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  text: { flexShrink: 1, fontWeight: '600' },
});
