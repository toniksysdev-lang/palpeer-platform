import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { NUMBER_PAD_DOCK_HEIGHT } from '@/components/ui/NumberPad';
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
  scrollEnabled = true,
  showScrollIndicator = false,
  adjustKeyboardInsets = true,
}: {
  children: ReactNode;
  contentContainerStyle: ViewStyle[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
  onDismissPad: () => void;
  scrollEnabled?: boolean;
  showScrollIndicator?: boolean;
  adjustKeyboardInsets?: boolean;
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
      automaticallyAdjustKeyboardInsets={adjustKeyboardInsets}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={showScrollIndicator}
      scrollEnabled={scrollEnabled}
      bounces={scrollEnabled}
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const padOpen = !!numberPad?.active;
  const keyboardOpen = keyboardHeight > 0;
  // Allow scrolling whenever the in-app pad or system keyboard is up, even on non-scroll screens.
  const allowScroll = scroll || padOpen || keyboardOpen || keyboardAware === true;
  const padding = padded ? theme.spacing.xl : 0;
  // Stack screens draw under the home indicator / Android navigation bar (edge-to-edge).
  const bottomInset = insideTabs || edges.includes('bottom') ? 0 : insets.bottom;
  // Sticky footer owns the bottom safe area; the number pad sits above it without double-padding.
  const footerBottomInset = bottomInset;
  const column: ViewStyle = { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' };
  const dismissPad = () => {
    if (padOpen) numberPad?.close();
  };
  // Overlay pad — only add scroll padding so the page canvas does not shrink.
  // Inline hosts render the pad in-flow; no full-screen dismiss layer for those.
  const overlayPad = padOpen && (numberPad?.inlineHosts ?? 0) === 0;
  const padScrollInset = overlayPad ? NUMBER_PAD_DOCK_HEIGHT : 0;
  const footerOffset = footer ? theme.spacing.md + footerBottomInset + 56 : 0;
  // Arm the outside-tap layer only after the opening tap finishes — otherwise the same
  // press that focused the field lands on the new overlay and immediately closes the pad.
  const [dismissArmed, setDismissArmed] = useState(false);
  useEffect(() => {
    if (!overlayPad) {
      setDismissArmed(false);
      return undefined;
    }
    const timer = setTimeout(() => setDismissArmed(true), 320);
    return () => clearTimeout(timer);
  }, [overlayPad]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => setKeyboardHeight(event.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const body = (
    <FocusScrollProvider scrollRef={scrollRef}>
      <PadRevealOnOpen />
      <KeyboardRevealOnShow />
      <ScreenScrollBody
        contentContainerStyle={[
          column,
          {
            padding,
            paddingBottom:
              padding +
              padScrollInset +
              (footer && overlayPad ? footerOffset : 0) +
              (footer || overlayPad ? 0 : bottomInset),
            gap: theme.spacing.lg,
            flexGrow: 1,
          },
        ]}
        refreshControl={refreshControl}
        onDismissPad={dismissPad}
        scrollEnabled={allowScroll}
        showScrollIndicator={false}
        // Never auto-shrink the page when an input is focused.
        adjustKeyboardInsets={false}
      >
        {children}
      </ScreenScrollBody>
    </FocusScrollProvider>
  );

  const content = (
    <View style={styles.flex}>
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
      {overlayPad && dismissArmed ? (
        <Pressable
          testID="number-pad-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Dismiss number pad"
          onPress={dismissPad}
          style={[
            styles.padDismiss,
            footer ? { bottom: footerOffset + NUMBER_PAD_DOCK_HEIGHT } : { bottom: NUMBER_PAD_DOCK_HEIGHT },
          ]}
        />
      ) : null}
      {/* Overlay — must not sit in flex flow or the page shrinks when the pad opens. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.padOverlay,
          footer ? { bottom: footerOffset } : null,
        ]}
      >
        <NumberPadDock
          includeBottomInset={!footer}
          contentStyle={[
            column,
            {
              paddingHorizontal: padding,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
        />
      </View>
    </View>
  );

  // No KeyboardAvoidingView — padding/height behaviors resize the page on focus.
  // FocusScroll + scroll padding keep fields reachable above the keyboard/pad.
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      {content}
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
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => {
      const height = event.endCoordinates?.height ?? 0;
      // Android edge-to-edge often keeps the window full-height; subtract overlap when measuring.
      focusScroll?.setKeyboardBottomInset(Platform.OS === 'android' ? height : 0);
      setTimeout(() => focusScroll?.revealActive(), Platform.OS === 'ios' ? 16 : 64);
    };
    const onHide = () => {
      focusScroll?.setKeyboardBottomInset(0);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
      focusScroll?.setKeyboardBottomInset(0);
    };
  }, [focusScroll]);

  return null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padDismiss: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 19,
  },
  padOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
  },
});
