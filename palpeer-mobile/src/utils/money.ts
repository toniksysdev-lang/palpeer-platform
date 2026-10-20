import { Decimal } from 'decimal.js-light';

/** Decimal amount kept as its exact string form from the API. Never converted to a JS number. */
export type Money = string & { readonly __brand: 'Money' };

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;

export function isMoneyString(value: string): boolean {
  return DECIMAL_PATTERN.test(value.trim());
}

export function toMoney(value: string | number): Money {
  const text = typeof value === 'number' ? value.toString() : value.trim();
  if (!isMoneyString(text)) {
    throw new Error('Invalid decimal amount');
  }
  return new Decimal(text).toFixed() as Money;
}

export type FormatMoneyOptions = {
  currencyCode?: string;
  /** Decimal places from the backend currency `precision`. */
  precision?: number;
  showCurrency?: boolean;
  signDisplay?: 'auto' | 'always';
};

function groupThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Display-only formatting. Rounds half-even to `precision` without floating-point math. */
export function formatMoney(amount: Money | string, options: FormatMoneyOptions = {}): string {
  const { currencyCode, precision = 2, showCurrency = true, signDisplay = 'auto' } = options;
  const raw = typeof amount === 'string' ? amount.trim() : String(amount ?? '');
  const suffix = showCurrency && currencyCode ? ` ${currencyCode}` : '';
  if (!raw || !isMoneyString(raw)) {
    return showCurrency && currencyCode ? `—${suffix}` : '—';
  }
  const value = new Decimal(raw);
  const fixed = value.abs().toFixed(precision, Decimal.ROUND_HALF_EVEN);
  const [intPart = '0', fracPart] = fixed.split('.');
  const body = fracPart ? `${groupThousands(intPart)}.${fracPart}` : groupThousands(intPart);
  const negative = value.isNegative() && !value.isZero();
  const sign = negative ? '-' : signDisplay === 'always' && !value.isZero() ? '+' : '';
  return `${sign}${body}${suffix}`;
}

/** Rates are shown with more precision than amounts and without trailing noise. */
export function formatRate(rate: Money | string, maxDecimals = 6): string {
  const value = new Decimal(rate).toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_EVEN);
  return value.toFixed();
}

/** Input validation only (e.g. "> 0"); never used to derive amounts shown as authoritative. */
export function compareMoney(a: Money | string, b: Money | string): -1 | 0 | 1 {
  return new Decimal(a).comparedTo(new Decimal(b)) as -1 | 0 | 1;
}

export function isPositiveMoney(value: string): boolean {
  return isMoneyString(value) && new Decimal(value).greaterThan(0);
}
