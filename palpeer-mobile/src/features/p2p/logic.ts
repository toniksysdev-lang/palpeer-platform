import { Decimal } from 'decimal.js-light';

import { formatRateValue } from '@/features/exchange/format';
import type {
  P2POrderResponse,
  P2PRequestResponse,
  P2PSide,
  P2PStatus,
  UpdateP2PRequest,
} from '@/types/api/p2p';
import { compareMoney, isPositiveMoney, toMoney } from '@/utils/money';

/**
 * Neutral wording while BUY/SELL semantics are pending (R-P-6, P-1): the side is read as the
 * owner's intent for the base currency, paid in the quote currency.
 */
export function sideLabel(
  side: P2PSide,
  base: string,
  quote: string,
  owner: 'self' | 'other',
): string {
  const verb = side === 'BUY' ? 'buy' : 'sell';
  return owner === 'self'
    ? `You want to ${verb} ${base} for ${quote}`
    : `Wants to ${verb} ${base} for ${quote}`;
}

/** Preferred "1" side for entry/display: CAD when present, otherwise the pair's base. */
export const RATE_ANCHOR_CODE = 'CAD';

/** Input limit matching backend `p2p_requests.rate` scale (12 decimals). */
export const RATE_INPUT_DECIMALS = 12;

export function preferredRateUnit(leftCode: string, rightCode: string): string {
  const left = leftCode.toUpperCase();
  const right = rightCode.toUpperCase();
  if (left === RATE_ANCHOR_CODE || right === RATE_ANCHOR_CODE) return RATE_ANCHOR_CODE;
  return left;
}

/** The other currency in a two-sided pair (preserves the casing of the unmatched side). */
export function otherOfPair(unitCode: string, leftCode: string, rightCode: string): string {
  return unitCode.toUpperCase() === leftCode.toUpperCase() ? rightCode : leftCode;
}

/** Reciprocal rounded to the backend rate scale (12 dp), half-even. */
export function invertRate(rate: string): string {
  return new Decimal(1)
    .div(new Decimal(rate))
    .toDecimalPlaces(12, Decimal.ROUND_HALF_EVEN)
    .toFixed();
}

/**
 * Exact reciprocal for rate-unit flipping. Does not truncate first — truncating to 12 dp then
 * inverting again cannot recover values like 980 (1/980 → 0.001020408163 → 980.0000002548).
 */
export function invertRateExact(rate: string): string {
  return new Decimal(1).div(new Decimal(rate)).toFixed();
}

/** Last exact rate the user typed, keyed by the unit that was "1" when they typed it. */
export type RateEntryAnchor = {
  unitCode: string;
  value: string;
};

/**
 * Near-whole rates snap to clean integers (980, not 980.0000002548) — same as admin Rate Switch.
 * In-progress entries with a trailing dot are left alone.
 */
export function snapNearIntegerRate(
  value: string,
  maxDecimals: number = RATE_INPUT_DECIMALS,
): string {
  if (!value || value.endsWith('.')) return value;
  if (!isPositiveMoney(value)) return value;
  const inverted = new Decimal(value);
  const atDisplay = inverted.toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN);
  if (atDisplay.isInteger() && atDisplay.greaterThan(0)) {
    return atDisplay.toFixed();
  }
  return inverted.toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_EVEN).toFixed();
}

/**
 * Display rate for the selected unit. When the unit matches the anchor, returns the exact typed
 * value (so flipping away and back restores 980, not 980.0000002548). Otherwise returns the
 * reciprocal for the input field — near-integers snap clean (no trailing float noise).
 */
export function displayRateForUnit(
  anchor: RateEntryAnchor | null,
  unitCode: string,
  maxDecimals: number = RATE_INPUT_DECIMALS,
): string {
  if (!anchor) return '';
  // Same unit: return the raw typed string (including in-progress "1500." / "0.") so the
  // controlled input does not clear mid-decimal and swallow the integer part.
  if (anchor.unitCode.toUpperCase() === unitCode.toUpperCase()) return anchor.value;
  if (!isPositiveMoney(anchor.value)) return '';
  return snapNearIntegerRate(
    new Decimal(1).div(new Decimal(anchor.value)).toFixed(),
    maxDecimals,
  );
}

