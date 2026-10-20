import { WORLD_COUNTRIES, type WorldCountry } from './worldCountries';

export type SignupCountry = WorldCountry;

/** Default corridor countries (also used when the public API is unreachable). */
export const SIGNUP_COUNTRIES: SignupCountry[] = [
  'CA',
  'US',
  'GB',
  'NG',
  'GH',
  'KE',
].map((iso2) => WORLD_COUNTRIES.find((c) => c.iso2 === iso2)!);

export const DEFAULT_SIGNUP_COUNTRY = SIGNUP_COUNTRIES[0]!;

export { WORLD_COUNTRIES, findWorldCountry } from './worldCountries';

/** Digits only from a national number field. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Display formatting for the national phone field (digits are stored unformatted).
 * CA/US: (506) 210-0661 — other corridors: grouped with spaces.
 */
export function formatNationalPhone(national: string, iso2 = 'CA'): string {
  const digits = digitsOnly(national).slice(0, 15);
  if (!digits) return '';
  const region = iso2.toUpperCase();
  if (region === 'CA' || region === 'US') {
    const d = digits.slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  // Progressive space grouping (3-3-rest) for other countries.
  const parts: string[] = [];
  if (digits.length <= 3) return digits;
  parts.push(digits.slice(0, 3));
  if (digits.length <= 6) {
    parts.push(digits.slice(3));
    return parts.join(' ');
  }
  parts.push(digits.slice(3, 6));
  parts.push(digits.slice(6));
  return parts.filter(Boolean).join(' ');
}

/** E.164-ish string for the register API (dial code + national digits). */
export function toE164(dialCode: string, national: string): string {
  const code = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  return `${code}${digitsOnly(national)}`;
}

/** Mask for OTP copy, e.g. `+1 (506) ***-***1`. */
export function maskPhone(e164: string): string {
  const digits = digitsOnly(e164);
  if (digits.length < 4) return e164;
  const last = digits.slice(-1);
  const countryLen = Math.min(3, Math.max(1, digits.length - 10));
  const country = digits.slice(0, countryLen);
  const area = digits.slice(countryLen, countryLen + 3);
  return `+${country} (${area}) ***-***${last}`;
}

/** Mask email for OTP copy, e.g. `ki***w******@gmail.com`. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;
  const start = local.slice(0, 2);
  const mid = local[Math.floor(local.length / 2)] ?? '';
  return `${start}***${mid}******@${domain}`;
}
