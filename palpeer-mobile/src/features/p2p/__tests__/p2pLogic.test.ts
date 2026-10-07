import { createAppError } from '@/services/api/errors';
import type { P2PStatus } from '@/types/api/p2p';
import type { Money } from '@/utils/money';

import { p2pErrorMessage, requestActionErrorMessage } from '../errors';
import {
  activeFilterCount,
  canAccept,
  canManage,
  changesFor,
  currenciesIn,
  DEFAULT_FILTERS,
  effectiveStatus,
  expiresAtFor,
  filterRequests,
  orderRole,
  p2pRateLine,
  sideLabel,
} from '../logic';
import { ME, OTHER, typedRequest } from './fixtures';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const STATUSES: P2PStatus[] = ['OPEN', 'ACCEPTED', 'COMPLETED', 'EXPIRED', 'CANCELLED'];

describe('labels', () => {
  it('uses neutral buy/sell wording for base and quote', () => {
    expect(sideLabel('BUY', 'USD', 'NGN', 'self')).toBe('You want to buy USD for NGN');
    expect(sideLabel('SELL', 'USD', 'NGN', 'other')).toBe('Wants to sell USD for NGN');
  });

  it('shows the backend rate exactly, without trailing zeros', () => {
    expect(p2pRateLine('1500.000000000000', 'USD', 'NGN')).toBe('1 USD = 1,500 NGN');
    expect(p2pRateLine('0.000712345678', 'NGN', 'USD')).toBe('1 NGN = 0.000712 USD');
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