/**
 * Applies a rate-field edit. Preserves the typed anchor when `nextValue` is only the reciprocal
 * of the current anchor (flip / pad sync / stale closure must not adopt the truncated 12 dp
 * form, or flipping back yields 980.0000002548 instead of 980).
 */
export function applyRateDisplayEdit(
  current: RateEntryAnchor | null,
  unitCode: string,
  nextValue: string,
): RateEntryAnchor | null {
  if (!nextValue) return null;
  if (current && isPositiveMoney(current.value) && isPositiveMoney(nextValue)) {
    const reciprocal = new Decimal(1)
      .div(new Decimal(current.value))
      .toDecimalPlaces(RATE_INPUT_DECIMALS, Decimal.ROUND_HALF_EVEN)
      .toFixed();
    if (nextValue === reciprocal) return current;
  }
  return { unitCode, value: nextValue };
}

/**
 * "1 USD = 1,500 NGN" — API stores quote-per-base; when `unitCode` is omitted, CAD is preferred
 * as the "1" side so marketplace rates stay comparable across directions.
 */
export function p2pRateLine(
  rate: string,
  base: string,
  quote: string,
  unitCode: string = preferredRateUnit(base, quote),
): string {
  const unit = unitCode.toUpperCase();
  const other = otherOfPair(unit, base, quote).toUpperCase();
  const display = unit === base.toUpperCase() ? rate : invertRate(rate);
  return `1 ${unit} = ${formatRateValue(display)} ${other}`;
}

export function rateEntryHint(unitCode: string, otherCode: string): string {
  return (
    `Enter ${otherCode} per 1 ${unitCode}. ${unitCode} stays fixed at 1 — ` +
    'set a separate rate for each direction.'
  );
}

/**
 * Flip stored quote-per-base min/max into the selected rate unit.
 * Endpoints swap because the smaller quote/base becomes the larger base/quote.
 * Near-whole reciprocals snap to integers (980, not 980.0000002548) — same as admin
 * Configured P2P bounds Rate Switch.
 */
export function displayRateBoundsForUnit(
  minRate: string,
  maxRate: string,
  baseCurrencyCode: string,
  unitCode: string,
  maxDecimals: number = RATE_INPUT_DECIMALS,
): { minRate: string; maxRate: string } {
  if (unitCode.toUpperCase() === baseCurrencyCode.toUpperCase()) {
    return {
      minRate: new Decimal(minRate).toFixed(),
      maxRate: new Decimal(maxRate).toFixed(),
    };
  }
  const invert = (value: string) => {
    const inverted = new Decimal(1).div(new Decimal(value));
    // 6 dp: drop float noise from inverting a 12 dp stored reciprocal.
    const atDisplay = inverted.toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN);
    if (atDisplay.isInteger() && atDisplay.greaterThan(0)) {
      return atDisplay.toFixed();
    }
    return inverted.toDecimalPlaces(maxDecimals, Decimal.ROUND_HALF_EVEN).toFixed();
  };
  return { minRate: invert(maxRate), maxRate: invert(minRate) };
}

/** Switchable hint for admin-configured P2P rate bounds. */
export function rateBoundsMessage(
  minRate: string,
  maxRate: string,
  baseCurrencyCode: string,
  quoteCurrencyCode: string,
  unitCode: string,
): string {
  const display = displayRateBoundsForUnit(minRate, maxRate, baseCurrencyCode, unitCode);
  return (
    `Rate must be between ${display.minRate} and ${display.maxRate} ` +
    `for ${baseCurrencyCode.toUpperCase()}/${quoteCurrencyCode.toUpperCase()}`
  );
}

/** Compare an API quote-per-base rate against stored bounds (inclusive). */
export function isApiRateWithinBounds(apiRate: string, minRate: string, maxRate: string): boolean {
  if (!isPositiveMoney(apiRate) || !isPositiveMoney(minRate) || !isPositiveMoney(maxRate)) {
    return false;
  }
  const rate = new Decimal(apiRate);
  return rate.greaterThanOrEqualTo(minRate) && rate.lessThanOrEqualTo(maxRate);
}

const CURRENCY_META: Record<string, { flag: string; name: string }> = {
  CAD: { flag: '🇨🇦', name: 'Canadian Dollar' },
  NGN: { flag: '🇳🇬', name: 'Nigerian Naira' },
  USD: { flag: '🇺🇸', name: 'US Dollar' },
  GBP: { flag: '🇬🇧', name: 'British Pound' },
  GHS: { flag: '🇬🇭', name: 'Ghanaian Cedi' },
  KES: { flag: '🇰🇪', name: 'Kenyan Shilling' },
  EUR: { flag: '🇪🇺', name: 'Euro' },
};

