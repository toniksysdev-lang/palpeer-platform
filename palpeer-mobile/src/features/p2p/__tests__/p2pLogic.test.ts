import { createAppError } from '@/services/api/errors';
import type { P2PStatus } from '@/types/api/p2p';
import type { Money } from '@/utils/money';

import { p2pErrorMessage, requestActionErrorMessage } from '../errors';
import {
  acceptConfirmMessage,
  acceptFundingIssue,
  acceptorFundingRequirement,
  netBaseAfterFee,
  viewerIsP2PBuyer,
  activeFilterCount,
  apiAmountFromSell,
  apiRateFromAnchor,
  apiRateFromUnit,
  applyRateDisplayEdit,
  displayRateForUnit,
  displayRateBoundsForUnit,
  isApiRateWithinBounds,
  rateBoundsMessage,
  canAccept,
  canDeleteOrder,
  canDeleteRequest,
  canManage,
  canMessageOrder,
  changesFor,
  createPayloadCurrencies,
  currenciesIn,
  DEFAULT_FILTERS,
  effectiveStatus,
  expiresAtFor,
  filterRequests,
  orderRole,
  p2pRateLine,
  quoteTotal,
  receiveAmountForSell,
  sideLabel,
} from '../logic';
import { ME, OTHER, typedRequest } from './fixtures';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const STATUSES: P2PStatus[] = ['OPEN', 'ACCEPTED', 'COMPLETED', 'EXPIRED', 'CANCELLED'];

describe('acceptConfirmMessage', () => {
  it('describes buying base and debiting the quote wallet on a SELL listing', () => {
    expect(
      acceptConfirmMessage({
        side: 'SELL',
        formattedBaseAmount: '103.09 CAD',
        rateLine: '1 CAD = 970 NGN',
        posterName: 'Ada Lovelace',
        formattedDebitAmount: '99,997.30 NGN',
        debitCurrencyCode: 'NGN',
      }),
    ).toBe(
      'You agree to buy 103.09 CAD at rate of 1 CAD = 970 NGN. ' +
        'This creates an order between you and the Ada Lovelace who posted it. ' +
        '99,997.30 NGN will be deducted from your NGN wallet.',
    );
  });

  it('includes platform fee and net receive for the buyer on a SELL listing', () => {
    expect(
      acceptConfirmMessage({
        side: 'SELL',
        formattedBaseAmount: '100.00 CAD',
        rateLine: '1 CAD = 1,500 NGN',
        posterName: 'Ada',
        formattedDebitAmount: '150,000.00 NGN',
        debitCurrencyCode: 'NGN',
        formattedFeeAmount: '1.50 CAD',
        formattedNetBaseAmount: '98.50 CAD',
      }),
    ).toContain('A platform fee of 1.50 CAD applies, so you receive 98.50 CAD.');
  });

  it('describes selling base and debiting the base wallet on a BUY listing', () => {
    expect(
      acceptConfirmMessage({
        side: 'BUY',
        formattedBaseAmount: '100.00 USD',
        rateLine: '1 USD = 1,500 NGN',
        posterName: 'Ada',
        formattedDebitAmount: '100.00 USD',
        debitCurrencyCode: 'USD',
      }),
    ).toContain('You agree to sell 100.00 USD');
  });

  it('computes quote totals with half-even rounding', () => {
    expect(quoteTotal('103.09', '970', 2)).toBe('99997.30');
  });
});

describe('viewerIsP2PBuyer / netBaseAfterFee', () => {
  it('treats the acceptor as buyer on SELL and the poster as buyer on BUY', () => {
    expect(viewerIsP2PBuyer('SELL', false)).toBe(true);
    expect(viewerIsP2PBuyer('SELL', true)).toBe(false);
    expect(viewerIsP2PBuyer('BUY', true)).toBe(true);
    expect(viewerIsP2PBuyer('BUY', false)).toBe(false);
  });

  it('subtracts the platform fee from the base amount', () => {
    expect(netBaseAfterFee('100', '1.5', 2)).toBe('98.50');
    expect(netBaseAfterFee('100', null, 2)).toBeNull();
  });
});

