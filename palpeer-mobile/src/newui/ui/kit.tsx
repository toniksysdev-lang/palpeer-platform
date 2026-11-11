import { router, type Href } from 'expo-router';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Keyboard,
  type KeyboardEvent,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FocusScrollProvider,
  useFocusAnchor,
  useFocusScroll,
} from '@/components/layout/FocusScroll';
import { numberPadMetrics } from '@/components/ui/NumberPad';
import {
  NumberPadDock,
  useNumberPadField,
  useOptionalNumberPad,
} from '@/components/ui/NumberPadContext';
import { numberFieldTextInputProps, suppressSystemKeyboard } from '@/components/ui/numberFieldInput';
import {
  keepPreviewKeyboardFocus,
  PREVIEW_KEYBOARD_EVENT,
  type PreviewKeyboardDetail,
} from '@/boot/previewSoftKeyboard';
import { useT } from '@/newui/lib/i18n';
import { useLayout } from '@/newui/lib/layout';
import { formatPhoneDisplay, normalizePhoneInput, PHONE_MAX_LEN } from '@/newui/lib/phone';
import { useListen } from '@/newui/lib/speech';
import { Palette, useC } from '@/newui/lib/theme';
import { Icon, IconName } from './Icon';

function wantsNumberPad(keyboardType?: TextInputProps['keyboardType']) {
  return keyboardType === 'number-pad' || keyboardType === 'phone-pad' || keyboardType === 'decimal-pad';
}

/* ---------- Text ---------- */

/** Keep one face across web/native even if a weight is still loading. */
const FONT: Record<string, string> = {
  '500': 'NotoSans_500Medium, Noto Sans, system-ui, sans-serif',
  '600': 'NotoSans_600SemiBold, Noto Sans, system-ui, sans-serif',
  '700': 'NotoSans_700Bold, Noto Sans, system-ui, sans-serif',
  '800': 'NotoSans_800ExtraBold, Noto Sans, system-ui, sans-serif',
};

type TxtProps = {
  children?: ReactNode;
  size?: number;
  w?: '500' | '600' | '700' | '800';
  color?: keyof Palette | string;
  style?: StyleProp<TextStyle>;
  center?: boolean;
  lh?: number;
  noTr?: boolean;
  lines?: number;
  role?: 'header' | 'alert' | 'text';
};

/** All text goes through Txt so it is translated when French is on. */
export function Txt({ children, size = 18, w = '600', color = 'text', style, center, lh = 1.3, noTr, lines, role }: TxtProps) {
  const c = useC();
  const t = useT();
  const { s } = useLayout();
  const prim = (x: ReactNode) => typeof x === 'string' || typeof x === 'number';
  let content: ReactNode = children;
  if (!noTr) {
    if (typeof children === 'string') content = t(children);
    else if (Array.isArray(children) && children.every(prim)) content = t(children.join(''));
  }
  const col = (c as Record<string, string>)[color as string] || color;
  const fs = s(size);
  return (
    <Text
      accessibilityRole={role === 'header' ? 'header' : role === 'alert' ? 'alert' : undefined}
      numberOfLines={lines}
      style={[
        {
          fontFamily: FONT[w],
          fontSize: fs,
          lineHeight: Math.round(fs * lh),
          color: col,
          textAlign: center ? 'center' : undefined,
          flexShrink: 1,
        },
        style,
      ]}
    >
      {content}
    </Text>
  );
}

export const H1 = (p: TxtProps) => <Txt size={30} w="800" lh={1.15} role="header" {...p} />;
export const H2 = (p: TxtProps) => <Txt size={24} w="800" lh={1.2} role="header" {...p} />;
export const P = (p: TxtProps) => <Txt size={18} w="600" color="text2" {...p} />;
export const Small = (p: TxtProps) => <Txt size={16} w="600" color="text2" {...p} />;

/* ---------- Layout ---------- */