export function currencyFlag(code: string): string {
  return CURRENCY_META[code.toUpperCase()]?.flag ?? '🏳️';
}

export function currencyDisplayName(code: string): string {
  return CURRENCY_META[code.toUpperCase()]?.name ?? code.toUpperCase();
}

/**
 * Converts a unit-anchored display rate (`other` units per 1 `unitCode`) into API quote-per-base
 * (12 dp, matches `p2p_requests.rate` scale).
 */
export function apiRateFromUnit(
  baseCode: string,
  quoteCode: string,
  unitCode: string,
  displayRate: string,
): string {
  const base = baseCode.toUpperCase();
  const unit = unitCode.toUpperCase();
  const rate = new Decimal(displayRate);
  const quotePerBase = unit === base ? rate : new Decimal(1).div(rate);
  return quotePerBase.toDecimalPlaces(12, Decimal.ROUND_HALF_EVEN).toFixed();
}

/** Inverse of {@link apiRateFromUnit} for edit forms and list display. */
export function displayRateFromApi(
  baseCode: string,
  quoteCode: string,
  unitCode: string,
  apiRate: string,
): string {
  const base = baseCode.toUpperCase();
  const unit = unitCode.toUpperCase();
  if (unit === base) {
    return new Decimal(apiRate).toDecimalPlaces(12, Decimal.ROUND_HALF_EVEN).toFixed();
  }
  return invertRate(apiRate);
}

/**
 * @deprecated Prefer {@link apiRateFromUnit} with an explicit unit. Kept for CAD-anchored callers.
 */
export function apiRateFromAnchor(
  baseCode: string,
  quoteCode: string,
  anchorRate: string,
): string {
  return apiRateFromUnit(baseCode, quoteCode, RATE_ANCHOR_CODE, anchorRate);
}

/**
 * Amount the poster receives for selling `sellAmount` of `sellCode`.
 *
 * Display rate is always "`other` per 1 `unitCode`":
 * - unit = sell  → 1 sell = rate receive  → receive = sell × rate
 * - unit = receive → 1 receive = rate sell → receive = sell ÷ rate
 *
 * Rounded half-even to the receive currency precision (same as backend quote settle).
 */
export function receiveAmountForSell(
  sellAmount: string,
  sellCode: string,
  receiveCode: string,
  displayRate: string,
  unitCode: string = sellCode,
  receivePrecision = 2,
): string | null {
  if (!isPositiveMoney(sellAmount) || !isPositiveMoney(displayRate)) return null;
  const sell = new Decimal(sellAmount);
  const rate = new Decimal(displayRate);
  const unit = unitCode.toUpperCase();
  const from = sellCode.toUpperCase();
  const to = receiveCode.toUpperCase();
  let raw: Decimal;
  if (unit === from) {
    raw = sell.mul(rate);
  } else if (unit === to) {
    raw = sell.div(rate);
  } else {
    return null;
  }
  return raw.toFixed(receivePrecision, Decimal.ROUND_HALF_EVEN);
}

/** Short equation under the You-receive preview, e.g. "100 CAD × 1,500 = 150,000 NGN". */
export function receivePreviewEquation(
  sellAmount: string,
  sellCode: string,
  receiveCode: string,
  displayRate: string,
  unitCode: string,
  receiveAmount: string,
): string | null {
  if (!isPositiveMoney(sellAmount) || !isPositiveMoney(displayRate) || !isPositiveMoney(receiveAmount)) {
    return null;
  }
  const unit = unitCode.toUpperCase();
  const from = sellCode.toUpperCase();
  const sellLabel = `${formatRateValue(sellAmount, 12)} ${sellCode}`;
  const rateLabel = formatRateValue(displayRate, 12);
  const receiveLabel = `${formatRateValue(receiveAmount, 12)} ${receiveCode}`;
  if (unit === from) {
    return `${sellLabel} × ${rateLabel} = ${receiveLabel}`;
  }
  return `${sellLabel} ÷ ${rateLabel} = ${receiveLabel}`;
}