describe('acceptFundingIssue', () => {
  it('requires the buyer quote wallet on a SELL accept', () => {
    const requirement = acceptorFundingRequirement('SELL', 'USD', 'NGN', '100', '1500', 2);
    expect(requirement).toEqual({ currencyCode: 'NGN', amount: '150000.00' });
    expect(acceptFundingIssue(requirement, null)?.kind).toBe('missing_wallet');
    expect(
      acceptFundingIssue(requirement, { availableBalance: '1000.00' })?.kind,
    ).toBe('insufficient');
    expect(acceptFundingIssue(requirement, { availableBalance: '150000.00' })).toBeNull();
  });
});

describe('labels', () => {
  it('uses neutral buy/sell wording for base and quote', () => {
    expect(sideLabel('BUY', 'USD', 'NGN', 'self')).toBe('You want to buy USD for NGN');
    expect(sideLabel('SELL', 'USD', 'NGN', 'other')).toBe('Wants to sell USD for NGN');
  });

  it('shows the backend rate exactly, without trailing zeros', () => {
    expect(p2pRateLine('1500.000000000000', 'USD', 'NGN')).toBe('1 USD = 1,500 NGN');
    expect(p2pRateLine('0.000712345678', 'NGN', 'USD')).toBe('1 NGN = 0.000712 USD');
  });

  it('prefers CAD as the fixed side when CAD is in the pair', () => {
    expect(p2pRateLine('0.001', 'NGN', 'CAD')).toBe('1 CAD = 1,000 NGN');
    expect(p2pRateLine('1000', 'CAD', 'NGN')).toBe('1 CAD = 1,000 NGN');
    expect(p2pRateLine('0.001', 'NGN', 'CAD', 'NGN')).toBe('1 NGN = 0.001 CAD');
  });

  it('snaps near-whole Switch rates even at 12 display decimals (post-create detail)', () => {
    // Stored CAD-per-NGN reciprocal of 980 — invert used to show 980.0000002548 at 12 dp.
    expect(p2pRateLine('0.001020408163', 'NGN', 'CAD', 'CAD', 12)).toBe('1 CAD = 980 NGN');
    expect(p2pRateLine('0.001020408163', 'NGN', 'CAD', 'CAD', 12)).not.toContain('.');
    expect(p2pRateLine('1500.000000000000', 'USD', 'NGN', 'USD', 12)).toBe('1 USD = 1,500 NGN');
    expect(p2pRateLine('1500.000000000000', 'USD', 'NGN', 'USD', 12)).not.toContain('.');
  });
});

