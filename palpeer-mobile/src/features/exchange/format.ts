import { Decimal } from 'decimal.js-light';

import type { WalletResponse } from '@/types/api/wallet';

/** Display-only: rates carry up to 12 decimals; they're rounded half-even for reading. */
export const RATE_DISPLAY_DECIMALS = 6;

function groupThousands(integerPart: string): string {
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "1,089.451234" — trailing zeros dropped, never through a JS float. */
export function formatRateValue(rate: string, maxDecimals = RATE_DISPLAY_DECIMALS): string {
  const fixed = new Decimal(rate).toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_EVEN).toFixed();
  const [intPart = '0', fracPart = ''] = fixed.split('.');
  const trimmedFrac = fracPart.replace(/0+$/, '');
  return trimmedFrac
    ? `${groupThousands(intPart)}.${trimmedFrac}`
    : groupThousands(intPart);
}

/** "1 CAD = 1,089.45 NGN" using the backend `appliedRate` (target units per source unit). */
export function formatRateLine(
  appliedRate: string,
  sourceCode: string,
  targetCode: string,
): string {
  return `1 ${sourceCode} = ${formatRateValue(appliedRate)} ${targetCode}`;
}

/** The exchange needs two wallets in different currencies (R-X-1, R-X-7). */
export function canExchange(wallets: readonly WalletResponse[]): boolean {
  return new Set(wallets.map((wallet) => wallet.currencyCode)).size >= 2;
}

/** Remaining whole seconds until `expiresAt`, never negative. */
export function secondsUntil(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}
