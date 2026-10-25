import { Platform } from 'react-native';

/**
 * Bridge for the localhost:3333 phone-frame preview soft keyboard.
 * Parent shell shows a mobile keypad; this module opens/closes it on focus and
 * inserts keystrokes into the focused web input (cross-origin postMessage).
 */
const OPEN = 'palpeer-soft-keyboard-open';
const CLOSE = 'palpeer-soft-keyboard-close';
const KEY = 'palpeer-soft-keyboard-key';

type KeyPayload = {
  type: typeof KEY;
  key?: string;
  code?: 'Backspace' | 'Enter' | 'Space';
};

function isPreviewFrame(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.parent != null && window.parent !== window;
  } catch {
    return true;
  }
}

function notifyParent(message: Record<string, unknown>) {
  try {
    window.parent?.postMessage(message, '*');
  } catch {
    // Ignore cross-origin / missing parent.
  }
}

function inputModeFor(el: HTMLElement): 'default' | 'numeric' | 'email' | 'phone' {
  const input = el as HTMLInputElement;
  const type = (input.type || '').toLowerCase();
  const mode = (input.inputMode || '').toLowerCase();
  if (type === 'email' || mode === 'email') return 'email';
  if (type === 'tel' || mode === 'tel' || mode === 'numeric' || mode === 'decimal') return 'phone';
  if (type === 'number' || mode === 'numeric' || mode === 'decimal') return 'numeric';
  return 'default';
}

function insertText(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  const nativeSet = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSet?.call(el, next);
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
}

function deleteBackward(el: HTMLInputElement | HTMLTextAreaElement) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  let next: string;
  let caret: number;
  if (start !== end) {
    next = el.value.slice(0, start) + el.value.slice(end);
    caret = start;
  } else if (start > 0) {
    next = el.value.slice(0, start - 1) + el.value.slice(end);
    caret = start - 1;
  } else {
    return;
  }
  const nativeSet = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSet?.call(el, next);
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }),
  );
}

function applyKey(payload: KeyPayload) {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return;
  if (active.readOnly || active.disabled) return;

  if (payload.code === 'Backspace') {
    deleteBackward(active);
    return;
  }
  if (payload.code === 'Enter') {
    active.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }),
    );
    if (active instanceof HTMLInputElement) active.blur();
    return;
  }
  if (payload.code === 'Space') {
    insertText(active, ' ');
    return;
  }
  if (payload.key) insertText(active, payload.key);
}

let blurTimer: ReturnType<typeof setTimeout> | null = null;

function onFocusIn(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }
  notifyParent({
    type: OPEN,
    mode: inputModeFor(target),
  });
}

function onFocusOut() {
  blurTimer = setTimeout(() => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    notifyParent({ type: CLOSE });
  }, 120);
}

function onMessage(event: MessageEvent) {
  const data = event.data as KeyPayload | null;
  if (!data || data.type !== KEY) return;
  applyKey(data);
}

/** Install once when the Expo web app runs inside the phone-frame preview. */
export function installPreviewSoftKeyboard() {
  if (!isPreviewFrame() || typeof document === 'undefined') return;
  if ((window as Window & { __palpeerSoftKeyboard?: boolean }).__palpeerSoftKeyboard) return;
  (window as Window & { __palpeerSoftKeyboard?: boolean }).__palpeerSoftKeyboard = true;
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  window.addEventListener('message', onMessage);
}

installPreviewSoftKeyboard();