/** Keep the focused text field above the system / preview soft keyboard. */
function KeyboardFocusReveal() {
  const focusScroll = useFocusScroll();
  useEffect(() => {
    if (!focusScroll) return undefined;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      const height = event.endCoordinates?.height ?? 0;
      // iOS KeyboardAvoidingView handles most of it; Android often stays full-height.
      focusScroll.setKeyboardBottomInset(Platform.OS === 'ios' ? 0 : height);
      setTimeout(() => focusScroll.revealActive(), Platform.OS === 'ios' ? 16 : 80);
    };
    const onHide = () => focusScroll.setKeyboardBottomInset(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    const revealSoon = () => {
      setTimeout(() => focusScroll.revealActive(), 80);
      setTimeout(() => focusScroll.revealActive(), 220);
    };

    // :3333 overlay keypad — update measure inset only (no React state: that re-layout blurs inputs).
    const onPreviewKeyboard = (event: Event) => {
      const detail = (event as CustomEvent<PreviewKeyboardDetail>).detail;
      if (!detail?.open) {
        focusScroll.setKeyboardBottomInset(0);
        return;
      }
      keepPreviewKeyboardFocus(800);
      focusScroll.setKeyboardBottomInset(Math.max(0, detail.height || 0));
      revealSoon();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener(PREVIEW_KEYBOARD_EVENT, onPreviewKeyboard as EventListener);
    }

    return () => {
      showSub.remove();
      hideSub.remove();
      focusScroll.setKeyboardBottomInset(0);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener(PREVIEW_KEYBOARD_EVENT, onPreviewKeyboard as EventListener);
      }
    };
  }, [focusScroll]);
  return null;
}

/** After the shared number pad opens and layout shrinks, scroll the active field into view. */
function PadRevealOnOpen() {
  const numberPad = useOptionalNumberPad();
  const focusScroll = useFocusScroll();
  const activeId = numberPad?.active?.id;

  useEffect(() => {
    if (!activeId || !focusScroll) return;
    const t1 = setTimeout(() => focusScroll.revealActive(), 80);
    const t2 = setTimeout(() => focusScroll.revealActive(), 220);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeId, focusScroll]);

  return null;
}

function ScreenScrollBody({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle: StyleProp<ViewStyle>;
}) {
  const focusScroll = useFocusScroll();
  const scrollRef = focusScroll?.scrollRef;
  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, width: '100%' }}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      onScroll={(e) => focusScroll?.registerScrollOffset(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
    >
      {children}
    </ScrollView>
  );
}

/** When true, Screen skips safe-area padding (nested under Overlay / tab SafeArea). */
const ScreenInsetCtx = createContext(true);

