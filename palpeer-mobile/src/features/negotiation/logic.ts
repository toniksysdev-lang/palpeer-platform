import type { AppError } from '@/services/api/errors';
import type { NegotiationResponse, OfferResponse } from '@/types/api/negotiation';

export function currentOffer(negotiation: NegotiationResponse): OfferResponse | undefined {
  return negotiation.offers.find((offer) => offer.id === negotiation.currentOfferId);
}

/**
 * Turn-taking (R-N-2): only the party who didn't make the current PENDING offer can counter or
 * accept, and only while the negotiation is OPEN.
 */
export function isMyTurn(negotiation: NegotiationResponse, userId: string | null): boolean {
  const offer = currentOffer(negotiation);
  return (
    !!userId &&
    negotiation.status === 'OPEN' &&
    offer?.status === 'PENDING' &&
    offer.offeredBy !== userId &&
    (negotiation.requesterId === userId || negotiation.counterpartyId === userId)
  );
}

export function negotiationRole(negotiation: NegotiationResponse, userId: string | null) {
  return negotiation.requesterId === userId ? ('owner' as const) : ('counterparty' as const);
}

export function offerAuthor(offer: OfferResponse, userId: string | null): string {
  const mine = offer.offeredBy === userId;
  if (offer.offerType === 'OFFER') return mine ? 'You offered' : 'They offered';
  return mine ? 'You countered' : 'They countered';
}

/** One-line state for lists: whose move it is, or how it ended. */
export function negotiationSummary(
  negotiation: NegotiationResponse,
  userId: string | null,
): string {
  switch (negotiation.status) {
    case 'ACCEPTED':
      return 'Offer accepted';
    case 'CANCELLED': {
      const byMe = negotiation.closedBy === userId;
      switch (negotiation.closedReason) {
        case 'REJECTED':
          return byMe ? 'You declined' : 'They declined';
        case 'CANCELLED':
          return byMe ? 'You cancelled' : 'They cancelled';
        case 'REQUEST_CLOSED':
          return 'Request closed';
        default:
          return 'Cancelled';
      }
    }
    case 'OPEN':
      return isMyTurn(negotiation, userId) ? 'Your turn to reply' : 'Waiting for their reply';
  }
}

/** Explains how a CANCELLED negotiation ended; null while it's still open or once accepted. */
export function closedExplanation(
  negotiation: NegotiationResponse,
  userId: string | null,
): string | null {
  if (negotiation.status !== 'CANCELLED') return null;
  const byMe = negotiation.closedBy === userId;
  switch (negotiation.closedReason) {
    case 'REJECTED':
      return byMe ? 'You declined their offer.' : 'They declined your offer.';
    case 'CANCELLED':
      return byMe ? 'You cancelled this negotiation.' : 'They cancelled this negotiation.';
    case 'REQUEST_CLOSED':
      return 'The request is no longer open (it was accepted, cancelled or expired), so this negotiation ended.';
    default:
      return 'This negotiation was cancelled.';
  }
}

/** The request owner's own OPEN negotiation for a request, if any (R-N-1: at most one). */
export function openNegotiationFor(
  negotiations: readonly NegotiationResponse[] | undefined,
  p2pRequestId: string,
  userId: string | null,
): NegotiationResponse | undefined {
  return negotiations?.find(
    (negotiation) =>
      negotiation.p2pRequestId === p2pRequestId &&
      negotiation.counterpartyId === userId &&
      negotiation.status === 'OPEN',
  );
}

/** VERIFIED codes from `NegotiationService` and `P2PService.acceptWithTerms`. */
const MESSAGES: Record<string, string> = {
  NEGOTIATION_EXISTS: 'You already have an open offer on this request.',
  NEGOTIATION_SELF_OFFER: "You can't make an offer on your own request.",
  NEGOTIATION_NOT_OPEN: 'This negotiation has ended.',
  NEGOTIATION_NO_OFFER: 'There is no offer to reply to.',
  NEGOTIATION_OFFER_NOT_PENDING: 'This offer has already been answered.',
  NEGOTIATION_WAIT_TURN: "It's the other person's turn to reply.",
  NEGOTIATION_CANNOT_ACCEPT_OWN: "You can't accept your own offer.",
  NEGOTIATION_CANNOT_REJECT_OWN:
    "You can't decline your own offer. Cancel the negotiation instead.",
  P2P_NOT_OPEN: 'The request is no longer open, so this offer can no longer be accepted.',
  P2P_SELF_ACCEPT: "You can't accept your own request.",
  P2P_TERMS_INVALID: 'Amount and rate must be above zero.',
};

export function negotiationErrorMessage(error: AppError): string {
  return (error.code && MESSAGES[error.code]) || error.message;
}