describe('CAD-anchored either-direction rates', () => {
  it('keeps CAD fixed at 1 when converting to API quote-per-base', () => {
    expect(apiRateFromAnchor('CAD', 'NGN', '1000')).toBe('1000');
    expect(Number(apiRateFromAnchor('NGN', 'CAD', '1000'))).toBeCloseTo(0.001);
  });

  it('converts either unit-anchored display rate to API quote-per-base', () => {
    expect(apiRateFromUnit('NGN', 'CAD', 'CAD', '1000')).toBe('0.001');
    expect(apiRateFromUnit('NGN', 'CAD', 'NGN', '0.001')).toBe('0.001');
    expect(apiRateFromUnit('CAD', 'NGN', 'NGN', '0.001')).toBe('1000');
  });

  it('flips configured rate bounds with the selected rate unit', () => {
    // Stored as CAD per 1 NGN (quote per base) — reciprocals of 980 / 950
    const min = '0.001020408163';
    const max = '0.001052631579';
    expect(rateBoundsMessage(min, max, 'NGN', 'CAD', 'NGN')).toBe(
      'Rate must be between 0.001020408163 and 0.001052631579 for NGN/CAD',
    );
    // Rate unit = CAD → same snap as admin Rate Switch (clean integers, not 980.0000002548)
    expect(displayRateBoundsForUnit(min, max, 'NGN', 'CAD')).toEqual({
      minRate: '950',
      maxRate: '980',
    });
    expect(rateBoundsMessage(min, max, 'NGN', 'CAD', 'CAD')).toBe(
      'Rate must be between 950 and 980 for NGN/CAD',
    );
    expect(isApiRateWithinBounds('0.00103', min, max)).toBe(true);
    expect(isApiRateWithinBounds('0.001', min, max)).toBe(false);
  });

  it('round-trips rate unit flips without corrupting the typed value', () => {
    const anchor = { unitCode: 'CAD', value: '980' };
    // 1/980 shown on the NGN side (12 dp) — correct reciprocal, not 0.001
    expect(displayRateForUnit(anchor, 'NGN')).toBe('0.001020408163');
    // Flipping back restores the exact typed CAD rate
    expect(displayRateForUnit(anchor, 'CAD')).toBe('980');
    // Adopting the truncated reciprocal as a new typed value loses precision —
    // the UI must not do this on flip alone (see applyRateDisplayEdit).
    const truncatedFlip = { unitCode: 'NGN', value: displayRateForUnit(anchor, 'NGN') };
    // Rate Switch snaps near-whole reciprocals to clean integers (no float noise).
    expect(displayRateForUnit(truncatedFlip, 'CAD')).toBe('980');
    // Pad/sync writing the reciprocal back keeps the original CAD anchor
    expect(applyRateDisplayEdit(anchor, 'NGN', '0.001020408163')).toEqual(anchor);
    expect(applyRateDisplayEdit(anchor, 'CAD', '0.001020408163')).toEqual(anchor);
    expect(displayRateForUnit(applyRateDisplayEdit(anchor, 'NGN', '0.001020408163'), 'CAD')).toBe(
      '980',
    );
    // A real edit on the NGN side becomes the new anchor
    expect(applyRateDisplayEdit(anchor, 'NGN', '0.001')).toEqual({
      unitCode: 'NGN',
      value: '0.001',
    });
  });

  it('computes receive amounts for both directions', () => {
    // Default unit = sell: 1 NGN = 0.001 CAD → receive = amount × rate
    expect(receiveAmountForSell('100000', 'NGN', 'CAD', '0.001')).toBe('100.00');
    // 1 CAD = 1050 NGN (unit = sell CAD)
    expect(receiveAmountForSell('100', 'CAD', 'NGN', '1050')).toBe('105000.00');
    // CAD-anchored while selling NGN: 1 CAD = 1000 NGN → receive = amount ÷ rate
    expect(receiveAmountForSell('100000', 'NGN', 'CAD', '1000', 'CAD')).toBe('100.00');
    expect(receiveAmountForSell('97000', 'NGN', 'CAD', '970', 'CAD', 2)).toBe('100.00');
    expect(receiveAmountForSell('100', 'CAD', 'NGN', '970', 'CAD', 2)).toBe('97000.00');
  });

  it('stores the sell→receive pair as posted (does not force CAD as base)', () => {
    expect(createPayloadCurrencies('SELL', 'CAD', 'NGN')).toEqual({
      baseCurrencyCode: 'CAD',
      quoteCurrencyCode: 'NGN',
    });
    expect(createPayloadCurrencies('SELL', 'NGN', 'CAD')).toEqual({
      baseCurrencyCode: 'NGN',
      quoteCurrencyCode: 'CAD',
    });
    expect(createPayloadCurrencies('BUY', 'NGN', 'CAD')).toEqual({
      baseCurrencyCode: 'CAD',
      quoteCurrencyCode: 'NGN',
    });
    expect(apiAmountFromSell('SELL', '100', 'CAD', 'NGN', '1050')).toBe('100');
    // Selling NGN with CAD-anchored rate 1000 NGN per CAD
    expect(apiAmountFromSell('SELL', '100000', 'NGN', 'CAD', '1000', 'CAD')).toBe('100000');
    // BUY: acquire CAD, pay with NGN — amount converted via receive preview
    expect(apiAmountFromSell('BUY', '100000', 'NGN', 'CAD', '1000', 'CAD')).toBe('100.00');
  });
});