export function Screen({
  children,
  scroll,
  pad = true,
  gap = 14,
  bg,
  style,
  safe,
}: {
  children: ReactNode;
  scroll?: boolean;
  pad?: boolean;
  gap?: number;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  /** Override inset padding. Default: on for roots, off inside Overlay. */
  safe?: boolean;
}) {
  const c = useC();
  const { s, page, scale } = useLayout();
  const insets = useSafeAreaInsets();
  const inheritSafe = useContext(ScreenInsetCtx);
  const applySafe = safe ?? inheritSafe;
  const scrollRef = useRef<ScrollView>(null);
  const padX = pad ? s(16) : 0;
  const padTop = pad ? s(12) : 0;
  const inner: ViewStyle = {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: padX,
    paddingTop: padTop,
    // Static spare room so FocusScroll can lift fields above the overlay keypad
    // without changing padding on focus (that re-layout blurs inputs on web).
    paddingBottom: (pad ? s(16) : 0) + (scroll ? 240 : 0),
    gap: s(gap),
  };

  const body = scroll ? (
    <FocusScrollProvider scrollRef={scrollRef}>
      <KeyboardFocusReveal />
      <PadRevealOnOpen />
      <ScreenScrollBody contentContainerStyle={[inner, style]}>{children}</ScreenScrollBody>
    </FocusScrollProvider>
  ) : (
    <View style={[{ flex: 1, width: '100%' }, inner, style]}>{children}</View>
  );

  // Full-window shell + inset padding (not SafeAreaView) so LayoutProvider’s
  // usable-height scale matches :3333 instead of double-compressing the canvas.
  return (
    <View
      style={[
        page,
        {
          backgroundColor: bg || c.bg,
          paddingTop: applySafe ? insets.top : 0,
          paddingBottom: applySafe ? insets.bottom : 0,
          paddingLeft: applySafe ? insets.left : 0,
          paddingRight: applySafe ? insets.right : 0,
        },
      ]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {body}
        <NumberPadDock scale={scale} includeBottomInset={false} />
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * In-flow pad under Continue (My phone number). Claims the screen dock while mounted.
 * Uses a fixed dock height so the page above can scroll instead of being crushed.
 */
export function NumberPadSlot({ forId }: { forId?: string } = {}) {
  const pad = useOptionalNumberPad();
  const { scale } = useLayout();
  const fullHeight = numberPadMetrics(scale > 0 ? scale : 1).dockHeight;
  const activeId = pad?.active?.id;
  const match = !forId || activeId === forId;
  const show = Boolean(pad?.active && match);

  useEffect(() => {
    if (!pad) return undefined;
    pad.registerInlineHost();
    return () => pad.unregisterInlineHost();
  }, [pad]);

  if (!show) return null;

  return (
    <View
      style={{
        width: '100%',
        height: fullHeight,
        flexGrow: 0,
        flexShrink: 0,
      }}
    >
      <NumberPadDock
        host="inline"
        includeBottomInset={false}
        scale={scale}
        fitHeight
        contentStyle={{
          flex: 1,
          minHeight: 0,
          paddingTop: 6,
          paddingBottom: 6,
          paddingHorizontal: 0,
          backgroundColor: '#F3F6F4',
          justifyContent: 'flex-end',
        }}
      />
    </View>
  );
}

export const Row = ({ children, gap = 10, style, between }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; between?: boolean }) => {
  const { s } = useLayout();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(gap),
          justifyContent: between ? 'space-between' : undefined,
          width: between ? '100%' : undefined,
          maxWidth: '100%',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
export const Col = ({ children, gap = 4, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => {
  const { s } = useLayout();
  return <View style={[{ gap: s(gap), maxWidth: '100%' }, style]}>{children}</View>;
};
export const Spacer = () => <View style={{ flex: 1 }} />;

export function Card({ children, style, gap = 10, pad = 14, bg }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number; pad?: number; bg?: string }) {
  const c = useC();
  const { s } = useLayout();
  return (
    <View style={[{ backgroundColor: bg || c.card, borderRadius: s(20), padding: s(pad), gap: s(gap), width: '100%', maxWidth: '100%' }, style]}>
      {children}
    </View>
  );
}

export function Divider() {
  const c = useC();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}

/* ---------- Buttons ---------- */

type BtnKind = 'primary' | 'outline' | 'link' | 'ink' | 'soft' | 'danger' | 'light';
export function Btn({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  icon,
  size = 'big',
  style,
  a11y,
  testID,
  children,
}: {
  label?: string;
  onPress?: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  /** Shows spinner + "Loading" and blocks presses while an action runs. */
  busy?: boolean;
  icon?: IconName;
  size?: 'big' | 'mid' | 'small';
  style?: StyleProp<ViewStyle>;
  a11y?: string;
  testID?: string;
  children?: ReactNode;
}) {
  const c = useC();
  const t = useT();
  const { s } = useLayout();
  const h = s(size === 'big' ? 68 : size === 'mid' ? 60 : 52);
  const fs = size === 'big' ? 22 : size === 'mid' ? 19 : 17;
  const bgMap: Record<BtnKind, string> = {
    primary: c.brand,
    outline: 'transparent',
    link: 'transparent',
    ink: c.ink,
    soft: c.card,
    danger: c.redFill,
    light: c.white,
  };
  const fgMap: Record<BtnKind, string> = {
    primary: '#FFFFFF',
    outline: c.brandText,
    link: c.text,
    ink: c.onInk,
    soft: c.text,
    danger: '#FFFFFF',
    light: '#0B6E4F',
  };
  const blocked = !!(disabled || busy);
  const bg = blocked && kind !== 'link' && kind !== 'outline' ? c.off : bgMap[kind];
  const fg = blocked && (kind === 'link' || kind === 'outline') ? c.off : fgMap[kind];
  const shown = busy ? 'Loading' : label;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={a11y ? t(a11y) : busy ? 'Loading' : undefined}
      accessibilityState={{ disabled: blocked, busy: !!busy }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: kind === 'link' ? s(48) : h,
          maxWidth: '100%',
          borderRadius: s(size === 'big' ? 20 : 16),
          backgroundColor: bg,
          borderWidth: kind === 'outline' ? 3 : 0,
          borderColor: blocked ? c.off : c.brandText,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: s(10),
          paddingHorizontal: s(14),
          opacity: pressed && !busy ? 0.85 : 1,
          alignSelf: kind === 'link' ? undefined : 'stretch',
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={s(26)} color={fg} /> : null}
      {shown ? (
        <Txt size={kind === 'link' ? 17 : fs} w="800" color={fg} center style={kind === 'link' && !busy ? { textDecorationLine: 'underline' } : undefined}>
          {shown}
        </Txt>
      ) : null}
      {children}
    </Pressable>
  );
}

/** Round "pill" button used for Back and Listen in the top bar. */
export function Pill({ label, icon, onPress, dark, a11y }: { label: string; icon: IconName; onPress: () => void; dark?: boolean; a11y?: string }) {
  const c = useC();
  const t = useT();
  const { s } = useLayout();
  const fg = dark ? c.onInk : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ? t(a11y) : undefined}
      onPress={onPress}
      style={{
        height: s(48),
        maxWidth: '48%',
        paddingLeft: s(10),
        paddingRight: s(12),
        borderRadius: s(24),
        backgroundColor: dark ? c.ink : c.card,
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(6),
        flexShrink: 1,
      }}
    >
      <Icon name={icon} size={s(22)} color={fg} />
      <Txt size={16} w="700" color={fg} lines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Top bar with Back (left) and Listen (right). */
export function TopBar({ onBack, say, backLabel = 'Back', right }: { onBack?: (() => void) | false; say?: string; backLabel?: string; right?: ReactNode }) {
  const { listen, listenLabel } = useListen();
  const { s } = useLayout();
  return (
    <Row between style={{ minHeight: s(48), width: '100%' }}>
      {onBack === false ? <View /> : <Pill icon="back" label={backLabel} onPress={onBack || (() => (router.canGoBack() ? router.back() : router.replace('/Main' as Href)))} />}
      {right}
      {say !== undefined ? <Pill icon="listen" label={listenLabel} dark onPress={() => listen(say)} a11y="Listen to this screen" /> : null}
    </Row>
  );
}

/** A bordered choice row (radio style). */
export function Choice({ title, note, on, onPress, right, icon, minH = 72 }: { title: string; note?: string; on?: boolean; onPress: () => void; right?: ReactNode; icon?: ReactNode; minH?: number }) {
  const c = useC();
  const { s } = useLayout();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={{
        minHeight: s(minH),
        borderRadius: s(18),
        backgroundColor: c.card,
        borderWidth: 3,
        borderColor: on ? c.brandText : 'transparent',
        paddingHorizontal: s(14),
        paddingVertical: s(8),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(12),
        width: '100%',
        maxWidth: '100%',
      }}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={19} w="800">
          {title}
        </Txt>
        {note ? (
          <Txt size={15} w="600" color="text2">
            {note}
          </Txt>
        ) : null}
      </View>
      {right !== undefined ? right : on ? <Icon name="check" size={s(26)} color={c.brandText} /> : null}
    </Pressable>
  );
}

/* ---------- Inputs ---------- */

export function Field({
  label,
  value,
  onChangeText,
  big,
  center,
  style,
  format,
  maxLength,
  padKey,
  ...rest
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  big?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  /** `phone` shows `XXX XXX XXXX` while storing/emitting digits only. */
  format?: 'phone';
  maxLength?: number;
  padKey?: string;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'style' | 'maxLength'>) {
  const c = useC();
  const t = useT();
  const { s } = useLayout();
  const usePad = wantsNumberPad(rest.keyboardType);
  const isPhone = format === 'phone' || rest.keyboardType === 'phone-pad';
  const isDecimal = rest.keyboardType === 'decimal-pad';
  const padMax = maxLength ?? (isPhone ? PHONE_MAX_LEN : 32);
  const disabled = rest.editable === false;

  const emit = useMemo(() => {
    if (!isPhone) return onChangeText;
    return (raw: string) => onChangeText(normalizePhoneInput(raw));
  }, [isPhone, onChangeText]);

  const display = isPhone ? formatPhoneDisplay(value) : value;
  const pad = useNumberPadField({
    value: isPhone ? normalizePhoneInput(value) : value,
    onChange: emit,
    maxLength: Number.isFinite(padMax) && padMax > 0 ? padMax : 32,
    bottomLeft: isDecimal ? '.' : '',
    variant: 'phone',
    disabled: !usePad || disabled,
    padKey,
  });
  const padActive = usePad && pad.padAvailable;
  // System-keyboard fields (e.g. security-question answers) scroll above the soft keyboard.
  const focusAnchor = useFocusAnchor();

  return (
    <View
      ref={focusAnchor.ref}
      collapsable={false}
      // RN Web → data-palpeer-text-field="1" so outside-tap close ignores label/chrome taps.
      {...(Platform.OS === 'web' ? { dataSet: { palpeerTextField: '1' } } : null)}
      style={{ gap: s(6), width: '100%' }}
    >
      {label ? (
        <Txt size={16} w="700">
          {label}
        </Txt>
      ) : null}
      <TextInput
        value={display}
        onChangeText={emit}
        placeholderTextColor={c.text4}
        accessibilityLabel={label ? t(label) : undefined}
        {...rest}
        {...(padActive ? numberFieldTextInputProps : null)}
        maxLength={isPhone ? undefined : maxLength}
        placeholder={rest.placeholder ? t(rest.placeholder) : undefined}
        onFocus={(e) => {
          rest.onFocus?.(e);
          if (padActive) {
            suppressSystemKeyboard();
            pad.select();
            // Claim scroll focus so PadRevealOnOpen can lift this field above the pad.
            focusAnchor.activate();
            focusAnchor.reveal();
          } else if (Platform.OS === 'web') {
            // Mark target now; KeyboardFocusReveal scrolls after the keypad opens
            // (scrolling on focus used to blur the input and dismiss the keypad).
            focusAnchor.activate();
          } else {
            focusAnchor.reveal();
          }
        }}
        onPressIn={() => {
          if (padActive) {
            suppressSystemKeyboard();
            pad.select();
            focusAnchor.activate();
          }
        }}
        // RN Web: DOM click/focus does not always fire onPressIn — open the in-app pad explicitly.
        {...(padActive && Platform.OS === 'web'
          ? {
              onClick: () => {
                suppressSystemKeyboard();
                pad.select();
                focusAnchor.activate();
                focusAnchor.reveal();
              },
            }
          : null)}
        style={[
          {
            minHeight: s(big ? 68 : 52),
            width: '100%',
            borderRadius: s(14),
            backgroundColor: c.field,
            color: c.text,
            paddingHorizontal: s(12),
            fontFamily: FONT['700'],
            fontSize: s(big ? 28 : 18),
            textAlign: center ? 'center' : undefined,
            letterSpacing: big && !isPhone ? s(8) : 0,
            borderWidth: pad.active ? 3 : 0,
            borderColor: pad.active ? c.brandText : 'transparent',
          },
          style,
        ]}
      />
    </View>
  );
}

/** Amount / OTP-style TextInput wired to the shared in-app number pad. */
export function PadNumberInput({
  value,
  onChangeText,
  decimal,
  maxLength = 14,
  padKey,
  style,
  ...rest
}: {
  value: string;
  onChangeText: (v: string) => void;
  decimal?: boolean;
  maxLength?: number;
  padKey?: string;
  style?: StyleProp<TextStyle>;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'style' | 'keyboardType'>) {
  const c = useC();
  const pad = useNumberPadField({
    value,
    onChange: onChangeText,
    maxLength,
    bottomLeft: decimal ? '.' : '',
    variant: 'phone',
    padKey,
  });
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor={c.text4}
      {...rest}
      {...numberFieldTextInputProps}
      onFocus={(e) => {
        rest.onFocus?.(e);
        suppressSystemKeyboard();
        pad.select();
      }}
      onPressIn={() => {
        suppressSystemKeyboard();
        pad.select();
      }}
      style={[
        {
          borderBottomWidth: 3,
          borderColor: pad.active ? c.brandText : c.text,
          color: c.text,
        },
        style,
      ]}
    />
  );
}

/* ---------- PIN ---------- */

export function Dots({ n, of = 4 }: { n: number; of?: number }) {
  const c = useC();
  const { s } = useLayout();
  const d = s(22);
  return (
    <View accessible accessibilityLabel={`${n} of ${of} numbers`} style={{ flexDirection: 'row', justifyContent: 'center', gap: s(16), minHeight: s(26) }}>
      {Array.from({ length: of }).map((_, i) => (
        <View key={i} style={{ width: d, height: d, borderRadius: d / 2, borderWidth: 3, borderColor: c.text, backgroundColor: i < n ? c.text : 'transparent' }} />
      ))}
    </View>
  );
}

/** Number pad: 1-9, a left key (finger or blank), 0 and Delete. */
export function PinPad({
  onKey,
  onDel,
  left,
  testID,
}: {
  onKey: (k: string) => void;
  onDel: () => void;
  left?: { label: string; onPress: () => void };
  testID?: string;
}) {
  const c = useC();
  const { s } = useLayout();
  const key = (label: string, onPress: () => void, bg = c.card, fg = c.text, fs = 28, id?: string) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={onPress}
      testID={id}
      style={{ flexBasis: '31%', flexGrow: 1, minHeight: s(56), maxWidth: '33%', borderRadius: s(16), backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Txt size={fs} w="800" color={fg}>
        {label}
      </Txt>
    </Pressable>
  );
  return (
    <View
      testID={testID}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8), width: '100%', maxWidth: '100%' }}
    >
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) =>
        key(k, () => onKey(k), c.card, c.text, 28, testID ? `${testID}-pad-key-${k}` : undefined),
      )}
      {left ? (
        key(left.label, left.onPress, c.brand, '#FFFFFF', 15, testID ? `${testID}-pad-key-finger` : undefined)
      ) : (
        <View style={{ flexBasis: '31%', flexGrow: 1 }} />
      )}
      {key('0', () => onKey('0'), c.card, c.text, 28, testID ? `${testID}-pad-key-0` : undefined)}
      {key('Delete', onDel, c.key, c.text, 15, testID ? `${testID}-pad-key-back` : undefined)}
    </View>
  );
}