/**
 * Maps Buy/Sell UI to API base/quote.
 * SELL posts store what you sell as base and what you receive as quote (so NGN→CAD shows as NGN/CAD).
 * BUY posts store what you acquire as base (paid with the sell currency as quote).
 * CAD may still be used as the rate-entry anchor via {@link apiRateFromAnchor}; it is not forced as base.
 */
export function createPayloadCurrencies(
  side: P2PSide,
  sellCode: string,
  receiveCode: string,
): { baseCurrencyCode: string; quoteCurrencyCode: string } {
  const sell = sellCode.toUpperCase();
  const receive = receiveCode.toUpperCase();
  if (side === 'BUY') {
    return { baseCurrencyCode: receive, quoteCurrencyCode: sell };
  }
  return { baseCurrencyCode: sell, quoteCurrencyCode: receive };
}

/** API `amount` is always in the base currency. */
export function apiAmountFromSell(
  side: P2PSide,
  sellAmount: string,
  sellCode: string,
  receiveCode: string,
  displayRate: string,
  unitCode: string = sellCode,
): string | null {
  const { baseCurrencyCode } = createPayloadCurrencies(side, sellCode, receiveCode);
  if (sellCode.toUpperCase() === baseCurrencyCode) return isPositiveMoney(sellAmount) ? sellAmount : null;
  return receiveAmountForSell(sellAmount, sellCode, receiveCode, displayRate, unitCode);
}

/**
 * The backend turns an OPEN request past `expiresAt` into EXPIRED on the next read or write of that
 * request, but `GET /p2p/me/requests` returns the stored status. This mirrors that rule for display.
 */
export function effectiveStatus(
  request: Pick<P2PRequestResponse, 'status' | 'expiresAt'>,
  now: number,
): P2PStatus {
  if (
    request.status === 'OPEN' &&
    request.expiresAt &&
    new Date(request.expiresAt).getTime() <= now
  ) {
    return 'EXPIRED';
  }
  return request.status;
}

/** Owner-only edit/cancel, and only while OPEN (R-P-2). */
export function canManage(
  request: P2PRequestResponse,
  userId: string | null,
  now: number,
): boolean {
  return request.userId === userId && effectiveStatus(request, now) === 'OPEN';
}

/** Owner may permanently remove cancelled or expired requests from their history. */
export function canDeleteRequest(
  request: Pick<P2PRequestResponse, 'userId' | 'status' | 'expiresAt'>,
  userId: string | null,
  now: number,
): boolean {
  if (!userId || request.userId !== userId) return false;
  const status = effectiveStatus(request, now);
  return status === 'CANCELLED' || status === 'EXPIRED';
}

/** Either party may remove a cancelled order from their own history. */
export function canDeleteOrder(
  order: Pick<P2POrderResponse, 'requesterId' | 'acceptorId' | 'status'>,
  userId: string | null,
): boolean {
  return !!userId && order.status === 'CANCELLED' && orderRole(order, userId) != null;
}

/** Messaging stays open while the order is active; completed trades are read-only. */
export function canMessageOrder(
  order: Pick<P2POrderResponse, 'requesterId' | 'acceptorId' | 'status'>,
  userId: string | null,
): boolean {
  return !!userId && orderRole(order, userId) != null && order.status !== 'COMPLETED';
}

/**
 * Quote currency total the buyer pays: `amount * rate`, rounded half-even to quote precision
 * (matches backend settle).
 */
export function quoteTotal(amount: string, rate: string, quotePrecision: number): string {
  return new Decimal(amount).mul(rate).toFixed(quotePrecision, Decimal.ROUND_HALF_EVEN);
}

/**
 * Whether the current viewer pays the platform fee (admin P2P fee tiers).
 * SELL listings: acceptor is the buyer. BUY listings: poster is the buyer.
 */
export function viewerIsP2PBuyer(side: P2PSide, own: boolean): boolean {
  return side === 'SELL' ? !own : own;
}

/** Base amount remaining after the buyer platform fee (half-even to currency precision). */
export function netBaseAfterFee(
  amount: string,
  feeAmount: string | null | undefined,
  precision: number,
): string | null {
  if (!isPositiveMoney(amount) || feeAmount == null || !isPositiveMoney(String(feeAmount))) {
    return null;
  }
  const net = new Decimal(amount).minus(new Decimal(feeAmount));
  if (net.lte(0)) return null;
  return net.toFixed(precision, Decimal.ROUND_HALF_EVEN);
}

