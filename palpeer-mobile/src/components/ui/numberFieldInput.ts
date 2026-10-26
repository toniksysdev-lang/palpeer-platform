import { Keyboard, Platform, type TextInputProps } from 'react-native';

/**
 * Shared props for in-app number fields: allow clipboard paste / autofill without opening
 * the OS phone or number keypad (digits come from {@link NumberPad}).
 *
 * On web, `inputMode: 'none'` can block Ctrl/Cmd+V in some browsers — use `text` there so
 * paste still works while the in-app pad remains the digit source on native.
 */
export const numberFieldTextInputProps = {
  showSoftInputOnFocus: false,
  inputMode: Platform.OS === 'web' ? 'text' : 'none',
  keyboardType: 'default',
  contextMenuHidden: false,
  autoCorrect: false,
  spellCheck: false,
} as const satisfies Partial<TextInputProps>;

/**
 * Dismiss the system IME; some Android OEMs flash it even with showSoftInputOnFocus={false}.
 * Skip on web — Keyboard.dismiss() blurs the focused TextInput and breaks Ctrl/Cmd+V paste.
 */
export function suppressSystemKeyboard(): void {
  if (Platform.OS === 'web') return;
  Keyboard.dismiss();
  if (Platform.OS === 'android') {
    requestAnimationFrame(() => Keyboard.dismiss());
  }
}
