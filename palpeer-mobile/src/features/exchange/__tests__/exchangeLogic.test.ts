import { createAppError } from '@/services/api/errors';
import { jsonDecimal, parseJson, stringifyJson } from '@/services/api/json';

import {
  executeErrorMessage,
  NEED_TWO_WALLETS_MESSAGE,
  NO_RATE_MESSAGE,
  needsNewQuote,
  quoteErrorMessage,
} from '../errors';
import { canExchange, formatRateLine, formatRateValue, secondsUntil } from '../format';

const wallet = (currencyCode: string) => ({
  id: `w-${currencyCode}`,
  userId: 'u-1',
  currencyCode,
  availableBalance: '0' as never,
  pendingBalance: '0' as never,
});

describe('rate display', () => {
  it('shows backend rates exactly, grouped, without trailing zeros', () => {
    expect(formatRateValue('1050.000000000000')).toBe('1,050');
    expect(formatRateValue('0.001050000000')).toBe('0.00105');
    expect(formatRateValue('0.000952380952')).toBe('0.000952');
    expect(formatRateValue('1532.123456789')).toBe('1,532.123457');
    expect(formatRateValue('1532.1234565')).toBe('1,532.123456');
  });

  it('keeps a rate exact from JSON to the rate line', () => {
    const quote = parseJson<{ appliedRate: string }>('{"appliedRate":1050.000000000001}');
    expect(quote.appliedRate).toBe('1050.000000000001');
    expect(formatRateLine(quote.appliedRate, 'CAD', 'NGN')).toBe('1 CAD = 1,050 NGN');
    expect(formatRateValue(quote.appliedRate, 12)).toBe('1,050.000000000001');
  });

  it('sends typed amounts as exact JSON numbers', () => {
    expect(
      stringifyJson({
        sourceWalletId: 'w-cad',
        targetWalletId: 'w-ngn',
        sourceAmount: jsonDecimal('0.10'),
      }),
    ).toBe('{"sourceWalletId":"w-cad","targetWalletId":"w-ngn","sourceAmount":0.10}');
  });
});

describe('exchange rules', () => {
  it('needs two wallets in different currencies', () => {
    expect(canExchange([])).toBe(false);
    expect(canExchange([wallet('CAD')])).toBe(false);
    expect(canExchange([wallet('CAD'), wallet('NGN')])).toBe(true);
  });

  it('counts quote seconds down to zero', () => {
    const now = Date.parse('2026-09-28T10:00:00Z');
    expect(secondsUntil('2026-09-28T10:01:00Z', now)).toBe(60);
    expect(secondsUntil('2026-09-28T10:00:00.400Z', now)).toBe(1);
    expect(secondsUntil('2026-09-28T09:59:00Z', now)).toBe(0);
  });
});

describe('exchange errors', () => {
  it('uses the evidence copy', () => {
    expect(NO_RATE_MESSAGE).toBe('Cannot currently swap between these currencies.');
    expect(NEED_TWO_WALLETS_MESSAGE).toBe(
      'You need at least two different currency wallets to perform a swap.',
    );
  });

  it('maps quote and execute errors', () => {
    const notFound = createAppError('notFound', { status: 404, code: 'RESOURCE_NOT_FOUND' });
    expect(quoteErrorMessage(notFound)).toBe(NO_RATE_MESSAGE);
    expect(executeErrorMessage(notFound)).toMatch(/Get a new quote/);
    expect(needsNewQuote(notFound)).toBe(true);

    const expired = createAppError('conflict', { status: 409, code: 'EXCHANGE_QUOTE_EXPIRED' });
    expect(executeErrorMessage(expired)).toBe(
      'This quote has expired. Get a new quote to continue.',
    );
    expect(needsNewQuote(expired)).toBe(true);

    const balance = createAppError('unprocessable', {
      status: 422,
      code: 'INSUFFICIENT_AVAILABLE_BALANCE',
    });
    expect(executeErrorMessage(balance)).toBe(
      "You don't have enough available balance for this exchange.",
    );
    expect(needsNewQuote(balance)).toBe(false);
  });
});
