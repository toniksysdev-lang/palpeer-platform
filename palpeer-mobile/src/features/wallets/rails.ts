/**
 * VERIFIED: the backend hard-wires one payment rail per currency (`ApayloPaymentRail` supports CAD,
 * `KudaPaymentRail` supports NGN). Other currencies have no funding or withdrawal method at all, so
 * the app doesn't start a money movement that nothing could ever complete. Whether a rail is
 * currently enabled can't be read by the app (contract-pending W-8); the backend decides that.
 */
const RAIL_BY_CURRENCY: Record<string, 'APAYLO' | 'KUDA'> = {
  CAD: 'APAYLO',
  NGN: 'KUDA',
};

export function railFor(currencyCode: string): 'APAYLO' | 'KUDA' | null {
  return RAIL_BY_CURRENCY[currencyCode.toUpperCase()] ?? null;
}

export function hasPaymentRail(currencyCode: string): boolean {
  return railFor(currencyCode) !== null;
}
