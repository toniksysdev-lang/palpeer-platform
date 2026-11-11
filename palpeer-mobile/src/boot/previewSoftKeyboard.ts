import { Platform } from 'react-native';

/**
 * Bridge for the localhost:3333 phone-frame preview soft keyboard.
 * Parent shell shows a mobile keypad; this module opens/closes it on focus and
 * inserts keystrokes into the focused web input (cross-origin postMessage).
 *
 * Important: do NOT close the keypad on focusout. RN Web scroll-into-view and
 * layout updates briefly blur inputs, which made the keypad flash open then close
 * on every "My answer" tap. Close only when the user taps outside a text field
 * (or focuses an in-app number-pad field).
 */
const OPEN = 'palpeer-soft-keyboard-open';
const CLOSE = 'palpeer-soft-keyboard-close';
const KEY = 'palpeer-soft-keyboard-key';
const LAYOUT = 'palpeer-soft-keyboard-layout';
/** Dispatched on `window` when the :3333 phone-frame keypad opens/closes (with height). */
export const PREVIEW_KEYBOARD_EVENT = 'palpeer-preview-keyboard';

type KeyPayload = {
  type: typeof KEY;
  key?: string;
  code?: 'Backspace' | 'Enter' | 'Space';
};

type LayoutPayload = {
  type: typeof LAYOUT;
  open?: boolean;
  height?: number;
};

export type PreviewKeyboardDetail = { open: boolean; height: number };

function emitPreviewKeyboard(detail: PreviewKeyboardDetail) {
  try {
    window.dispatchEvent(new CustomEvent(PREVIEW_KEYBOARD_EVENT, { detail }));
  } catch {
    // Ignore if CustomEvent unavailable.
  }
}

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

function selectionRange(el: HTMLInputElement | HTMLTextAreaElement): { start: number; end: number } {
  try {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number') return { start, end };
  } catch {
    // Some browsers throw on password selection accessors.
  }
  const len = el.value.length;
  return { start: len, end: len };
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, next: string) {
  const nativeSet = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSet?.call(el, next);
}

function insertText(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const { start, end } = selectionRange(el);
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  setNativeValue(el, next);
  const caret = start + text.length;
  try {
    el.setSelectionRange(caret, caret);
  } catch {
    // Password fields may disallow setSelectionRange.
  }
  el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
}

function deleteBackward(el: HTMLInputElement | HTMLTextAreaElement) {
  const { start, end } = selectionRange(el);
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
  setNativeValue(el, next);
  try {
    el.setSelectionRange(caret, caret);
  } catch {
    // Password fields may disallow setSelectionRange.
  }
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
    // Prefer submitEditing / next-field handlers; do not force-blur (that blocked
    // moving from New password → Confirm new password in the preview keyboard).
    active.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }),
    );
    active.dispatchEvent(
      new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }),
    );
    return;
  }
  if (payload.code === 'Space') {
    insertText(active, ' ');
    return;
  }
  if (payload.key) insertText(active, payload.key);
}

let closeTimer: ReturnType<typeof setTimeout> | null = null;
let lastTextInput: HTMLInputElement | HTMLTextAreaElement | null = null;

function usesInAppNumberPad(el: HTMLElement): boolean {
  return el.getAttribute('data-palpeer-number-pad') === '1';
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  if (target.closest?.('input, textarea, [contenteditable="true"]')) return true;
  // RN Web often wraps the native input; tapping the field chrome should not close.
  if (target.closest?.('[data-palpeer-text-field="1"]')) return true;
  return false;
}

/**
 * Kept for FocusScroll callers. No longer gates close-on-blur (that path was removed).
 */
export function keepPreviewKeyboardFocus(_ms = 600) {
  // no-op — focusout no longer closes the keypad
}

function restoreLastTextInputFocus() {
  const el = lastTextInput;
  if (!el || !el.isConnected) return;
  if (document.activeElement === el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    try {
      el.focus();
    } catch {
      // Ignore.
    }
  }
}

function cancelClose() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function onFocusIn(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  cancelClose();
  lastTextInput = target;
  // Number-pad fields use the in-app keypad only — never the preview soft keyboard.
  if (usesInAppNumberPad(target) || (target.inputMode || '').toLowerCase() === 'none') {
    notifyParent({ type: CLOSE });
    return;
  }
  notifyParent({
    type: OPEN,
    mode: inputModeFor(target),
  });
}

/** Close only on an intentional tap outside text fields — never on transient focusout. */
function onPointerDownClose(event: Event) {
  if (isEditableTarget(event.target)) {
    cancelClose();
    return;
  }
  cancelClose();
  closeTimer = setTimeout(() => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      if (!usesInAppNumberPad(active) && (active.inputMode || '').toLowerCase() !== 'none') {
        return;
      }
    }
    notifyParent({ type: CLOSE });
  }, 50);
}

function onMessage(event: MessageEvent) {
  const data = event.data as (KeyPayload | LayoutPayload) | null;
  if (!data || typeof data !== 'object') return;
  if (data.type === KEY) {
    applyKey(data as KeyPayload);
    return;
  }
  if (data.type === LAYOUT) {
    const open = !!(data as LayoutPayload).open;
    const height = Math.max(0, Math.round((data as LayoutPayload).height ?? 0));
    emitPreviewKeyboard({ open, height: open ? height : 0 });
    if (open) {
      requestAnimationFrame(() => {
        restoreLastTextInputFocus();
        setTimeout(restoreLastTextInputFocus, 80);
      });
    }
  }
}

/** Install once when the Expo web app runs inside the phone-frame preview. */
export function installPreviewSoftKeyboard() {
  if (!isPreviewFrame() || typeof document === 'undefined') return;
  if ((window as Window & { __palpeerSoftKeyboard?: boolean }).__palpeerSoftKeyboard) return;
  (window as Window & { __palpeerSoftKeyboard?: boolean }).__palpeerSoftKeyboard = true;
  try {
    document.documentElement.setAttribute('data-palpeer-soft-kb', '1');
  } catch {
    // Ignore.
  }
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('mousedown', onPointerDownClose, true);
  document.addEventListener('touchstart', onPointerDownClose, true);
  window.addEventListener('message', onMessage);
}

installPreviewSoftKeyboard();
