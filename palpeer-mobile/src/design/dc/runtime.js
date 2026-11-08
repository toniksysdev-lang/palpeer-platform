// Native runtime for the screens generated from the Palpeer design.
// It gives React Native the few web behaviours the design relies on:
// inherited text styles, CSS flex defaults, CSS grid, scrolling boxes, inline SVG
// with currentColor, the light/dark look, and fitting the 390×844 design to any phone.
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, Image, Platform, Linking, Keyboard,
  StatusBar, useWindowDimensions,
} from 'react-native';
import Svg, { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NUMBER_PAD_DOCK_HEIGHT } from '@/components/ui/NumberPad';
import {
  NumberPadDock,
  NumberPadInlineDock,
  useNumberPadField,
  useOptionalNumberPad,
} from '@/components/ui/NumberPadContext';
import { numberFieldTextInputProps, suppressSystemKeyboard } from '@/components/ui/numberFieldInput';

export { NumberPadInlineDock };

/** Hide sticky footer actions while the number pad is open. */
export function HideWhenNumberPad({ children }) {
  const pad = useOptionalNumberPad();
  if (pad?.active) return null;
  return children;
}

import { css } from './css';
import { ASSETS } from '../assets/registry';
import { DARK_BG, DARK_FG, DARK_BORDER, DARK_PAGE } from './theme';

export { css };

// The design was drawn for a 390×844 phone. FIT_TO_SCREEN shrinks UI to the app window
// safe area so every phone fits without clipping. Landing also flex-fills that height.
export const FIT_TO_SCREEN = true;
export const DESIGN_W = 390;
export const DESIGN_H = 844;

/* ------------------------------------------------------------------ logic base */

// The design's logic classes extend DCLogic: a React class component without render().
export class DCLogic extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
}

/* ------------------------------------------------------------------ contexts */

export const LookContext = createContext({ dark: true });
const ScaleContext = createContext(1);
const NavContext = createContext(() => {});
const TextContext = createContext({
  color: '#000000', fontSize: 16, fontWeight: '400', fontFamily: 'Noto Sans', inText: false,
});
const RowContext = createContext(false);
/** Hosts Home/History/Messages/More (and similar) outside the page ScrollView. */
const DockContext = createContext(null);
/** Lifts Back / Listen (and similar) into the Screen header above the scroll body. */
const HeaderContext = createContext(null);
/** Lets a screen paint the status-bar inset with a full-bleed header colour (e.g. landing #081410). */
const StatusBarBgContext = createContext(null);

export const useLook = () => useContext(LookContext);
/** Design-to-device scale (1 = 390×844). Use for raw RN views that skip DC.prep. */
export const useDesignScale = () => useContext(ScaleContext);

/**
 * In-flow number pad host. When `forId` is set, only shows (and claims the overlay)
 * while that design Input's pad is active — so the pad can sit under a specific field.
 * Without `forId`, behaves like the phone-number screen (any active pad).
 * Keys scale to the phone via design fit scale and shrink further to the slot height.
 */
export function PhoneNumberPadSlot({ forId } = {}) {
  const pad = useOptionalNumberPad();
  const scale = useDesignScale();
  const register = pad?.registerInlineHost;
  const unregister = pad?.unregisterInlineHost;
  const activeId = pad?.active?.id;
  const match = !forId || activeId === forId;
  const claim = Boolean(pad?.active && match);
  // Cap the slot so full-size keys cannot paint over Continue before fitHeight measures.
  const maxPadHeight = Math.round(NUMBER_PAD_DOCK_HEIGHT * (scale > 0 ? scale : 1));

  React.useEffect(() => {
    if (!claim || !register || !unregister) return undefined;
    register();
    return () => unregister();
  }, [claim, register, unregister]);

  if (!claim) return null;

  return (
    <View
      style={{
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minHeight: 0,
        maxHeight: maxPadHeight,
      }}
    >
      <NumberPadDock
        host="inline"
        includeBottomInset={false}
        scale={scale}
        fitHeight
        contentStyle={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minHeight: 0,
          maxHeight: '100%',
          justifyContent: 'flex-end',
          paddingHorizontal: 0,
          backgroundColor: '#F3F6F4',
        }}
      />
    </View>
  );
}