/**
 * What the acceptor must have available to fund settle.
 * SELL: buyer (acceptor) pays quote. BUY: seller (acceptor) pays base.
 */
export function acceptorFundingRequirement(
  side: P2PSide,
  baseCurrencyCode: string,
  quoteCurrencyCode: string,
  amount: string,
  rate: string,
  quotePrecision: number,
): { currencyCode: string; amount: string } {
  if (side === 'SELL') {
    return {
      currencyCode: quoteCurrencyCode,
      amount: quoteTotal(amount, rate, quotePrecision),
    };
  }
  return { currencyCode: baseCurrencyCode, amount: toMoney(amount) };
}

export type AcceptFundingIssue =
  | { kind: 'missing_wallet'; currencyCode: string }
  | { kind: 'insufficient'; currencyCode: string; required: string; available: string };

/** Client-side gate before Accept — mirrors settle debit of the acceptor's funding wallet. */
export function acceptFundingIssue(
  requirement: { currencyCode: string; amount: string },
  wallet: { availableBalance: string } | null | undefined,
): AcceptFundingIssue | null {
  if (!wallet) {
    return { kind: 'missing_wallet', currencyCode: requirement.currencyCode };
  }
  if (compareMoney(wallet.availableBalance, requirement.amount) < 0) {
    return {
      kind: 'insufficient',
      currencyCode: requirement.currencyCode,
      required: requirement.amount,
      available: wallet.availableBalance,
    };
  }
  return null;
}

/**
 * Accept-confirm copy for the counterparty. SELL listings: acceptor buys base and pays quote.
 * BUY listings: acceptor sells base (base wallet is debited).
 */
export function acceptConfirmMessage(args: {
  side: P2PSide;
  formattedBaseAmount: string;
  rateLine: string;
  posterName: string;
  formattedDebitAmount: string;
  debitCurrencyCode: string;
  formattedFeeAmount?: string | null;
  formattedNetBaseAmount?: string | null;
}): string {
  const verb = args.side === 'SELL' ? 'buy' : 'sell';
  const poster = args.posterName.trim() || 'Palpeer user';
  const feeLine =
    args.formattedFeeAmount && args.side === 'SELL'
      ? ` A platform fee of ${args.formattedFeeAmount} applies` +
        (args.formattedNetBaseAmount
          ? `, so you receive ${args.formattedNetBaseAmount}.`
          : '.')
      : args.formattedFeeAmount
        ? ` A platform fee of ${args.formattedFeeAmount} applies.`
        : '';
  return (
    `You agree to ${verb} ${args.formattedBaseAmount} at rate of ${args.rateLine}. ` +
    `This creates an order between you and the ${poster} who posted it.` +
    feeLine +
    ` ${args.formattedDebitAmount} will be deducted from your ${args.debitCurrencyCode} wallet.`
  );
}

/** Non-owners can accept an OPEN request (R-P-3). */
export function canAccept(
  request: P2PRequestResponse,
  userId: string | null,
  now: number,
): boolean {
  return !!userId && request.userId !== userId && effectiveStatus(request, now) === 'OPEN';
}

export function orderRole(order: P2POrderResponse, userId: string | null) {
  if (order.acceptorId === userId) return 'acceptor' as const;
  if (order.requesterId === userId) return 'requester' as const;
  return null;
}

export type SideFilter = 'ALL' | P2PSide;
export type SortKey = 'NEWEST' | 'RATE_ASC' | 'RATE_DESC' | 'AMOUNT_DESC';

export type MarketplaceFilters = {
  side: SideFilter;
  /** Matches either side of the pair; null = any. */
  currency: string | null;
  search: string;
  sort: SortKey;
};

export const DEFAULT_FILTERS: MarketplaceFilters = {
  side: 'ALL',
  currency: null,
  search: '',
  sort: 'NEWEST',
};

export const SORT_OPTIONS: readonly { key: SortKey; title: string }[] = [
  { key: 'NEWEST', title: 'Newest first' },
  { key: 'RATE_ASC', title: 'Lowest rate' },
  { key: 'RATE_DESC', title: 'Highest rate' },
  { key: 'AMOUNT_DESC', title: 'Largest amount' },
];

