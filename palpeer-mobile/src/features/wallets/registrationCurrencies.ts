import { WORLD_COUNTRIES } from '@/features/auth/worldCountries';

import { hasPaymentRail } from './rails';

/**
 * Primary wallet currency for each registration country (ISO 3166-1 alpha-2 → ISO 4217).
 * Mirrors the admin Registration countries corridor; New wallet lists every enabled country
 * that maps here. Create is allowed only when that currency exists in `GET /currencies` and
 * has a payment processor implemented on the backend (CAD/Apaylo, NGN/Kuda).
 */
export const REGISTRATION_COUNTRY_CURRENCY: Readonly<Record<string, string>> = {
  CA: 'CAD',
  US: 'USD',
  GB: 'GBP',
  NG: 'NGN',
  GH: 'GHS',
  KE: 'KES',
  // Common extras admins may enable when the currency is seeded
  IE: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  NL: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  PT: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
  AU: 'AUD',
  NZ: 'NZD',
  ZA: 'ZAR',
  IN: 'INR',
};

/** Representative country (or EU) used for the wallet flag for a currency. */
export const CURRENCY_FLAG_COUNTRY: Readonly<Record<string, string>> = {
  CAD: 'CA',
  USD: 'US',
  GBP: 'GB',
  NGN: 'NG',
  GHS: 'GH',
  KES: 'KE',
  EUR: 'EU',
  AUD: 'AU',
  NZD: 'NZ',
  ZAR: 'ZA',
  INR: 'IN',
};

export type RegistrationWalletOption = {
  currencyCode: string;
  countryIso2: string;
  countryName: string;
  flagEmoji: string;
  /** True when the currency is on the platform and a payment rail is implemented. */
  creatable: boolean;
};

/** Unique currency codes for the given registration country list (order preserved). */
export function currencyCodesForRegistrationCountries(
  iso2Codes: readonly string[] | undefined | null,
): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const raw of iso2Codes ?? []) {
    if (!raw) continue;
    const currency = REGISTRATION_COUNTRY_CURRENCY[raw.trim().toUpperCase()];
    if (!currency || seen.has(currency)) continue;
    seen.add(currency);
    codes.push(currency);
  }
  return codes;
}

/** Keep currencies that are both platform-supported and allowed by registration countries. */
export function filterCurrenciesByRegistrationCountries<T extends { code: string }>(
  currencies: readonly T[],
  iso2Codes: readonly string[] | undefined | null,
): T[] {
  const allowed = new Set(currencyCodesForRegistrationCountries(iso2Codes));
  if (allowed.size === 0) return [];
  return currencies.filter((currency) => allowed.has(currency.code.toUpperCase()));
}

export function countryIso2ForCurrency(currencyCode: string): string | null {
  return CURRENCY_FLAG_COUNTRY[currencyCode.trim().toUpperCase()] ?? null;
}

function countryMeta(iso2: string): { name: string; flag: string } {
  const code = iso2.toUpperCase();
  if (code === 'EU') return { name: 'Eurozone', flag: '🇪🇺' };
  const match = WORLD_COUNTRIES.find((country) => country.iso2 === code);
  return { name: match?.name ?? code, flag: match?.flag ?? '🏳️' };
}

/**
 * Enabled registration countries for New wallet: one row per country from admin settings.
 * Hides countries whose currency the user already holds. Countries without a platform
 * currency or without an implemented payment processor still appear (creatable=false) so
 * the list matches Registration countries — same source as signup.
 */
export function remainingRegistrationWalletOptions(args: {
  registrationIso2: readonly string[] | undefined | null;
  platformCurrencyCodes: readonly string[];
  heldCurrencyCodes: readonly string[];
}): RegistrationWalletOption[] {
  const platform = new Set(
    args.platformCurrencyCodes.map((code) => code.trim().toUpperCase()).filter(Boolean),
  );
  const held = new Set(
    args.heldCurrencyCodes.map((code) => code.trim().toUpperCase()).filter(Boolean),
  );
  const options: RegistrationWalletOption[] = [];

  for (const raw of args.registrationIso2 ?? []) {
    if (!raw) continue;
    const countryIso2 = raw.trim().toUpperCase();
    const currencyCode = REGISTRATION_COUNTRY_CURRENCY[countryIso2];
    if (!currencyCode) continue;
    if (held.has(currencyCode)) continue;
    const meta = countryMeta(countryIso2);
    options.push({
      currencyCode,
      countryIso2,
      countryName: meta.name,
      flagEmoji: meta.flag,
      creatable: platform.has(currencyCode) && hasPaymentRail(currencyCode),
    });
  }
  return options;
}