/** Paint Screen's top inset with `color` so full-bleed headers are not capped by a white/page strip. */
export function StatusBarBg({ color, children }) {
  const api = useContext(StatusBarBgContext);
  useLayoutEffect(() => {
    if (!api?.setColor) return undefined;
    api.setColor(color || null);
    return () => api.setColor(null);
  }, [api, color]);
  return children;
}

/* ------------------------------------------------------------------ helpers */

export const list = (x) => (Array.isArray(x) ? x : x == null ? [] : Object.values(x));
export const S = (x) => (x == null || x === false ? '' : String(x));

const TEXT_KEYS = [
  'color', 'fontSize', 'fontWeight', 'fontFamily', 'fontStyle', 'lineHeight', '_lhMul',
  'textAlign', 'letterSpacing', 'textTransform', 'textDecorationLine',
];
const INHERITED_TEXT = TEXT_KEYS.filter((k) => k !== 'textDecorationLine');
const SCALED = new Set([
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'top', 'left', 'right', 'bottom', 'rowGap', 'columnGap', 'flexBasis',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  'fontSize', 'lineHeight', 'letterSpacing',
]);
const BORDER_W = ['borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'];

function norm(c) { return typeof c === 'string' ? c.trim().toUpperCase() : c; }

// Light/dark + screen-fit scaling, applied to every style before it reaches React Native.
function prep(style, dark, scale) {
  if (!style) return {};
  const out = {};
  for (const k in style) {
    let v = style[k];
    if (v == null) continue;
    if (scale !== 1 && typeof v === 'number') {
      if (SCALED.has(k)) v = Math.round(v * scale * 100) / 100;
      else if (BORDER_W.includes(k) && v > 1) v = Math.max(1, Math.round(v * scale * 10) / 10);
    }
    if (dark) {
      if (k === 'backgroundColor') v = DARK_BG[norm(v)] || v;
      else if (k === 'color') v = DARK_FG[norm(v)] || v;
      else if (/^border.*Color$/.test(k)) v = DARK_BORDER[norm(v)] || v;
    }
    out[k] = v;
  }
  return out;
}

const NOTO = {
  '100': 'NotoSans_400Regular', '200': 'NotoSans_400Regular', '300': 'NotoSans_400Regular',
  '400': 'NotoSans_400Regular', '500': 'NotoSans_500Medium', '600': 'NotoSans_600SemiBold',
  '700': 'NotoSans_700Bold', '800': 'NotoSans_800ExtraBold', '900': 'NotoSans_800ExtraBold',
};

// Final text style: font file per weight, absolute line height.
function resolveText(t) {
  const out = {};
  for (const k of TEXT_KEYS) if (t[k] != null && k !== '_lhMul') out[k] = t[k];
  if (/noto sans/i.test(String(t.fontFamily || ''))) {
    out.fontFamily = NOTO[String(t.fontWeight || '400')] || NOTO['400'];
    delete out.fontWeight;
  } else if (t.fontFamily) {
    out.fontFamily = /mono/i.test(t.fontFamily) ? Platform.select({ ios: 'Menlo', default: 'monospace' }) : undefined;
  }
  if (t.lineHeight == null && t._lhMul != null && t.fontSize) out.lineHeight = Math.round(t._lhMul * t.fontSize * 100) / 100;
  return out;
}

function splitStyle(st) {
  const view = {};
  const text = {};
  for (const k in st) {
    if (k[0] === '_') continue;
    if (TEXT_KEYS.includes(k)) text[k] = st[k];
    else view[k] = st[k];
  }
  if (st._lhMul != null) text._lhMul = st._lhMul;
  return { view, text };
}

const A11Y_ROLES = { button: 'button', link: 'link', img: 'image', header: 'header', switch: 'switch', tab: 'tab', radio: 'radio', checkbox: 'checkbox', alert: 'alert', status: 'text', tablist: 'tablist' };

