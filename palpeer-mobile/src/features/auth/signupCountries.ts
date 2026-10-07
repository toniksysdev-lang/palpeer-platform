export type SignupCountry = {
  iso2: string;
  name: string;
  dialCode: string;
  flag: string;
};

/** Corridor countries shown on the globe / welcome illustration. */
export const SIGNUP_COUNTRIES: SignupCountry[] = [
  { iso2: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦' },
  { iso2: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸' },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧' },
  { iso2: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬' },
  { iso2: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭' },
  { iso2: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪' },
];

export const DEFAULT_SIGNUP_COUNTRY = SIGNUP_COUNTRIES[0]!;

/** Digits only from a national number field. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
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
