import type { NegotiationResponse, OfferResponse } from '@/types/api/negotiation';

import { ME, OTHER } from '../../p2p/__tests__/fixtures';

export { ME, OTHER };

/** Money fields may be given as plain strings, as the backend sends them. */
export function offer(
  overrides: Partial<Record<keyof OfferResponse, unknown>> = {},
): OfferResponse {
  return {
    id: 'o-1',
    offeredBy: ME,
    offerType: 'OFFER',
    amount: '100.0000',
    rate: '1450.000000000000',
    status: 'PENDING',
    createdAt: '2026-09-29T09:00:00Z',
    ...overrides,
  } as OfferResponse;
}

/** By default OTHER owns request r-1 and ME made one pending offer on it. */
export function negotiation(overrides: Partial<NegotiationResponse> = {}): NegotiationResponse {
  const offers = overrides.offers ?? [offer()];
  return {
    id: 'n-1',
    p2pRequestId: 'r-1',
    requesterId: OTHER,
    counterpartyId: ME,
    status: 'OPEN',
    currentOfferId: offers[offers.length - 1]?.id ?? null,
    offers,
    createdAt: '2026-09-29T09:00:00Z',
    p2pOrderId: null,
    closedReason: null,
    closedBy: null,
    ...overrides,
  } as NegotiationResponse;
}
