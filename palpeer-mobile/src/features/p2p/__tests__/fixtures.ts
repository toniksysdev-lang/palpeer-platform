import type { P2PRequestResponse } from '@/types/api/p2p';
import type { Money } from '@/utils/money';
import { ok } from '@/tests/fetchMock';

export const ME = 'u-1';
export const OTHER = 'u-2';

export const CURRENCIES = ok([
  { id: 'c-cad', code: 'CAD', symbol: 'C$', precision: 2 },
  { id: 'c-ngn', code: 'NGN', symbol: 'N', precision: 2 },
  { id: 'c-usd', code: 'USD', symbol: '$', precision: 2 },
]);

export const p2pRequest = (overrides: Partial<Record<keyof P2PRequestResponse, unknown>> = {}) => ({
  id: 'r-1',
  userId: OTHER,
  side: 'SELL',
  baseCurrencyCode: 'USD',
  quoteCurrencyCode: 'NGN',
  amount: '100.000000000000',
  rate: '1500.000000000000',
  status: 'OPEN',
  expiresAt: null,
  notes: null,
  createdAt: '2026-09-28T10:00:00Z',
  ...overrides,
});

/** Typed copy for logic tests (money fields as `Money`). */
export const typedRequest = (overrides: Partial<P2PRequestResponse> = {}): P2PRequestResponse => ({
  ...(p2pRequest() as unknown as P2PRequestResponse),
  amount: '100.000000000000' as Money,
  rate: '1500.000000000000' as Money,
  ...overrides,
});

export const p2pOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'o-1',
  requestId: 'r-1',
  requesterId: OTHER,
  acceptorId: ME,
  amount: '100.000000000000',
  rate: '1500.000000000000',
  status: 'ACCEPTED',
  createdAt: '2026-09-28T11:00:00Z',
  ...overrides,
});

export const orderSummary = (overrides: Record<string, unknown> = {}) => ({
  ...p2pOrder(),
  side: 'SELL',
  baseCurrencyCode: 'USD',
  quoteCurrencyCode: 'NGN',
  ...overrides,
});

export const created = (data: unknown) => ({
  status: 201,
  body: { success: true, data, timestamp: '' },
});
