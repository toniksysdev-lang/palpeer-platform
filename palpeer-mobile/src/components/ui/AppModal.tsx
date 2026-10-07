import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { Button } from './Button';

type AppModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  /** Blocks backdrop/back dismissal while an action is in flight. */
  dismissible?: boolean;
  testID?: string;
};

export function AppModal({
  visible,
  onClose,
  title,
  children,
  dismissible = true,
  testID,
}: AppModalProps) {
  const theme = useTheme();
  const close = () => {
    if (dismissible) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Animated.View
        entering={FadeIn.duration(theme.motion.base)}
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
        />
        <Animated.View
          testID={testID}
          entering={ZoomIn.duration(theme.motion.base)}
          accessibilityViewIsModal
          style={[
            styles.dialog,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.xl,
              padding: theme.spacing.xxl,
              gap: theme.spacing.md,
            },
            theme.shadows.raised,
          ]}
        >
          <AppText variant="h2" accessibilityRole="header">
            {title}
          </AppText>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  return (
    <AppModal visible={visible} onClose={onCancel} title={title} dismissible={!loading}>
      <AppText tone="secondary">{message}</AppText>
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        <Button
          label={confirmLabel}
          variant={destructive ? 'danger' : 'primary'}
          onPress={onConfirm}
          loading={loading}
          loadingLabel="Please wait…"
          testID="confirm-dialog-confirm"
        />
        <Button
          label={cancelLabel}
          variant="ghost"
          onPress={onCancel}
          disabled={loading}
          testID="confirm-dialog-cancel"
        />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 420 },
});
