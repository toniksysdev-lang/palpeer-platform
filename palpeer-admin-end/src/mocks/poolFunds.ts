import type { PoolFundsBalances } from '@/types/poolFunds';

/** Mock treasury balances for dashboard Liquidity Pool KPIs. */
export function mockPoolFundsBalances(): PoolFundsBalances {
  return {
    apaylo: {
      provider: 'APAYLO',
      currencyCode: 'CAD',
      configured: true,
      available: true,
      balance: '125000.00',
      liveBalance: '125000.00',
      message: null,
    },
    kuda: {
      provider: 'KUDA',
      currencyCode: 'NGN',
      configured: true,
      available: true,
      balance: '85000000.00',
      liveBalance: '85000000.00',
      message: null,
    },
    korapay: {
      provider: 'KORAPAY',
      currencyCode: 'NGN',
      configured: false,
      available: false,
      balance: null,
      message: 'Not configured',
    },
  };
}
