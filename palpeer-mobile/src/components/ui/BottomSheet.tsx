import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  testID?: string;
};

const OFFSCREEN = 800;
const DISMISS_DISTANCE = 120;

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  dismissible = true,
  testID,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(OFFSCREEN);
  const backdrop = useSharedValue(0);

  if (visible && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (visible) {
      translateY.set(withTiming(0, { duration: theme.motion.slow }));
      backdrop.set(withTiming(1, { duration: theme.motion.slow }));
    } else {
      backdrop.set(withTiming(0, { duration: theme.motion.base }));
      translateY.set(
        withTiming(OFFSCREEN, { duration: theme.motion.base }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, translateY, backdrop, theme.motion.slow, theme.motion.base]);

  const requestClose = () => {
    if (dismissible) onClose();
  };

  const pan = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((event) => {
      translateY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > 1000) {
        scheduleOnRN(onClose);
      } else {
        translateY.set(withTiming(0, { duration: theme.motion.base }));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: theme.colors.overlay },
              backdropStyle,
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={requestClose}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
            />
          </Animated.View>
          <View style={styles.anchor} pointerEvents="box-none">
            <Animated.View
              testID={testID}
              accessibilityViewIsModal
              style={[
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderTopLeftRadius: theme.radius.xxl,
                  borderTopRightRadius: theme.radius.xxl,
                  paddingHorizontal: theme.spacing.xxl,
                  paddingBottom: insets.bottom + theme.spacing.xxl,
                  gap: theme.spacing.md,
                },
                theme.shadows.raised,
                sheetStyle,
              ]}
            >
              <GestureDetector gesture={pan}>
                <View style={[styles.handleArea, { paddingVertical: theme.spacing.md }]}>
                  <View style={[styles.handle, { backgroundColor: theme.colors.borderStrong }]} />
                </View>
              </GestureDetector>
              {title ? (
                <AppText variant="h3" accessibilityRole="header">
                  {title}
                </AppText>
              ) : null}
              {children}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  handleArea: { alignItems: 'center' },
  handle: { width: 40, height: 5, borderRadius: 3 },
});
