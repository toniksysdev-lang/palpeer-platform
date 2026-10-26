import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useFocusAnchor } from '@/components/layout/FocusScroll';
import { useTheme } from '@/providers/ThemeProvider';

import { AppText } from './AppText';
import { useNumberPadField, useOptionalNumberPad } from './NumberPadContext';
import { numberFieldTextInputProps, suppressSystemKeyboard } from './numberFieldInput';
import {
  digitsFromPasteEvent,
  extractDigits,
  readDigitsFromClipboard,
  requestParentClipboardPaste,
} from './pasteDigits';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  /** Called once all digits are entered. */
  onComplete?: (value: string) => void;
  length?: number;
  error?: string | null;
  /** When true, opens the shared pad on mount. Default false — pad opens on tap. */
  autoFocus?: boolean;
  editable?: boolean;
  testID?: string;
};

function webInputElement(ref: TextInput | null): HTMLElement | null {
  if (!ref || Platform.OS !== 'web') return null;
  const anyRef = ref as unknown as {
    getNode?: () => unknown;
    _node?: unknown;
  };
  const node = (typeof anyRef.getNode === 'function' ? anyRef.getNode() : null) ?? anyRef._node ?? ref;
  if (node && typeof (node as HTMLElement).tagName === 'string') {
    return node as HTMLElement;
  }
  return null;
}

/** Start clipboard read during press-in so the browser still has a user gesture. */
function beginWebClipboardRead(): Promise<string> | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    return null;
  }
  return navigator.clipboard.readText().catch(() => '');
}

