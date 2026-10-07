import { createAppError } from '@/services/api/errors';

import {
  canFreeze,
  canUnfreeze,
  cardErrorMessage,
  cardStatusLabel,
  expiryLabel,
  isCardCredit,
  isTestCard,
  maskedNumber,
} from '../logic';

describe('card logic', () => {
  it('only ever shows the last four digits', () => {
    expect(maskedNumber('4242')).toBe('•••• 4242');
    expect(maskedNumber('4111111111111111')).toBe('•••• 1111');
    expect(maskedNumber('')).toBe('•••• ••••');
  });

  it('formats the expiry as MM/YY', () => {
    expect(expiryLabel({ expiryMonth: 3, expiryYear: 2030 })).toBe('03/30');
    expect(expiryLabel({ expiryMonth: null, expiryYear: 2030 })).toBe('--/--');
  });

  it('labels stub-issued cards as test cards', () => {
    expect(isTestCard({ providerName: 'STUB' })).toBe(true);
    expect(isTestCard({ providerName: 'stub' })).toBe(true);
    expect(isTestCard({ providerName: 'MARQETA' })).toBe(false);
  });

  it('calls a blocked card frozen and allows freeze/unfreeze by status', () => {
    expect(cardStatusLabel('BLOCKED')).toBe('Frozen');
    expect(canFreeze({ status: 'ACTIVE' })).toBe(true);
    expect(canFreeze({ status: 'BLOCKED' })).toBe(false);
    expect(canUnfreeze({ status: 'BLOCKED' })).toBe(true);
    expect(canUnfreeze({ status: 'CLOSED' })).toBe(false);
    expect(canFreeze({ status: 'CLOSED' })).toBe(false);
  });

  it('treats refunds and reversals as credits', () => {
    expect(isCardCredit({ entryType: 'REFUND' })).toBe(true);
    expect(isCardCredit({ entryType: 'REVERSAL' })).toBe(true);
    expect(isCardCredit({ entryType: 'CAPTURE' })).toBe(false);
  });

  it('maps backend card errors to friendly messages', () => {
    const error = (status: number, code: string | null, message: string) => ({
      ...createAppError('conflict'),
      status,
      code,
      message,
    });
    expect(cardErrorMessage(error(409, 'CARD_CLOSED', 'x'))).toMatch(/closed/);
    expect(cardErrorMessage(error(409, 'CARD_NOT_BLOCKED', 'x'))).toBe("This card isn't frozen.");
    expect(cardErrorMessage(error(400, 'CARD_WALLET_CURRENCY_MISMATCH', 'x'))).toMatch(
      /same currency/,
    );
    expect(cardErrorMessage(error(404, null, 'Card not found'))).toBe("This card wasn't found.");
    expect(cardErrorMessage(error(404, null, 'Wallet not found'))).toMatch(/wallet/);
    expect(cardErrorMessage(error(500, null, 'Boom'))).toBe('Boom');
  });
});