/* ---------- Misc ---------- */

export const FLAGS: Record<string, ImageSourcePropType> = {
  CA: require('../assets/flags/CA.png'),
  NG: require('../assets/flags/NG.png'),
  GB: require('../assets/flags/GB.png'),
  US: require('../assets/flags/US.png'),
  EU: require('../assets/flags/EU.png'),
  KE: require('../assets/flags/KE.png'),
  GH: require('../assets/flags/GH.png'),
  ZA: require('../assets/flags/ZA.png'),
};

/** Local asset when we ship one; otherwise flagcdn so Admin-enabled ISO2 codes still render. */
export function flagSource(cc: string): ImageSourcePropType {
  const code = String(cc || '').trim().toUpperCase();
  if (FLAGS[code]) return FLAGS[code]!;
  if (/^[A-Z]{2}$/.test(code)) {
    return { uri: `https://flagcdn.com/w80/${code.toLowerCase()}.png` };
  }
  return FLAGS.CA!;
}

export function Flag({ cc, w = 42, h }: { cc: string; w?: number; h?: number }) {
  const { s } = useLayout();
  const width = s(w);
  const height = h != null ? s(h) : Math.round((width * 2) / 3);
  return <Image source={flagSource(cc)} style={{ width, height, borderRadius: s(4) }} accessibilityIgnoresInvertColors />;
}

