import { useEffect, useRef, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { NumberPadDock, useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { useTheme } from '@/providers/ThemeProvider';

import { FocusScrollProvider, useFocusScroll } from './FocusScroll';
import { useInsideTabs } from './tabScreen';

/** Content stays readable on tablets and foldables instead of stretching edge to edge. */
const MAX_CONTENT_WIDTH = 640;

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /**
   * Forms need this so the keyboard / number pad never covers the focused input.
   * Defaults to true whenever `scroll` is set.
   */
  keyboardAware?: boolean;
  edges?: Edge[];
  padded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  footer?: ReactNode;
};

function ScreenScrollBody({
  children,
  contentContainerStyle,
  refreshControl,
  onDismissPad,
}: {
  children: ReactNode;
  contentContainerStyle: ViewStyle[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
  onDismissPad: () => void;
}) {
  const focusScroll = useFocusScroll();

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    focusScroll?.registerScrollOffset(event.nativeEvent.contentOffset.y);
  };

  return (
    <ScrollView
      ref={focusScroll?.scrollRef}
      style={styles.flex}
      contentContainerStyle={contentContainerStyle}
      // "always" so the first tap focuses password / text fields instead of only
      // dismissing the keyboard/pad (confirm-password was untappable otherwise).
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onScrollBeginDrag={onDismissPad}
    >
      {children}
    </ScrollView>
  );
}

export function Screen({
  children,
  scroll = false,
  keyboardAware,
  edges = ['top'],
  padded = true,
  refreshControl,
  footer,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const insideTabs = useInsideTabs();
  const numberPad = useOptionalNumberPad();
  const scrollRef = useRef<ScrollView>(null);
  const padOpen = !!numberPad?.active;
  const avoidKeyboard = keyboardAware ?? scroll;
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
    <FocusScrollProvider scrollRef={scrollRef}>
      <PadRevealOnOpen />
      <KeyboardRevealOnShow />
      <ScreenScrollBody
        contentContainerStyle={[
          column,
          {
            padding,
            paddingBottom: padding + (footer || padOpen ? 0 : bottomInset),
            gap: theme.spacing.lg,
            flexGrow: 1,
          },
        ]}
        refreshControl={refreshControl}
        onDismissPad={dismissPad}
      >
        {children}
      </ScreenScrollBody>
    </FocusScrollProvider>
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
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

/** After the shared number pad opens and layout shrinks, scroll the active field into view. */
function PadRevealOnOpen() {
  const numberPad = useOptionalNumberPad();
  const focusScroll = useFocusScroll();
  const activeId = numberPad?.active?.id;

  useEffect(() => {
    if (!activeId) return;
    const timer = setTimeout(() => focusScroll?.revealActive(), 80);
    return () => clearTimeout(timer);
  }, [activeId, focusScroll]);

  return null;
}

/** After the system keyboard finishes showing, re-measure the focused text field. */
function KeyboardRevealOnShow() {
  const focusScroll = useFocusScroll();

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => focusScroll?.revealActive(), Platform.OS === 'ios' ? 16 : 64);
    });
    return () => sub.remove();
  }, [focusScroll]);

  return null;
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
