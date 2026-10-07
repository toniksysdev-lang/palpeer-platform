import { parseJson, jsonDecimal, stringifyJson } from '@/services/api/json';
import type { CurrencyResponse } from '@/types/api/wallet';
import { compareMoney } from '@/utils/money';

import {
  cadReference,
  describeDestination,
  ngnReference,
  validateCad,
  validateNgn,
} from '../destination';
import { FUNDING_POLL_MS, IDLE_POLL_MS, isInProgress, pollingIntervalFor } from '../movementStatus';
import { hasPaymentRail, railFor } from '../rails';
import { formatAmount } from '../useMoneyFormat';

const CURRENCIES: CurrencyResponse[] = [
  { id: 'c-1', code: 'CAD', symbol: 'C$', precision: 2 },
  { id: 'c-2', code: 'BTC', symbol: 'B', precision: 8 },
];

describe('money from the backend', () => {
  it('keeps balances exact from JSON through to display', () => {
    const wallet = parseJson<{ availableBalance: string; pendingBalance: string }>(
      '{"availableBalance":98765432109876543.210000000000,"pendingBalance":0.000000000000}',
    );
    expect(wallet.availableBalance).toBe('98765432109876543.210000000000');
    expect(formatAmount(wallet.availableBalance, 'CAD', CURRENCIES)).toBe(
      '98,765,432,109,876,543.21 CAD',
    );
  });

  it('handles the exponent form the backend uses for zero balances', () => {
    const wallet = parseJson<{ availableBalance: string; pendingBalance: string }>(
      '{"availableBalance":0E-12,"pendingBalance":1.5E-11}',
    );
    expect(wallet.availableBalance).toBe('0E-12');
    expect(formatAmount(wallet.availableBalance, 'CAD', CURRENCIES)).toBe('0.00 CAD');
    expect(formatAmount(wallet.availableBalance, 'NGN', undefined)).toBe('0.00 NGN');
    expect(compareMoney(wallet.availableBalance, '0')).toBe(0);
    expect(compareMoney(wallet.pendingBalance, '0')).toBe(1);
  });

  it('formats with the currency precision and rounds half-even for display only', () => {
    expect(formatAmount('1500.000000000000', 'CAD', CURRENCIES)).toBe('1,500.00 CAD');
    expect(formatAmount('0.125', 'CAD', CURRENCIES)).toBe('0.12 CAD');
    expect(formatAmount('0.123456789', 'BTC', CURRENCIES)).toBe('0.12345679 BTC');
  });

  it('shows the exact value when the currency precision is unknown', () => {
    expect(formatAmount('12.3456', 'NGN', undefined)).toBe('12.3456 NGN');
    expect(formatAmount('12.000000000000', 'NGN', [])).toBe('12.00 NGN');
  });

  it('sends amounts as exact JSON numbers', () => {
    expect(stringifyJson({ amount: jsonDecimal('12345678901234567.89') })).toBe(
      '{"amount":12345678901234567.89}',
    );
  });
});

describe('payment rails', () => {
  it('only CAD and NGN have a funding/withdrawal rail', () => {
    expect(railFor('CAD')).toBe('APAYLO');
    expect(railFor('ngn')).toBe('KUDA');
    expect(hasPaymentRail('USD')).toBe(false);
    expect(hasPaymentRail('GBP')).toBe(false);
  });
});

describe('movement status', () => {
  it('treats only INITIATED, PENDING and PROCESSING as in progress', () => {
    expect(['INITIATED', 'PENDING', 'PROCESSING'].every(isInProgress)).toBe(true);
    expect(['SUCCESS', 'FAILED', 'REVERSED'].some(isInProgress)).toBe(false);
  });

  it('polls while in progress and stops at a final status', () => {
    expect(pollingIntervalFor('PENDING', true)).toBe(FUNDING_POLL_MS);
    expect(pollingIntervalFor('INITIATED', false)).toBe(IDLE_POLL_MS);
    expect(pollingIntervalFor('SUCCESS', true)).toBe(0);
    expect(pollingIntervalFor(undefined, true)).toBe(0);
  });
});

describe('withdrawal destinations', () => {
  it('builds CAD references the backend routes correctly', () => {
    expect(cadReference({ method: 'email', email: ' ada@example.com ' })).toBe('ada@example.com');
    expect(cadReference({ method: 'phone', phone: '+1 416 555 0100' })).toBe('+1 416 555 0100');
    expect(
      cadReference({ method: 'eft', institution: '001', transit: '12345', account: '9876543' }),
    ).toBe('001:12345:9876543');
  });

  it('validates CAD destinations like the backend parser', () => {
    expect(validateCad({ method: 'email', email: 'not-an-email' })).toHaveProperty('email');
    expect(validateCad({ method: 'phone', phone: 'ada@example.com' })).toHaveProperty('phone');
    expect(validateCad({ method: 'phone', phone: '4165550100' })).toEqual({});
    expect(validateCad({ method: 'eft', institution: '01', transit: '1234', account: '' })).toEqual(
      {
        institution: expect.any(String),
        transit: expect.any(String),
        account: expect.any(String),
      },
    );
  });

  it('requires both parts of an NGN destination', () => {
    expect(validateNgn({ bankCode: '', accountNumber: '0123456789' })).toHaveProperty('bankCode');
    expect(ngnReference({ bankCode: '058', accountNumber: '0123456789' })).toBe('058:0123456789');
  });

  it('masks account numbers when describing a destination', () => {
    expect(describeDestination('CAD', '001:12345:9876543')).toBe(
      'Bank transfer (EFT) · 001-12345 · account ending 6543',
    );
    expect(describeDestination('NGN', '058:0123456789')).toBe('Bank 058 · account ending 6789');
    expect(describeDestination('CAD', 'ada@example.com')).toBe(
      'Interac e-Transfer to ada@example.com',
    );
  });
});
