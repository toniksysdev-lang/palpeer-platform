/** Digits only from a typed phone value. */
export const phoneDigits = (v: string) => v.replace(/[^0-9]/g, '');

/** National phone length used across registration countries. */
export const PHONE_MAX_LEN = 10;

/**
 * Display format for a national number: `XXX XXX XXXX` (spaces only; store digits separately).
 */
export function formatPhoneDisplay(raw: string): string {
  const d = phoneDigits(raw).slice(0, PHONE_MAX_LEN);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Accept pad/OS input and keep at most {@link PHONE_MAX_LEN} digits. */
export function normalizePhoneInput(raw: string): string {
  return phoneDigits(raw).slice(0, PHONE_MAX_LEN);
}