export function Badge({ children, tone = 'ok' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  const c = useC();
  const { s } = useLayout();
  const bg = tone === 'ok' ? c.okBg : tone === 'warn' ? c.warnBg : c.warnBg;
  const fg = tone === 'ok' ? c.deep : tone === 'warn' ? c.orange : c.red;
  return (
    <View accessibilityRole="alert" style={{ paddingHorizontal: s(12), paddingVertical: s(10), borderRadius: s(14), backgroundColor: bg, maxWidth: '100%' }}>
      <Txt size={17} w="800" color={fg}>
        {children}
      </Txt>
    </View>
  );
}

export function Circle({ icon, bg, size = 92, iconSize, color = '#FFFFFF' }: { icon: IconName; bg?: string; size?: number; iconSize?: number; color?: string }) {
  const c = useC();
  const { s } = useLayout();
  const dim = s(size);
  return (
    <View style={{ width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg || c.brand, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={iconSize != null ? s(iconSize) : Math.round(dim * 0.6)} color={color} />
    </View>
  );
}

/** Full screen result: big tick, title, text, then buttons. */
export function Done({ title, text, icon = 'check', bg, children, say }: { title: string; text?: string; icon?: IconName; bg?: string; children?: ReactNode; say?: string }) {
  return (
    <Screen>
      {say !== undefined ? <TopBar onBack={false} say={say} /> : null}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Circle icon={icon} bg={bg} />
        <H1 center>{title}</H1>
        {text ? <P center>{text}</P> : null}
      </View>
      {children}
    </Screen>
  );
}

export function Loading({ title, text }: { title: string; text?: string }) {
  const c = useC();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <ActivityIndicator size="large" color={c.brandText} />
      <H1 center role="alert">
        {title}
      </H1>
      {text ? <P center>{text}</P> : null}
    </View>
  );
}

/** Bottom sheet. */
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const c = useC();
  const { s } = useLayout();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.bg, borderTopLeftRadius: s(24), borderTopRightRadius: s(24), maxHeight: '88%', width: '100%' }}>
        <ScrollView contentContainerStyle={{ padding: s(16), gap: s(10), width: '100%' }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          {title ? (
            <Row between>
              <H2 style={{ flex: 1, minWidth: 0 }}>{title}</H2>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ width: s(52), height: s(52), borderRadius: s(26), backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={s(24)} color={c.text} />
              </Pressable>
            </Row>
          ) : null}
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Full-screen overlay used for steps that sit on top of a screen.
 * Uses an in-tree absolute view (not RN Modal) so PIN / system Modals can
 * present above it. Do not set a high zIndex — on web Stack screens share a
 * stacking context, and a raised overlay on the previous route covers the
 * pushed page until Back (Stay safe / More sheet links).
 */
export function Overlay({ open, children }: { open: boolean; children: ReactNode }) {
  const c = useC();
  const insets = useSafeAreaInsets();
  if (!open) return null;
  // Overlay already sits in a tab SafeArea (or full window). Nested Screens must
  // not re-apply insets — that crushed sheets on Android vs :3333 (insets ≈ 0).
  return (
    <ScreenInsetCtx.Provider value={false}>
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor: c.bg,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {children}
      </View>
    </ScreenInsetCtx.Provider>
  );
}

/** Label / value line used on check screens. */
export function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  const { s } = useLayout();
  return (
    <Row between style={{ minHeight: s(36), width: '100%' }}>
      <Txt size={17} w="600" color="text2" style={{ flexShrink: 1, minWidth: 0 }}>
        {k}
      </Txt>
      <Txt size={strong ? 22 : 18} w="800" noTr style={{ flexShrink: 1, textAlign: 'right', minWidth: 0 }}>
        {v}
      </Txt>
    </Row>
  );
}

export function Bullets({ items, color = 'text' }: { items: string[]; color?: string }) {
  return (
    <View style={{ gap: 2, width: '100%', maxWidth: '100%' }}>
      {items.map((item) => (
        <Row key={item} gap={8} style={{ alignItems: 'flex-start', width: '100%' }}>
          <Txt size={16} w="700" color={color}>
            •
          </Txt>
          <Txt size={16} w="600" color={color} style={{ flex: 1, minWidth: 0 }}>
            {item}
          </Txt>
        </Row>
      ))}
    </View>
  );
}
