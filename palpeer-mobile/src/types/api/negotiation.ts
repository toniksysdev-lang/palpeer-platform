import type { Money } from '@/utils/money';

import type { IsoInstant, Uuid } from './common';

/** VERIFIED: `NegotiationStatus`. CANCELLED is final; `closedReason` says why. */
export type NegotiationStatus = 'OPEN' | 'ACCEPTED' | 'CANCELLED';

/**
 * VERIFIED: `NegotiationCloseReason`, set only when CANCELLED. REJECTED: the participant whose
 * turn it was declined. CANCELLED: a participant withdrew. REQUEST_CLOSED: the P2P request left
 * OPEN (accepted, cancelled, expired or closed by an admin); `closedBy` is null.
 */
export type NegotiationCloseReason = 'REJECTED' | 'CANCELLED' | 'REQUEST_CLOSED';

/** VERIFIED: `NegotiationOfferType`. The first offer is OFFER; every reply is COUNTER. */
export type NegotiationOfferType = 'OFFER' | 'COUNTER';

/** VERIFIED: `NegotiationOfferStatus`. A counter supersedes the pending offer. */
export type NegotiationOfferStatus = 'PENDING' | 'SUPERSEDED' | 'ACCEPTED' | 'REJECTED';

/** VERIFIED: `NegotiationResponse.OfferResponse`. */
export type OfferResponse = {
  id: Uuid;
  offeredBy: Uuid;
  offerType: NegotiationOfferType;
  amount: Money;
  rate: Money;
  status: NegotiationOfferStatus;
  createdAt: IsoInstant;
};

/**
 * VERIFIED: `NegotiationResponse`. `requesterId` owns the P2P request; `counterpartyId` opened the
 * negotiation. Offers are oldest first.
 */
export type NegotiationResponse = {
  id: Uuid;
  p2pRequestId: Uuid;
  requesterId: Uuid;
  counterpartyId: Uuid;
  status: NegotiationStatus;
  currentOfferId: Uuid | null;
  offers: OfferResponse[];
  createdAt: IsoInstant;
  /** The P2P order created on accept; null otherwise (and for negotiations accepted before V26). */
  p2pOrderId: Uuid | null;
  closedReason: NegotiationCloseReason | null;
  closedBy: Uuid | null;
};

/** VERIFIED: `CreateOfferRequest`; amount and rate > 0. */
export type CreateOfferRequest = { p2pRequestId: Uuid; amount: Money; rate: Money };

/** VERIFIED: `CounterOfferRequest`; amount and rate > 0. */
export type CounterOfferRequest = { amount: Money; rate: Money };