/** OTP boxes driven by the shared in-app number pad. Digits are never logged. Paste is allowed. */
export function OtpInput({
  value,
  onChangeText,
  onComplete,
  length = 6,
  error,
  autoFocus = false,
  editable = true,
  testID,
}: Props) {
  const theme = useTheme();
  const sharedPad = useOptionalNumberPad();
  const inputRef = useRef<TextInput>(null);
  const pasteCaptureRef = useRef<TextInput>(null);
  const focusedRef = useRef(false);
  const armedRef = useRef(false);
  const webClipboardReadRef = useRef<Promise<string> | null>(null);
  const [focused, setFocused] = useState(false);
  /** Clipboard API blocked — show a real field the user can paste into. */
  const [pasteCaptureOpen, setPasteCaptureOpen] = useState(false);
  const [pasteCaptureValue, setPasteCaptureValue] = useState('');
  const { ref: anchorRef, reveal } = useFocusAnchor();

  const handleChange = useCallback(
    (next: string) => {
      const digits = extractDigits(next, length);
      onChangeText(digits);
      if (digits.length === length) {
        sharedPad?.close();
        armedRef.current = false;
        setPasteCaptureOpen(false);
        setPasteCaptureValue('');
        inputRef.current?.blur();
        pasteCaptureRef.current?.blur();
        onComplete?.(digits);
      }
    },
    [length, onChangeText, onComplete, sharedPad],
  );

  const applyDigits = useCallback(
    (digits: string) => {
      if (!digits) return false;
      handleChange(digits);
      setPasteCaptureOpen(false);
      setPasteCaptureValue('');
      return true;
    },
    [handleChange],
  );

  const openPasteCapture = useCallback(() => {
    armedRef.current = true;
    setPasteCaptureOpen(true);
    setPasteCaptureValue('');
    // Ask preview parent too (may succeed if permission was already granted).
    requestParentClipboardPaste();
    requestAnimationFrame(() => {
      pasteCaptureRef.current?.focus();
    });
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    if (!editable) return;
    armedRef.current = true;

    // Prefer the read started in onPressIn (still tied to the user gesture).
    let digits = '';
    const started = webClipboardReadRef.current;
    webClipboardReadRef.current = null;
    if (started) {
      digits = extractDigits(await started, length);
    }
    if (!digits) {
      digits = await readDigitsFromClipboard(length);
    }
    if (applyDigits(digits)) return;

    // Clipboard APIs are often blocked in the preview iframe / without permission.
    // A focused TextInput always accepts Ctrl/Cmd+V or OS paste.
    openPasteCapture();
  }, [applyDigits, editable, length, openPasteCapture]);

  const { select, active } = useNumberPadField({
    value,
    onChange: handleChange,
    maxLength: length,
    bottomLeft: '*',
    variant: 'phone',
    autoFocus,
    disabled: !editable,
    onAccessoryPress: editable ? () => void pasteFromClipboard() : undefined,
  });

  useEffect(() => {
    armedRef.current = active || pasteCaptureOpen;
  }, [active, pasteCaptureOpen]);

  const openPad = useCallback(() => {
    if (!editable) return;
    armedRef.current = true;
    inputRef.current?.focus();
    suppressSystemKeyboard();
    select();
    reveal();
  }, [editable, reveal, select]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const shouldAcceptPaste = (event: Event) => {
      if (!editable) return false;
      if (pasteCaptureOpen || armedRef.current || focusedRef.current || active) {
        const target = event.target as HTMLElement | null;
        const ours = webInputElement(inputRef.current);
        const capture = webInputElement(pasteCaptureRef.current);
        if (
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
          target !== ours &&
          target !== capture
        ) {
          // Allow when our paste-capture field is open (user may paste into it).
          return pasteCaptureOpen;
        }
        return true;
      }
      return false;
    };

    const onPaste = (event: Event) => {
      if (!shouldAcceptPaste(event)) return;
      const digits = digitsFromPasteEvent(event, length);
      if (!digits) return;
      event.preventDefault();
      event.stopPropagation();
      applyDigits(digits);
    };

    const onMessage = (event: MessageEvent) => {
      if (!editable) return;
      const data = event?.data;
      if (!data || typeof data !== 'object') return;
      if (data.type !== 'palpeer-paste-digits') return;
      const digits = extractDigits(String(data.text ?? data.digits ?? ''), length);
      if (!digits) return;
      applyDigits(digits);
    };

    document.addEventListener('paste', onPaste, true);
    window.addEventListener('message', onMessage);
    return () => {
      document.removeEventListener('paste', onPaste, true);
      window.removeEventListener('message', onMessage);
    };
  }, [active, applyDigits, editable, length, pasteCaptureOpen]);

  return (
    <View ref={anchorRef} collapsable={false} style={{ gap: theme.spacing.sm }}>
      <Pressable
        onPress={openPad}
        disabled={!editable}
        accessible={false}
        testID={testID ? `${testID}-cells` : undefined}
        style={[styles.row, { gap: theme.spacing.sm }]}
      >
        {Array.from({ length }, (_, index) => {
          const char = value[index] ?? '';
          const highlight =
            (active || focused || pasteCaptureOpen) &&
            index === Math.min(value.length, length - 1);
          const borderColor = error
            ? theme.colors.danger
            : highlight
              ? theme.colors.primary
              : char
                ? theme.colors.borderStrong
                : theme.colors.border;
          return (
            <View
              key={index}
              pointerEvents="none"
              style={[
                styles.cell,
                {
                  borderColor,
                  borderWidth: highlight ? 2 : 1,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <AppText variant="h2">{char}</AppText>
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          onFocus={() => {
            focusedRef.current = true;
            armedRef.current = true;
            setFocused(true);
            suppressSystemKeyboard();
            select();
            reveal();
          }}
          onBlur={() => {
            focusedRef.current = false;
            setFocused(false);
          }}
          editable={editable}
          caretHidden={Platform.OS !== 'web'}
          maxLength={256}
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          importantForAutofill="yes"
          accessibilityLabel={`Verification code, ${length} digits`}
          accessibilityHint={error ?? 'Enter or paste the verification code'}
          accessibilityValue={{ text: value }}
          testID={testID}
          style={styles.hiddenInput}
          {...numberFieldTextInputProps}
          {...(Platform.OS === 'web'
            ? {
                onPaste: (event: unknown) => {
                  const digits = digitsFromPasteEvent(event, length);
                  if (!digits) return;
                  const e = event as { preventDefault?: () => void };
                  e.preventDefault?.();
                  applyDigits(digits);
                },
              }
            : {})}
        />
      </Pressable>

      {editable ? (
        <Pressable
          onPressIn={() => {
            // Kick off clipboard read while the click still counts as a user gesture.
            webClipboardReadRef.current = beginWebClipboardRead();
          }}
          onPress={() => void pasteFromClipboard()}
          accessibilityRole="button"
          accessibilityLabel="Paste code from clipboard"
          testID={testID ? `${testID}-paste-link` : undefined}
          hitSlop={8}
        >
          <AppText variant="caption" tone="brand" align="center">
            Paste code
          </AppText>
        </Pressable>
      ) : null}

      {pasteCaptureOpen && editable ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="caption" tone="secondary" align="center">
            Clipboard blocked here — paste the email code below
          </AppText>
          <TextInput
            ref={pasteCaptureRef}
            value={pasteCaptureValue}
            onChangeText={(text) => {
              setPasteCaptureValue(text);
              const digits = extractDigits(text, length);
              if (digits) applyDigits(digits);
            }}
            placeholder="Paste code here"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            keyboardType="default"
            importantForAutofill="yes"
            accessibilityLabel="Paste verification code"
            testID={testID ? `${testID}-paste-capture` : undefined}
            style={[
              styles.pasteCapture,
              {
                borderColor: theme.colors.primary,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
                color: theme.colors.textPrimary,
                fontSize: 16,
              },
            ]}
            {...(Platform.OS === 'web'
              ? {
                  onPaste: (event: unknown) => {
                    const digits = digitsFromPasteEvent(event, length);
                    if (!digits) return;
                    const e = event as { preventDefault?: () => void };
                    e.preventDefault?.();
                    applyDigits(digits);
                  },
                }
              : {})}
          />
        </View>
      ) : null}

      {error ? (
        <AppText variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', position: 'relative' },
  cell: { width: 48, height: 56, alignItems: 'center', justifyContent: 'center' },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.02,
    color: 'transparent',
    zIndex: 2,
    fontSize: 16,
  },
  pasteCapture: {
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '600',
  },
});