describe('state rules', () => {
  it('reads an OPEN request past its expiry as EXPIRED, like the backend does on access', () => {
    expect(effectiveStatus({ status: 'OPEN', expiresAt: '2026-09-28T11:59:59Z' }, NOW)).toBe(
      'EXPIRED',
    );
    expect(effectiveStatus({ status: 'OPEN', expiresAt: '2026-09-28T12:00:01Z' }, NOW)).toBe(
      'OPEN',
    );
    expect(effectiveStatus({ status: 'OPEN', expiresAt: null }, NOW)).toBe('OPEN');
    expect(effectiveStatus({ status: 'ACCEPTED', expiresAt: '2026-01-01T00:00:00Z' }, NOW)).toBe(
      'ACCEPTED',
    );
  });

  it.each(STATUSES)('only a non-owner can accept, and only while OPEN (%s)', (status) => {
    const request = typedRequest({ status, userId: OTHER });
    expect(canAccept(request, ME, NOW)).toBe(status === 'OPEN');
    expect(canAccept({ ...request, userId: ME }, ME, NOW)).toBe(false);
  });

  it.each(STATUSES)('only the owner can edit or cancel, and only while OPEN (%s)', (status) => {
    const request = typedRequest({ status, userId: ME });
    expect(canManage(request, ME, NOW)).toBe(status === 'OPEN');
    expect(canManage({ ...request, userId: OTHER }, ME, NOW)).toBe(false);
  });

  it('blocks accept and edit once the expiry has passed', () => {
    const expired = typedRequest({ expiresAt: '2026-09-28T11:00:00Z' });
    expect(canAccept(expired, ME, NOW)).toBe(false);
    expect(canManage({ ...expired, userId: ME }, ME, NOW)).toBe(false);
  });

  it('cannot accept without a signed-in user', () => {
    expect(canAccept(typedRequest(), null, NOW)).toBe(false);
  });

  it('lets the owner delete cancelled or expired requests from history', () => {
    expect(canDeleteRequest(typedRequest({ userId: ME, status: 'CANCELLED' }), ME, NOW)).toBe(true);
    expect(
      canDeleteRequest(
        typedRequest({ userId: ME, status: 'OPEN', expiresAt: '2026-09-28T11:00:00Z' }),
        ME,
        NOW,
      ),
    ).toBe(true);
    expect(canDeleteRequest(typedRequest({ userId: ME, status: 'OPEN' }), ME, NOW)).toBe(false);
    expect(canDeleteRequest(typedRequest({ userId: ME, status: 'CANCELLED' }), OTHER, NOW)).toBe(
      false,
    );
  });

  it('lets either party delete a cancelled order from their history', () => {
    const cancelled = {
      id: 'o',
      requestId: 'r',
      requesterId: OTHER,
      acceptorId: ME,
      amount: '1' as Money,
      rate: '1' as Money,
      status: 'CANCELLED' as const,
      createdAt: '',
    };
    expect(canDeleteOrder(cancelled, ME)).toBe(true);
    expect(canDeleteOrder(cancelled, OTHER)).toBe(true);
    expect(canDeleteOrder({ ...cancelled, status: 'COMPLETED' }, ME)).toBe(false);
    expect(canDeleteOrder(cancelled, 'u-3')).toBe(false);
  });

  it('allows messaging until the order is completed', () => {
    const order = {
      id: 'o',
      requestId: 'r',
      requesterId: OTHER,
      acceptorId: ME,
      amount: '1' as Money,
      rate: '1' as Money,
      status: 'ACCEPTED' as const,
      createdAt: '',
    };
    expect(canMessageOrder(order, ME)).toBe(true);
    expect(canMessageOrder(order, OTHER)).toBe(true);
    expect(canMessageOrder({ ...order, status: 'COMPLETED' }, ME)).toBe(false);
    expect(canMessageOrder({ ...order, status: 'CANCELLED' }, ME)).toBe(true);
    expect(canMessageOrder(order, 'u-3')).toBe(false);
  });

  it('works out the caller role on an order', () => {
    const order = {
      id: 'o',
      requestId: 'r',
      requesterId: OTHER,
      acceptorId: ME,
      amount: '1' as Money,
      rate: '1' as Money,
      status: 'ACCEPTED' as const,
      createdAt: '',
    };
    expect(orderRole(order, ME)).toBe('acceptor');
    expect(orderRole(order, OTHER)).toBe('requester');
    expect(orderRole(order, 'u-3')).toBeNull();
  });
});