/** Currency codes that appear on either side of the listed requests, sorted. */
export function currenciesIn(requests: readonly P2PRequestResponse[]): string[] {
  const codes = new Set<string>();
  for (const request of requests) {
    codes.add(request.baseCurrencyCode);
    codes.add(request.quoteCurrencyCode);
  }
  return [...codes].sort();
}

function matchesSearch(request: P2PRequestResponse, search: string): boolean {
  const needle = search.trim().toUpperCase();
  if (!needle) return true;
  const pair = `${request.baseCurrencyCode}/${request.quoteCurrencyCode}`;
  return (
    pair.includes(needle) ||
    `${request.baseCurrencyCode} ${request.quoteCurrencyCode}`.includes(needle) ||
    (request.notes ?? '').toUpperCase().includes(needle)
  );
}

/**
 * Client-side filter and sort: the backend list has no filter or paging parameters (P-4). The
 * backend already returns newest first, so NEWEST keeps its order. Comparisons use decimals.
 */
export function filterRequests(
  requests: readonly P2PRequestResponse[],
  filters: MarketplaceFilters,
): P2PRequestResponse[] {
  const filtered = requests.filter(
    (request) =>
      (filters.side === 'ALL' || request.side === filters.side) &&
      (!filters.currency ||
        request.baseCurrencyCode === filters.currency ||
        request.quoteCurrencyCode === filters.currency) &&
      matchesSearch(request, filters.search),
  );
  const compare = (a: string, b: string) => new Decimal(a).comparedTo(new Decimal(b));
  switch (filters.sort) {
    case 'NEWEST':
      return filtered;
    case 'RATE_ASC':
      return [...filtered].sort((a, b) => compare(a.rate, b.rate));
    case 'RATE_DESC':
      return [...filtered].sort((a, b) => compare(b.rate, a.rate));
    case 'AMOUNT_DESC':
      return [...filtered].sort((a, b) => compare(b.amount, a.amount));
  }
}

export function activeFilterCount(filters: MarketplaceFilters): number {
  return (filters.side !== 'ALL' ? 1 : 0) + (filters.currency ? 1 : 0);
}

/** Expiry presets (client convenience); the backend only requires a future instant. */
export type ExpiryKey = 'NONE' | '1H' | '3H' | '24H' | '3D' | '7D';

const HOUR_MS = 60 * 60 * 1000;
const EXPIRY_MS: Record<Exclude<ExpiryKey, 'NONE'>, number> = {
  '1H': HOUR_MS,
  '3H': 3 * HOUR_MS,
  '24H': 24 * HOUR_MS,
  '3D': 72 * HOUR_MS,
  '7D': 168 * HOUR_MS,
};

export const EXPIRY_OPTIONS: readonly { key: ExpiryKey; title: string }[] = [
  { key: 'NONE', title: 'No expiry' },
  { key: '1H', title: 'In 1 hour' },
  { key: '3H', title: '3 Hours' },
  { key: '24H', title: 'In 24 hours' },
  { key: '3D', title: 'In 3 days' },
  { key: '7D', title: 'In 7 days' },
];

export function expiresAtFor(key: ExpiryKey, now: number): string | undefined {
  return key === 'NONE' ? undefined : new Date(now + EXPIRY_MS[key]).toISOString();
}

/** Editing: keep the current expiry or move it; the backend can't clear an expiry once set. */
export type ExpiryChoice = 'KEEP' | Exclude<ExpiryKey, 'NONE'>;

/** Only fields that changed are sent; the backend treats omitted fields as unchanged. */
export function changesFor(
  request: P2PRequestResponse,
  form: { amount: string; rate: string; notes: string; expiry: ExpiryChoice },
  now: number,
): UpdateP2PRequest {
  const changes: UpdateP2PRequest = {};
  if (isPositiveMoney(form.amount) && compareMoney(form.amount, request.amount) !== 0) {
    changes.amount = toMoney(form.amount);
  }
  if (isPositiveMoney(form.rate) && compareMoney(form.rate, request.rate) !== 0) {
    changes.rate = toMoney(form.rate);
  }
  const notes = form.notes.trim();
  if (notes !== (request.notes ?? '')) changes.notes = notes;
  if (form.expiry !== 'KEEP') changes.expiresAt = expiresAtFor(form.expiry, now);
  return changes;
}

export const NOTES_MAX = 500;
