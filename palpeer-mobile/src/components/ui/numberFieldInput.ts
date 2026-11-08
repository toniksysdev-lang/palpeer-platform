import { Keyboard, Platform, type TextInputProps } from 'react-native';

/** DOM marker so the :3333 preview shell does not open its soft keyboard for pad fields. */
export const NUMBER_PAD_FIELD_ATTR = 'data-palpeer-number-pad';

/**
 * Shared props for in-app number fields: allow clipboard paste / autofill without opening
 * the OS phone or number keypad (digits come from {@link NumberPad}).
 *
 * Always `inputMode: 'none'` so mobile browsers and the preview soft keyboard stay closed;
 * digits come only from the in-app pad (clipboard paste still works on the focused field).
 */
export const numberFieldTextInputProps = {
  showSoftInputOnFocus: false,
  inputMode: 'none',
  keyboardType: 'default',
  contextMenuHidden: false,
  autoCorrect: false,
  spellCheck: false,
  // RN Web → data-palpeer-number-pad="1" on the underlying <input>.
  dataSet: { palpeerNumberPad: '1' },
} as const satisfies Partial<TextInputProps> & { dataSet?: Record<string, string> };

/**
 * Dismiss the system IME / preview soft keyboard. Digits for these fields come from NumberPad.
 * On web, Keyboard.dismiss() can blur the field — only notify the preview shell to close.
 */
export function suppressSystemKeyboard(): void {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'palpeer-soft-keyboard-close' }, '*');
      }
    } catch {
      // Cross-origin / missing parent.
    }
    return;
  }
  Keyboard.dismiss();
  if (Platform.OS === 'android') {
    requestAnimationFrame(() => Keyboard.dismiss());
  }
}
