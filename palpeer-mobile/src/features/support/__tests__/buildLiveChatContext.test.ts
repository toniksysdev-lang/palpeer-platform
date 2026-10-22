import { toMoney } from '@/utils/money';

import { buildLiveChatContext } from '../liveChat/buildLiveChatContext';

describe('buildLiveChatContext', () => {
  it('includes profile, wallets, five recent transactions, and InstantEX rates', () => {
    const text = buildLiveChatContext({
      email: 'user@example.com',
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
      ],
      recentTransactions: [
        {
          type: 'WITHDRAWAL',
          id: 'tx-1',
          userId: 'user-1',
          status: 'SUCCESS',
          walletId: 'w-ngn',
          secondaryWalletId: null,
          currencyCode: 'NGN',
          secondaryCurrencyCode: null,
          amount: toMoney('2500'),
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
    });

    expect(text).toContain('AUTHENTICATED_APP_SESSION: yes');
    expect(text).toContain('NEVER say the Palpeer account was not found');
    expect(text).toContain('Email: user@example.com');
    expect(text).toContain('Name: Ada Lovelace');
    expect(text).toContain('NGN: available=');
    expect(text).toContain('WITHDRAWAL id=tx-1');
    expect(text).toContain('CAD/NGN');
    expect(text).toContain('shouldEscalate');
    expect(text).toContain('operational How-To knowledge');
    expect(text).toContain('How do I add money?');
    expect(text).toContain('How do I swap between my wallets?');
  });

  it('can omit the operational guide', () => {
    const text = buildLiveChatContext({
      email: null,
      userId: null,
      profile: null,
      wallets: [],
      recentTransactions: [],
      instantRates: [],
      includeOperationalGuide: false,
    });
    expect(text).not.toContain('operational How-To knowledge');
  });
});