function a11y({ label, role, live, selected, checked, expanded, disabled }) {
  const p = {};
  if (label != null) p.accessibilityLabel = String(label);
  if (role && A11Y_ROLES[role]) p.accessibilityRole = A11Y_ROLES[role];
  if (live) p.accessibilityLiveRegion = live === 'assertive' ? 'assertive' : 'polite';
  const state = {};
  if (selected != null) state.selected = selected === true || selected === 'true';
  if (checked != null) state.checked = checked === true || checked === 'true';
  if (expanded != null) state.expanded = expanded === true || expanded === 'true';
  if (disabled != null) state.disabled = !!disabled;
  if (Object.keys(state).length) p.accessibilityState = state;
  return p;
}

function useEnv() {
  const { dark } = useContext(LookContext);
  const scale = useContext(ScaleContext);
  const inherited = useContext(TextContext);
  const parentRow = useContext(RowContext);
  const go = useContext(NavContext);
  return { dark, scale, inherited, parentRow, go };
}

function pressHandler(onPress, href, go) {
  if (href) return () => { if (onPress) onPress(); go(href); };
  if (onPress) return () => onPress();
  return undefined;
}

/* ------------------------------------------------------------------ Box (div, section, nav, button, a …) */

// kind: 'button' | 'link' | undefined. flow: children are inline content laid out in a line.
export function Box({ s, kind, flow, onPress, href, disabled, children, _cell, label, role, live, selected, checked, expanded }) {
  const { dark, scale, inherited, parentRow, go } = useEnv();
  const st = prep(s, dark, scale);
  const { view, text } = splitStyle(st);
  const display = st._display || 'block';
  if (display === 'block' && !flow && kind === 'button' && !text.textAlign) text.textAlign = 'center';
  const textCtx = useMemo(() => ({ ...inherited, ...text, inText: false }), [inherited, JSON.stringify(text)]);
  if (display === 'none') return null;

  if (display === 'flex') {
    if (!view.flexDirection) view.flexDirection = 'row';
  } else if (display === 'block') {
    view.flexDirection = 'column';
    if (flow) {
      view.flexDirection = 'row';
      view.flexWrap = 'wrap';
      view.alignItems = 'center';
      const ta = text.textAlign || inherited.textAlign;
      view.justifyContent = ta === 'center' ? 'center' : ta === 'right' ? 'flex-end' : 'flex-start';
    } else if (kind === 'button') {
      // HTML buttons centre their content.
      view.justifyContent = 'center';
    }
  }
  // CSS flex items shrink by default; React Native items do not.
  if (parentRow && view.flexShrink == null && view.width == null) view.flexShrink = 1;
  if (_cell && view.height == null) view.flexGrow = view.flexGrow ?? 1;
  const isRow = display === 'grid' ? false : String(view.flexDirection).startsWith('row');

  let content = children;
  if (display === 'grid') content = <GridRows cols={st._cols || 1} rowGap={view.rowGap} columnGap={view.columnGap}>{children}</GridRows>;
  if (display === 'grid') { delete view.rowGap; delete view.columnGap; }

  const wrapped = (
    <TextContext.Provider value={textCtx}>
      <RowContext.Provider value={isRow}>{content}</RowContext.Provider>
    </TextContext.Provider>
  );
  const ax = a11y({ label, role: role || (kind === 'link' ? 'link' : kind === 'button' ? 'button' : undefined), live, selected, checked, expanded, disabled: kind ? disabled : undefined });

  if (st._scroll) {
    const outer = {};
    const inner = {};
    const INNER = /^(padding|rowGap|columnGap|flexDirection|alignItems|justifyContent|flexWrap)/;
    for (const k in view) (INNER.test(k) ? inner : outer)[k] = view[k];
    const horizontal = st._scroll === 'x';
    if (horizontal) inner.flexDirection = inner.flexDirection || 'row';
    else if (inner.flexDirection && inner.flexDirection.startsWith('row')) inner.flexWrap = inner.flexWrap || 'nowrap';
    return (
      <ScrollView style={outer} contentContainerStyle={inner} horizontal={horizontal}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} {...ax}>
        {wrapped}
      </ScrollView>
    );
  }

  const handler = pressHandler(onPress, href, go);
  if (kind || handler) {
    return (
      <Pressable onPress={disabled ? undefined : handler} disabled={!!disabled}
        style={({ pressed }) => (pressed && handler && !disabled ? [view, { opacity: 0.82 }] : view)} {...ax}>
        {wrapped}
      </Pressable>
    );
  }
  return <View style={view} {...ax}>{wrapped}</View>;
}

