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

/** "1 USD = 1,500 NGN" — the rate as entered, read as quote units per base unit (P-1). */
export function p2pRateLine(rate: string, base: string, quote: string): string {
  return `1 ${base} = ${formatRateValue(rate)} ${quote}`;
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
export type ExpiryKey = 'NONE' | '1H' | '24H' | '3D' | '7D';

const HOUR_MS = 60 * 60 * 1000;
const EXPIRY_MS: Record<Exclude<ExpiryKey, 'NONE'>, number> = {
  '1H': HOUR_MS,
  '24H': 24 * HOUR_MS,
  '3D': 72 * HOUR_MS,
  '7D': 168 * HOUR_MS,
};

export const EXPIRY_OPTIONS: readonly { key: ExpiryKey; title: string }[] = [
  { key: 'NONE', title: 'No expiry' },
  { key: '1H', title: 'In 1 hour' },
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

/** Input limit matching how rates are displayed; the backend stores up to 12 decimals. */
export const RATE_INPUT_DECIMALS = 6;
