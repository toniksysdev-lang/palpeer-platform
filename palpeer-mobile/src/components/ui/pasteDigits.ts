import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

/**
 * Pull an OTP/PIN out of clipboard or paste text.
 * Prefers a contiguous run of exactly `maxLength` digits so email fluff like
 * "expires in 10 minutes" does not steal leading digits from the real code.
 */
export function extractDigits(raw: string | null | undefined, maxLength: number): string {
  if (!raw || maxLength <= 0) return '';
  const normalized = raw
    // Strip zero-width / soft-hyphen junk email clients insert between digits.
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    // Normalize common unicode spaces / separators copied from HTML email clients.
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    // Fullwidth digits → ASCII.
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));

  const runs = normalized.match(/\d+/g) ?? [];
  const exact = runs.find((run) => run.length === maxLength);
  if (exact) return exact;
  const longEnough = runs.find((run) => run.length > maxLength);
  if (longEnough) return longEnough.slice(0, maxLength);
  return runs.join('').slice(0, maxLength);
}

function isPreviewIframe(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.parent != null && window.parent !== window;
  } catch {
    return true;
  }
}

/**
 * Ask the :3333 preview shell to read the clipboard (parent can; the Expo iframe often cannot)
 * and post `palpeer-paste-digits` back.
 */
export function requestParentClipboardPaste(): boolean {
  if (!isPreviewIframe()) return false;
  try {
    window.parent.postMessage({ type: 'palpeer-request-clipboard-paste' }, '*');
    return true;
  } catch {
    return false;
  }
}

async function readClipboardRaw(): Promise<string> {
  // Web: call the browser Clipboard API first while the click user-gesture is still valid.
  // Awaiting expo-clipboard beforehand often burns the transient activation, so readText fails.
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      const fromNav = await navigator.clipboard.readText();
      if (fromNav) return fromNav;
    } catch {
      // Permissions / insecure context / cross-origin iframe.
    }
  }

  try {
    const fromExpo = await Clipboard.getStringAsync();
    if (fromExpo) return fromExpo;
  } catch {
    // Native module missing / denied.
  }

  return '';
}

/**
 * Reads the clipboard and returns digit-only text for OTP/PIN fields.
 * Returns empty string when the clipboard has no usable digits.
 */
export async function readDigitsFromClipboard(maxLength: number): Promise<string> {
  const raw = await readClipboardRaw();
  return extractDigits(raw, maxLength);
}

/** Best-effort paste payload from a DOM / RN-web paste event. */
export function digitsFromPasteEvent(event: unknown, maxLength: number): string {
  const e = event as {
    clipboardData?: { getData?: (type: string) => string };
    nativeEvent?: { clipboardData?: { getData?: (type: string) => string } };
  };
  const raw =
    e?.clipboardData?.getData?.('text/plain') ||
    e?.clipboardData?.getData?.('text') ||
    e?.nativeEvent?.clipboardData?.getData?.('text/plain') ||
    e?.nativeEvent?.clipboardData?.getData?.('text') ||
    '';
  return extractDigits(raw, maxLength);
}
