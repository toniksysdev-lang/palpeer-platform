import { createAppError } from '@/services/api/errors';

import {
  closedExplanation,
  currentOffer,
  isMyTurn,
  negotiationErrorMessage,
  negotiationRole,
  negotiationSummary,
  offerAuthor,
  openNegotiationFor,
} from '../logic';
import { ME, negotiation, offer, OTHER } from './fixtures';

describe('negotiation logic', () => {
  const countered = negotiation({
    offers: [
      offer({ id: 'o-1', status: 'SUPERSEDED' }),
      offer({ id: 'o-2', offeredBy: OTHER, offerType: 'COUNTER', status: 'PENDING' }),
    ],
  });

  it('finds the current offer by id', () => {
    expect(currentOffer(countered)?.id).toBe('o-2');
    expect(currentOffer(negotiation({ currentOfferId: null }))).toBeUndefined();
  });

  it("gives the turn to whoever didn't make the pending offer", () => {
    const pendingMine = negotiation();
    expect(isMyTurn(pendingMine, ME)).toBe(false);
    expect(isMyTurn(pendingMine, OTHER)).toBe(true);
    expect(isMyTurn(countered, ME)).toBe(true);
    expect(isMyTurn(countered, OTHER)).toBe(false);
  });

  it('never gives a turn on an ended negotiation or to outsiders', () => {
    expect(isMyTurn(negotiation({ status: 'ACCEPTED' }), OTHER)).toBe(false);
    expect(isMyTurn(negotiation({ status: 'CANCELLED' }), OTHER)).toBe(false);
    expect(isMyTurn(negotiation({ offers: [offer({ status: 'ACCEPTED' })] }), OTHER)).toBe(false);
    expect(isMyTurn(negotiation(), 'u-3')).toBe(false);
    expect(isMyTurn(negotiation(), null)).toBe(false);
  });

  it('describes roles, authors and state', () => {
    expect(negotiationRole(negotiation(), OTHER)).toBe('owner');
    expect(negotiationRole(negotiation(), ME)).toBe('counterparty');
    expect(offerAuthor(offer(), ME)).toBe('You offered');
    expect(offerAuthor(offer(), OTHER)).toBe('They offered');
    expect(offerAuthor(offer({ offerType: 'COUNTER', offeredBy: OTHER }), ME)).toBe(
      'They countered',
    );
    expect(negotiationSummary(negotiation(), ME)).toBe('Waiting for their reply');
    expect(negotiationSummary(negotiation(), OTHER)).toBe('Your turn to reply');
    expect(negotiationSummary(negotiation({ status: 'ACCEPTED' }), ME)).toBe('Offer accepted');
  });

  it('says who ended a cancelled negotiation and why', () => {
    const closed = (
      closedReason: 'REJECTED' | 'CANCELLED' | 'REQUEST_CLOSED',
      closedBy: string | null,
    ) => negotiation({ status: 'CANCELLED', closedReason, closedBy });
    expect(negotiationSummary(closed('REJECTED', ME), ME)).toBe('You declined');
    expect(negotiationSummary(closed('REJECTED', ME), OTHER)).toBe('They declined');
    expect(negotiationSummary(closed('CANCELLED', OTHER), ME)).toBe('They cancelled');
    expect(negotiationSummary(closed('CANCELLED', OTHER), OTHER)).toBe('You cancelled');
    expect(negotiationSummary(closed('REQUEST_CLOSED', null), ME)).toBe('Request closed');
    expect(negotiationSummary(negotiation({ status: 'CANCELLED' }), ME)).toBe('Cancelled');

    expect(closedExplanation(closed('REJECTED', OTHER), ME)).toBe('They declined your offer.');
    expect(closedExplanation(closed('CANCELLED', ME), ME)).toBe('You cancelled this negotiation.');
    expect(closedExplanation(closed('REQUEST_CLOSED', null), ME)).toMatch(/no longer open/);
    expect(closedExplanation(negotiation(), ME)).toBeNull();
    expect(closedExplanation(negotiation({ status: 'ACCEPTED' }), ME)).toBeNull();
  });

  it("finds the user's own open negotiation on a request", () => {
    const list = [
      negotiation({ id: 'n-closed', status: 'ACCEPTED' }),
      negotiation({ id: 'n-open' }),
    ];
    expect(openNegotiationFor(list, 'r-1', ME)?.id).toBe('n-open');
    expect(openNegotiationFor(list, 'r-2', ME)).toBeUndefined();
    expect(openNegotiationFor(list, 'r-1', OTHER)).toBeUndefined();
  });

  it('maps backend codes to messages', () => {
    const conflict = (code: string) =>
      createAppError('conflict', { status: 409, code, message: 'server text' });
    expect(negotiationErrorMessage(conflict('NEGOTIATION_WAIT_TURN'))).toBe(
      "It's the other person's turn to reply.",
    );
    expect(negotiationErrorMessage(conflict('P2P_NOT_OPEN'))).toMatch(/no longer open/);
    expect(negotiationErrorMessage(conflict('NEGOTIATION_CANNOT_REJECT_OWN'))).toMatch(
      /can't decline your own offer/,
    );
    expect(negotiationErrorMessage(conflict('SOMETHING_NEW'))).toBe('server text');
  });
});
