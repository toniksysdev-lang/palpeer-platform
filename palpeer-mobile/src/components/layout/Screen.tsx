import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { NumberPadDock, useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { useTheme } from '@/providers/ThemeProvider';

import { useInsideTabs } from './tabScreen';

/** Content stays readable on tablets and foldables instead of stretching edge to edge. */
const MAX_CONTENT_WIDTH = 640;

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Forms need this so the keyboard never covers the focused input or submit button. */
  keyboardAware?: boolean;
  edges?: Edge[];
  padded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  footer?: ReactNode;
};

export function Screen({
  children,
  scroll = false,
  keyboardAware = false,
  edges = ['top'],
  padded = true,
  refreshControl,
  footer,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const insideTabs = useInsideTabs();
  const numberPad = useOptionalNumberPad();
  const padOpen = !!numberPad?.active;
  const padding = padded ? theme.spacing.xl : 0;
  // Stack screens draw under the home indicator / Android navigation bar (edge-to-edge).
  const bottomInset = insideTabs || edges.includes('bottom') ? 0 : insets.bottom;
  // When the pad is open it owns the bottom safe area; don't double-pad the sticky footer.
  const footerBottomInset = padOpen ? 0 : bottomInset;
  const column: ViewStyle = { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' };
  const dismissPad = () => {
    if (padOpen) numberPad?.close();
  };

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        column,
        {
          padding,
          paddingBottom: padding + (footer || padOpen ? 0 : bottomInset),
          gap: theme.spacing.lg,
          flexGrow: 1,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={dismissPad}
      onTouchStart={dismissPad}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        column,
        {
          padding,
          paddingBottom: padding + (footer || padOpen ? 0 : bottomInset),
          gap: theme.spacing.lg,
        },
      ]}
      onTouchStart={dismissPad}
    >
      {children}
    </View>
  );

  const content = (
    <>
      {body}
      {footer ? (
        <View
          style={[
            column,
            {
              paddingHorizontal: padding,
              paddingBottom: theme.spacing.md + footerBottomInset,
            },
          ]}
          onTouchStart={dismissPad}
        >
          {footer}
        </View>
      ) : null}
      <NumberPadDock
        contentStyle={[
          column,
          {
            paddingHorizontal: padding,
          },
        ]}
      />
    </>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
