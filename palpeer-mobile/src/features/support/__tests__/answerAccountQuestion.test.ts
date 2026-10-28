import { toMoney } from '@/utils/money';

import {
  answerAccountQuestion,
  isCapacityAiReply,
  isMissingAccountAiReply,
  matchAccountQuestion,
  type AccountSnapshot,
} from '../liveChat/answerAccountQuestion';

const snapshot: AccountSnapshot = {
  email: 'toniksyslab@gmail.com',
  userId: 'user-1',
  profile: {
    id: 'p1',
    userId: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    dateOfBirth: null,
    countryOfResidence: 'NG',
    stateTerritory: null,
    addressLine1: null,
    addressLine2: null,
    city: 'Lagos',
    postalCode: null,
    sourceOfIncome: null,
    monthlyTransactionEstimate: null,
    complete: true,
  },
  wallets: [
    {
      id: 'w-ngn',
      userId: 'user-1',
      currencyCode: 'NGN',
      availableBalance: toMoney('10000'),
      pendingBalance: toMoney('0'),
    },
    {
      id: 'w-cad',
      userId: 'user-1',
      currencyCode: 'CAD',
      availableBalance: toMoney('250.50'),
      pendingBalance: toMoney('10'),
    },
  ],
  recentTransactions: [
    {
      type: 'FUNDING',
      id: 'tx-1',
      userId: 'user-1',
      status: 'SUCCESS',
      walletId: 'w-cad',
      secondaryWalletId: null,
      currencyCode: 'CAD',
      secondaryCurrencyCode: null,
      amount: toMoney('50'),
      secondaryAmount: null,
      appliedRate: null,
      failureReason: null,
      ledgerEntryIds: {},
      createdAt: '2026-10-22T10:00:00Z',
      updatedAt: '2026-10-22T10:00:00Z',
    },
  ],
  instantRates: [
    {
      id: 'r1',
      baseCurrencyCode: 'CAD',
      quoteCurrencyCode: 'NGN',
      buyRate: toMoney('1100'),
      sellRate: toMoney('1120'),
      effectiveDate: '2026-10-22T00:00:00Z',
    },
  ],
};

describe('matchAccountQuestion', () => {
  it('detects wallet and balance questions', () => {
    expect(matchAccountQuestion('what are the wallets on my account')).toBe('wallets');
    expect(matchAccountQuestion('How much balance do I have?')).toBe('wallets');
  });

  it('detects other personal intents', () => {
    expect(matchAccountQuestion('show my recent transactions')).toBe('transactions');
    expect(matchAccountQuestion('what is my email')).toBe('profile');
    expect(matchAccountQuestion('current InstantEX rates')).toBe('rates');
    expect(matchAccountQuestion('how do I fund my wallet')).toBeNull();
  });
});

describe('answerAccountQuestion', () => {
  it('lists live wallets from the Palpeer snapshot', () => {
    const text = answerAccountQuestion('wallets', snapshot);
    expect(text).toContain('toniksyslab@gmail.com');
    expect(text).toContain('NGN');
    expect(text).toContain('CAD');
    expect(text).toContain('available');
    expect(text).not.toContain('could not find');
  });

  it('formats profile and detects missing-account AI replies', () => {
    expect(answerAccountQuestion('profile', snapshot)).toContain('Ada Lovelace');
    expect(
      isMissingAccountAiReply(
        "I couldn't find a Palpeer account linked to toniksyslab@gmail.com. Please confirm you're using the email registered on Palpeer.",
      ),
    ).toBe(true);
  });

  it('detects Support AI capacity / high-demand stubs', () => {
    expect(
      isCapacityAiReply(
        "I apologize, but I'm currently experiencing high demand. I can connect you with a human agent who can help you right away. Would you like to speak with an agent?",
      ),
    ).toBe(true);
    expect(isCapacityAiReply('Here are your wallet balances.')).toBe(false);
  });
});