/* ------------------------------------------------------------------ grid */

function flatten(children, out = []) {
  React.Children.forEach(children, (c) => {
    if (c == null || c === false) return;
    if (c.type === React.Fragment) flatten(c.props.children, out);
    else out.push(c);
  });
  return out;
}

function GridRows({ cols, rowGap = 0, columnGap = 0, children }) {
  const items = flatten(children);
  const rows = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <RowContext.Provider value={false}>
      <View style={{ rowGap }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', columnGap }}>
            {Array.from({ length: cols }).map((_, c) => (
              <View key={c} style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
                {row[c] ? (React.isValidElement(row[c]) && typeof row[c].type !== 'string' ? React.cloneElement(row[c], { _cell: true }) : row[c]) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </RowContext.Provider>
  );
}

/* ------------------------------------------------------------------ text */

export function T({ s, children, href, onPress, label, role, live, _cell }) {
  const { dark, scale, inherited, parentRow, go } = useEnv();
  const st = prep(s, dark, scale);
  const { view, text } = splitStyle(st);
  const merged = { ...inherited, ...text };
  // a unitless line-height set higher up is relative to *this* font size
  if (text.fontSize != null && text.lineHeight == null && text._lhMul == null && merged._lhMul != null) delete merged.lineHeight;
  if (text._lhMul != null) delete merged.lineHeight;
  const ctx = useMemo(() => ({ ...merged, inText: true }), [JSON.stringify(merged)]);
  if (st._display === 'none') return null;
  const resolved = resolveText(merged);
  if (!inherited.inText) {
    if (parentRow && view.flexShrink == null && view.width == null) view.flexShrink = 1;
    if (_cell && view.height == null) view.flexGrow = 1;
  }
  const handler = pressHandler(onPress, href, go);
  const nowrap = !!st._nowrap;
  const ax = a11y({ label, role: role || (href ? 'link' : undefined), live });
  return (
    <TextContext.Provider value={ctx}>
      <Text style={[view, resolved]} onPress={handler}
        numberOfLines={nowrap ? 1 : undefined} adjustsFontSizeToFit={nowrap || undefined}
        minimumFontScale={nowrap ? 0.6 : undefined} {...ax}>
        {children}
      </Text>
    </TextContext.Provider>
  );
}

/* ------------------------------------------------------------------ svg icons */

export function Icon({ w, h, s, children, label, ...svgProps }) {
  const { dark, scale, inherited } = useEnv();
  const st = prep(s, dark, scale);
  const { view } = splitStyle(st);
  const color = dark ? (DARK_FG[norm(inherited.color)] || inherited.color) : inherited.color;
  const W = typeof w === 'number' ? w * scale : w;
  const H = typeof h === 'number' ? h * scale : h;
  // Never put `accessible` on <Svg> — react-native-svg on web forwards it to the DOM
  // and React warns about non-boolean attributes. Keep a11y on a View wrapper instead.
  const icon = (
    <Svg width={W} height={H} color={color} style={label ? undefined : view} {...svgProps}>
      {children}
    </Svg>
  );
  if (!label) return icon;
  return (
    <View style={view} {...a11y({ label, role: 'img' })}>
      {icon}
    </View>
  );
}

/* ------------------------------------------------------------------ images */

export function Img({ src, s, alt }) {
  const { dark, scale } = useEnv();
  const st = prep(s, dark, scale);
  const { view } = splitStyle(st);
  const asset = ASSETS[src];
  if (!asset) return <View style={view} />;
  if (view.height == null && view.width != null && asset.ratio) view.aspectRatio = asset.ratio;
  const { boxShadow, position, top, left, right, bottom, margin, marginTop, marginRight, marginBottom, marginLeft,
    flexShrink, flexGrow, alignSelf, zIndex, ...inner } = view;
  const outer = { boxShadow, position, top, left, right, bottom, margin, marginTop, marginRight, marginBottom, marginLeft, flexShrink, flexGrow, alignSelf, zIndex,
    width: view.width, height: view.height, aspectRatio: view.aspectRatio,
    borderRadius: view.borderRadius };
  Object.keys(outer).forEach((k) => outer[k] === undefined && delete outer[k]);
  const fit = st._objectFit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
  // Omit accessible={false} — on web it leaks to the DOM and triggers a React warning.
  const a = alt ? { accessible: true, accessibilityRole: 'image', accessibilityLabel: alt } : {};
  if (asset.svg) {
    const xml = asset.svg.replace('<svg ', `<svg preserveAspectRatio="${fit}" `);
    return (
      <View style={outer} {...a}>
        <View style={{ ...inner, flex: 1, width: '100%', height: undefined, overflow: 'hidden' }}>
          <SvgXml xml={xml} width="100%" height="100%" />
        </View>
      </View>
    );
  }
  return (
    <View style={outer} {...a}>
      <Image source={asset.image} resizeMode={st._objectFit === 'cover' ? 'cover' : 'contain'}
        style={{ ...inner, width: '100%', height: '100%' }} />
    </View>
  );
}

/* ------------------------------------------------------------------ inputs */

const KEYBOARD = { numeric: 'number-pad', decimal: 'decimal-pad', email: 'email-address', tel: 'phone-pad' };

/** Same in-app number pad used for PIN / OTP / amounts — for design numeric fields. */
function usesNumberPad(inputMode) {
  return inputMode === 'numeric' || inputMode === 'decimal' || inputMode === 'tel';
}

export function Input({ s, value, onChange, inputMode, type, placeholder, maxLength, autoComplete, disabled, label, id }) {
  const { dark, scale, inherited } = useEnv();
  const st = prep(s, dark, scale);
  const { view, text } = splitStyle(st);
  const merged = { ...inherited, fontSize: 13.33 * scale, ...text };
  if (text._lhMul == null && text.lineHeight == null) delete merged.lineHeight;
  const tStyle = resolveText(merged);
  if (dark) tStyle.color = '#F1F5F3';
  // Mobile browsers zoom the whole page when focused inputs are < 16px — looks like a resize.
  // Keep the field tall enough for that floor so text is not clipped after scale.
  if (typeof tStyle.fontSize === 'number' && tStyle.fontSize < 16) tStyle.fontSize = 16;
  if (typeof view.minHeight === 'number' && typeof tStyle.fontSize === 'number') {
    view.minHeight = Math.max(view.minHeight, Math.ceil(tStyle.fontSize + 28));
  }
  const inputType = String(type || 'text');
  const stringValue = value == null ? '' : String(value);
  const parsedMax = maxLength != null && maxLength !== '' ? Number(maxLength) : NaN;
  const padMax = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 32;

  const emitChange = useCallback(
    (next) => {
      if (onChange) onChange({ target: { value: next, id }, currentTarget: { value: next, id } });
    },
    [onChange, id],
  );

  const wantPad = usesNumberPad(inputMode);
  const pad = useNumberPadField({
    value: stringValue,
    onChange: emitChange,
    maxLength: padMax,
    bottomLeft: inputMode === 'decimal' ? '.' : '',
    variant: 'phone',
    disabled: !!disabled || !wantPad,
    // Stable id so PhoneNumberPadSlot forId="rate" can sit under that field.
    padKey: id != null && id !== '' ? String(id) : undefined,
  });
  const sharedPad = useOptionalNumberPad();
  const usePad = wantPad && pad.padAvailable;

  return (
    <TextInput
      style={[{ paddingVertical: 0 }, view, tStyle]}
      value={stringValue}
      onChangeText={emitChange}
      keyboardType={
        usePad
          ? numberFieldTextInputProps.keyboardType
          : KEYBOARD[inputMode] || (inputType === 'email' ? 'email-address' : 'default')
      }
      secureTextEntry={inputType === 'password'}
      autoCapitalize={inputMode === 'email' || inputType === 'email' || inputType === 'password' ? 'none' : 'sentences'}
      autoCorrect={false}
      placeholder={placeholder}
      placeholderTextColor={dark ? '#7F8E87' : '#6B7A73'}
      maxLength={Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : undefined}
      textContentType={autoComplete === 'one-time-code' ? 'oneTimeCode' : undefined}
      autoComplete={autoComplete === 'one-time-code' ? 'sms-otp' : undefined}
      editable={!disabled}
      accessibilityLabel={label}
      // Keep typed text from growing/shrinking under Dynamic Type / browser text inflation.
      maxFontSizeMultiplier={1}
      onFocus={() => {
        if (usePad) {
          suppressSystemKeyboard();
          pad.select();
          return;
        }
        sharedPad?.close();
      }}
      {...(usePad
        ? {
            showSoftInputOnFocus: numberFieldTextInputProps.showSoftInputOnFocus,
            inputMode: numberFieldTextInputProps.inputMode,
            contextMenuHidden: numberFieldTextInputProps.contextMenuHidden,
            spellCheck: numberFieldTextInputProps.spellCheck,
          }
        : null)}
    />
  );
}

/* ------------------------------------------------------------------ sticky top header (Back / Listen) */

/**
 * Moves Back / Listen (and the title row when included) into the Screen header band —
 * above the scroll body, painted with the page background through the status-bar inset.
 */
export function StickyTop(props) {
  const header = useContext(HeaderContext);
  const tokenRef = React.useRef(null);
  const propsRef = React.useRef(props);
  propsRef.current = props;
  if (tokenRef.current == null) tokenRef.current = {};

  useLayoutEffect(() => {
    if (!header?.register) return undefined;
    const token = tokenRef.current;
    header.register(token, () => propsRef.current);
    return () => header.unregister(token);
  }, [header]);

  // In-tree placeholder; Screen paints the live header from the registered props.
  return (
    <Box
      {...props}
      s={{
        ...props.s,
        height: 0,
        minHeight: 0,
        maxHeight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        marginTop: 0,
        marginBottom: 0,
        overflow: 'hidden',
        opacity: 0,
      }}
      pointerEvents="none"
    />
  );
}

/* ------------------------------------------------------------------ sticky bottom dock (Main menu) */

/**
 * Home / History / Messages / More bar: sits at the bottom of the page column,
 * extends into the home-indicator inset, and tells Screen to drop its bottom pad
 * so the white bar is flush with the physical bottom (not floating above a gap).
 */
export function StickyBottom(props) {
  const dock = useContext(DockContext);
  const insets = useSafeAreaInsets();
  const scale = useContext(ScaleContext) || 1;
  const basePad = typeof props.s?.paddingBottom === 'number' ? props.s.paddingBottom : 10;

  useLayoutEffect(() => {
    if (!dock?.setHasDock) return undefined;
    dock.setHasDock(true);
    return () => dock.setHasDock(false);
  }, [dock]);

  return (
    <Box
      {...props}
      s={{
        ...props.s,
        flexShrink: 0,
        marginTop: props.s?.marginTop ?? 'auto',
        // insets.bottom is device px; divide by scale so prep() scaling yields the raw inset.
        paddingBottom: basePad + insets.bottom / (scale || 1),
      }}
    />
  );
}

/* ------------------------------------------------------------------ screen frame */

// Wraps one generated screen: safe areas, keyboard, fit-to-screen scale, links.
export function Screen({ bg = '#F3F6F4', go, children }) {
  const { dark } = useContext(LookContext);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pad = useOptionalNumberPad();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [hasDock, setHasDock] = useState(false);
  const [headerTick, setHeaderTick] = useState(0);
  const [statusBarBg, setStatusBarBg] = useState(null);
  const headerEntryRef = React.useRef({ token: null, getProps: null });
  // Lock fit scale on first real layout (and on rotation). Keyboard / focus / browser
  // chrome must never recompute scale — that was shrinking Log in fields and text.
  const [fitLock, setFitLock] = useState(null);
  // Real device safe-area only. Do not invent a web top inset — that painted a white/page
  // strip under the phone-frame notch (landing/login dark headers looked like a white header).
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  );
  const headerProps = headerEntryRef.current.getProps ? headerEntryRef.current.getProps() : null;
  const hasHeader = !!headerProps;
  const availW = Math.max(0, width - insets.left - insets.right);
  const availH = Math.max(0, height - topInset - insets.bottom);
  const dockApi = useMemo(() => ({ setHasDock }), []);
  const headerApi = useMemo(
    () => ({
      register(token, getProps) {
        headerEntryRef.current = { token, getProps };
        setHeaderTick((n) => n + 1);
      },
      unregister(token) {
        if (headerEntryRef.current.token !== token) return;
        headerEntryRef.current = { token: null, getProps: null };
        setHeaderTick((n) => n + 1);
      },
    }),
    [],
  );
  const statusBarApi = useMemo(() => ({ setColor: setStatusBarBg }), []);
  void headerTick;

  useEffect(() => {
    if (!(availW > 0 && availH > 0)) return;
    setFitLock((prev) => {
      const rotated =
        prev != null &&
        Math.abs(availW - prev.h) < 40 &&
        Math.abs(availH - prev.w) < 40;
      if (prev != null && !rotated) {
        // Keep scale forever; only remember the largest canvas we have seen.
        const canvasW = Math.max(prev.canvasW, availW);
        const canvasH = Math.max(prev.canvasH, availH);
        if (canvasW === prev.canvasW && canvasH === prev.canvasH) return prev;
        return { ...prev, canvasW, canvasH };
      }
      // First paint / rotation: fit once. Later keyboard height changes must not rescale.
      const fit = Math.min(availW / DESIGN_W, availH / DESIGN_H);
      const nextScale = FIT_TO_SCREEN ? Math.min(1, Math.max(0.72, fit || 1)) : 1;
      return {
        w: availW,
        h: availH,
        scale: nextScale,
        canvasW: availW,
        canvasH: Math.max(availH, Math.round(DESIGN_H * nextScale)),
      };
    });
  }, [availW, availH]);

  const scale = fitLock?.scale ?? (FIT_TO_SCREEN ? Math.min(1, Math.max(0.72, Math.min(availW / DESIGN_W || 1, availH / DESIGN_H || 1))) : 1);
  // Light mode: keep status-bar / header band on the design page colour — never white.
  const lightPage = !bg || norm(bg) === '#FFFFFF' ? '#F3F6F4' : bg;
  const pageBackground = dark ? (DARK_BG[norm(bg)] || DARK_PAGE) : lightPage;
  // Full-bleed headers (landing/login) may override the inset colour; never fall back to white.
  const chromeRaw = statusBarBg || pageBackground;
  const background =
    !dark && norm(chromeRaw) === '#FFFFFF' ? '#F3F6F4' : chromeRaw;
  const padOpen = !!pad?.active;
  const overlayPad = padOpen && (pad?.inlineHosts ?? 0) === 0;
  // Overlay pad only: reserve scroll room. Inline hosts (e.g. under Continue) live in content.
  const padScrollInset = overlayPad ? NUMBER_PAD_DOCK_HEIGHT * scale : 0;
  const keyboardOpen = keyboardHeight > 0;
  const canScroll = padOpen || keyboardOpen;
  // Canvas stays at the frozen phone height so focusing inputs cannot shrink the page.
  const canvasH = fitLock?.canvasH ?? Math.max(availH, Math.round(DESIGN_H * scale));
  // Wait out the opening tap so the new dismiss overlay does not eat the same press.
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
    const onShow = (event) => setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardHeight(0);
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: background,
        // Header band owns the status-bar inset so Back / Listen sit in the app header.
        paddingTop: hasHeader ? 0 : topInset,
        // Main menu paints into the bottom inset; other screens keep page padding.
        paddingBottom: hasDock ? 0 : insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      onTouchStart={() => globalThis.__dcEmit && globalThis.__dcEmit('pointerdown')}>
      {/* No KeyboardAvoidingView — it shrinks the page. Keyboard/pad overlay; content scrolls. */}
      <View style={{ flex: 1 }}>
        <DockContext.Provider value={dockApi}>
          <StatusBarBgContext.Provider value={statusBarApi}>
          <HeaderContext.Provider value={headerApi}>
            <NavContext.Provider value={go}>
              <ScaleContext.Provider value={scale}>
                <TextContext.Provider value={{ color: '#000000', fontSize: 16, fontWeight: '400', fontFamily: 'Noto Sans', _lhMul: 1.36, inText: false }}>
                  {hasHeader ? (
                    <View
                      style={{
                        paddingTop: topInset,
                        backgroundColor: background,
                      }}
                    >
                      <Box
                        {...headerProps}
                        s={{
                          ...headerProps.s,
                          // Header chrome uses the page colour above; never a white strip.
                          backgroundColor: 'transparent',
                          flexShrink: 0,
                          height: undefined,
                          minHeight: headerProps.s?.minHeight ?? 52,
                          maxHeight: undefined,
                          opacity: 1,
                          overflow: undefined,
                          marginTop: 0,
                          marginBottom: 0,
                          paddingTop:
                            typeof headerProps.s?.paddingTop === 'number'
                              ? headerProps.s.paddingTop
                              : 8,
                          paddingBottom:
                            typeof headerProps.s?.paddingBottom === 'number'
                              ? headerProps.s.paddingBottom
                              : 8,
                          paddingLeft:
                            typeof headerProps.s?.paddingLeft === 'number'
                              ? headerProps.s.paddingLeft
                              : 16,
                          paddingRight:
                            typeof headerProps.s?.paddingRight === 'number'
                              ? headerProps.s.paddingRight
                              : 16,
                        }}
                      />
                    </View>
                  ) : null}
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                      flexGrow: 1,
                      minHeight: hasHeader ? undefined : canvasH,
                      paddingBottom: padScrollInset + (keyboardOpen ? Math.min(keyboardHeight, canvasH * 0.45) : 0),
                    }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    // Never auto-shrink insets on focus — that was resizing Log in and other forms.
                    automaticallyAdjustKeyboardInsets={false}
                    showsVerticalScrollIndicator={false}
                    // Tab screens (Main menu) pin the footer; page body scrolls inside the screen.
                    scrollEnabled={canScroll || !hasDock}
                    bounces={canScroll}
                    onScrollBeginDrag={() => {
                      if (padOpen) pad?.close();
                    }}
                  >
                    {children}
                  </ScrollView>
                  {overlayPad && dismissArmed ? (
                    <Pressable
                      testID="number-pad-dismiss"
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss number pad"
                      onPress={() => pad?.close()}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: NUMBER_PAD_DOCK_HEIGHT * scale,
                        zIndex: 19,
                      }}
                    />
                  ) : null}
                  <View
                    pointerEvents="box-none"
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}
                  >
                    <NumberPadDock
                      includeBottomInset={false}
                      scale={scale}
                      contentStyle={{
                        paddingHorizontal: 16 * scale,
                        backgroundColor: background,
                      }}
                    />
                  </View>
                </TextContext.Provider>
              </ScaleContext.Provider>
            </NavContext.Provider>
          </HeaderContext.Provider>
          </StatusBarBgContext.Provider>
        </DockContext.Provider>
      </View>
    </View>
  );
}

export function openExternal(href) { Linking.openURL(href).catch(() => {}); }
