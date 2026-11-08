/** Design-screen currency display metadata (flags, symbols, names). */

export type DesignCurrencyMeta = {
  code: string;
  name: string;
  sym: string;
  dec: number;
  flag: string;
  /** Approximate units per 1 CAD for form-stage estimates before a real quote. */
  perCad: number;
  /** When false, the design treats the currency as coming soon. */
  on: boolean;
  word?: string;
  min?: number;
  chips?: number[];
  start?: string;
  step?: string;
};

export const DESIGN_CURRENCY_META: Record<string, DesignCurrencyMeta> = {
  CAD: {
    code: 'CAD',
    name: 'Canada dollars',
    sym: 'CA$',
    dec: 2,
    flag: '/_blob/4499372f3195512a69b5731cdaaa66f3',
    perCad: 1,
    on: true,
    word: 'dollars',
    min: 10,
    chips: [50, 100, 250, 500],
    start: '250',
    step: 'Choose Interac e-Transfer',
  },
  NGN: {
    code: 'NGN',
    name: 'Nigeria naira',
    sym: '₦',
    dec: 0,
    flag: '/_blob/b0568278bb1559ff18f7aa189fc24fbb',
    perCad: 1000,
    on: true,
    word: 'naira',
    min: 1000,
    chips: [1000, 5000, 10000, 50000],
    start: '5000',
    step: 'Choose bank transfer',
  },
  GBP: {
    code: 'GBP',
    name: 'UK pounds',
    sym: '£',
    dec: 2,
    flag: '/_blob/d57757535349edcee3c0e6559d8e18af',
    perCad: 0.55,
    on: false,
  },
  USD: {
    code: 'USD',
    name: 'USA dollars',
    sym: 'US$',
    dec: 2,
    flag: '/_blob/f1c757667bf015d587646348a7234036',
    perCad: 0.72,
    on: false,
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    sym: '€',
    dec: 2,
    flag: '/_blob/f050978e582fb620d0e544360c5f6036',
    perCad: 0.63,
    on: false,
  },
  KES: {
    code: 'KES',
    name: 'Kenya shillings',
    sym: 'KSh ',
    dec: 0,
    flag: '/_blob/1384a10fc0c90355e8e0733b7a1fee25',
    perCad: 95,
    on: false,
  },
  GHS: {
    code: 'GHS',
    name: 'Ghana cedis',
    sym: 'GH₵',
    dec: 2,
    flag: '/_blob/bf885323076af6563313a24874c79e3d',
    perCad: 8,
    on: false,
  },
  ZAR: {
    code: 'ZAR',
    name: 'South Africa rand',
    sym: 'R',
    dec: 2,
    flag: '/_blob/bfd3b62daa3a6f9b1e11015b102c69af',
    perCad: 13,
    on: false,
  },
};

export function metaFor(code: string): DesignCurrencyMeta {
  const known = DESIGN_CURRENCY_META[code];
  if (known) return known;
  return {
    code,
    name: code,
    sym: `${code} `,
    dec: 2,
    flag: DESIGN_CURRENCY_META.CAD!.flag,
    perCad: 1,
    on: true,
  };
}

export function formatDesignMoney(code: string, value: number): string {
  const m = metaFor(code);
  return (
    m.sym +
    value.toLocaleString('en-CA', {
      minimumFractionDigits: m.dec,
      maximumFractionDigits: m.dec,
    })
  );
}
