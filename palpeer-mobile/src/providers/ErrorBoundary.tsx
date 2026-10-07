import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Appearance, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { darkColors, lightColors, radius, spacing, typography } from '@/theme';
import { logger } from '@/utils/logger';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Last-resort boundary for render crashes. Follows the system colour scheme directly because the
 * theme provider may be the component that failed.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled render error', { message: error.message, stack: info.componentStack });
  }

  private reset = () => this.setState({ hasError: false });

  override render() {
    if (!this.state.hasError) return this.props.children;
    const colors = Appearance.getColorScheme() === 'dark' ? darkColors : lightColors;
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View accessibilityRole="alert" style={styles.content}>
          <Text maxFontSizeMultiplier={1.6} style={[styles.title, { color: colors.textPrimary }]}>
            Something went wrong
          </Text>
          <Text maxFontSizeMultiplier={1.6} style={[styles.body, { color: colors.textSecondary }]}>
            The app hit an unexpected problem. Try again, and if this keeps happening, restart the
            app.
          </Text>
          <Pressable
            onPress={this.reset}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text
              maxFontSizeMultiplier={1.6}
              style={[styles.buttonText, { color: colors.onPrimary }]}
            >
              Try again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: { ...typography.h2, marginBottom: spacing.sm, textAlign: 'center' },
  body: { ...typography.body, textAlign: 'center', marginBottom: spacing.lg },
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { ...typography.bodyStrong },
});