describe('marketplace filters', () => {
  const list = [
    typedRequest({ id: 'a', side: 'SELL', rate: '1500' as Money, amount: '100' as Money }),
    typedRequest({
      id: 'b',
      side: 'BUY',
      baseCurrencyCode: 'CAD',
      quoteCurrencyCode: 'NGN',
      rate: '950.5' as Money,
      amount: '9.99' as Money,
      notes: 'Bank transfer',
    }),
    typedRequest({
      id: 'c',
      side: 'SELL',
      baseCurrencyCode: 'GBP',
      quoteCurrencyCode: 'USD',
      rate: '1.25' as Money,
      amount: '1000000000000.01' as Money,
    }),
  ];
  const ids = (filters: Partial<typeof DEFAULT_FILTERS>) =>
    filterRequests(list, { ...DEFAULT_FILTERS, ...filters }).map((request) => request.id);

  it('keeps the backend order (newest first) by default', () => {
    expect(ids({})).toEqual(['a', 'b', 'c']);
  });

  it('filters by side, by currency on either side of the pair, and by search', () => {
    expect(ids({ side: 'SELL' })).toEqual(['a', 'c']);
    expect(ids({ currency: 'USD' })).toEqual(['a', 'c']);
    expect(ids({ currency: 'NGN', side: 'BUY' })).toEqual(['b']);
    expect(ids({ search: 'cad/ngn' })).toEqual(['b']);
    expect(ids({ search: 'bank' })).toEqual(['b']);
    expect(ids({ search: 'gbp' })).toEqual(['c']);
  });

  it('sorts by rate and amount with exact decimals', () => {
    expect(ids({ sort: 'RATE_ASC' })).toEqual(['c', 'b', 'a']);
    expect(ids({ sort: 'RATE_DESC' })).toEqual(['a', 'b', 'c']);
    expect(ids({ sort: 'AMOUNT_DESC' })).toEqual(['c', 'a', 'b']);
  });

  it('lists the currencies present and counts active filters', () => {
    expect(currenciesIn(list)).toEqual(['CAD', 'GBP', 'NGN', 'USD']);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, side: 'BUY', currency: 'USD' })).toBe(2);
  });
});

describe('create and edit payloads', () => {
  it('turns an expiry preset into a future instant, or none', () => {
    expect(expiresAtFor('NONE', NOW)).toBeUndefined();
    expect(expiresAtFor('1H', NOW)).toBe('2026-09-28T13:00:00.000Z');
    expect(expiresAtFor('3H', NOW)).toBe('2026-09-28T15:00:00.000Z');
    expect(expiresAtFor('7D', NOW)).toBe('2026-10-05T12:00:00.000Z');
  });

  it('sends only the fields that changed', () => {
    const request = typedRequest({ notes: 'old' });
    const same = { amount: '100.00', rate: '1500', notes: ' old ', expiry: 'KEEP' as const };
    expect(changesFor(request, same, NOW)).toEqual({});
    expect(changesFor(request, { ...same, amount: '120.5', notes: '' }, NOW)).toEqual({
      amount: '120.5',
      notes: '',
    });
    expect(changesFor(request, { ...same, expiry: '24H' }, NOW)).toEqual({
      expiresAt: '2026-09-29T12:00:00.000Z',
    });
  });
});

describe('errors', () => {
  it('maps the verified P2P error codes', () => {
    const conflict = (code: string) => createAppError('conflict', { status: 409, code });
    expect(p2pErrorMessage(conflict('P2P_NOT_OPEN'))).toBe('This request is no longer open.');
    expect(p2pErrorMessage(conflict('P2P_SELF_ACCEPT'))).toBe("You can't accept your own request.");
    expect(
      p2pErrorMessage(createAppError('validation', { status: 400, code: 'P2P_SAME_CURRENCY' })),
    ).toBe('Choose two different currencies.');
    expect(
      p2pErrorMessage(
        createAppError('notFound', {
          status: 404,
          code: 'RESOURCE_NOT_FOUND',
          message: 'Currency not found: XYZ',
        }),
      ),
    ).toBe('Currency not found: XYZ');
    expect(
      requestActionErrorMessage(
        createAppError('notFound', { status: 404, code: 'RESOURCE_NOT_FOUND' }),
      ),
    ).toBe("We couldn't find this request.");
  });
});
