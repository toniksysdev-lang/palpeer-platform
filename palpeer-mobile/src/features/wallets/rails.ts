/**
 * VERIFIED: the backend hard-wires payment rails by currency (`ApayloPaymentRail` = CAD;
 * NGN funding + withdrawals prefer `KudaPaymentRail`, with `KorapayPaymentRail` as fallback).
 * Other currencies have no funding or withdrawal method. Whether a rail is currently enabled
 * can't be read by the app (contract-pending W-8); the backend decides that.
 */
const RAIL_BY_CURRENCY: Record<string, 'APAYLO' | 'KUDA' | 'KORAPAY'> = {
  CAD: 'APAYLO',
  NGN: 'KUDA',
};

export function railFor(currencyCode: string): 'APAYLO' | 'KUDA' | 'KORAPAY' | null {
  return RAIL_BY_CURRENCY[currencyCode.toUpperCase()] ?? null;
}

export function hasPaymentRail(currencyCode: string): boolean {
  return railFor(currencyCode) !== null;
}
