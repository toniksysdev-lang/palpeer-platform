import type { TransactionItemResponse } from '@/types/api/transaction';
import type { Money } from '@/utils/money';

export const item = (
  overrides: Partial<TransactionItemResponse> = {},
): TransactionItemResponse => ({
  type: 'FUNDING',
  id: 'f-1',
  userId: 'u-1',
  status: 'SUCCESS',
  walletId: 'w-cad',
  secondaryWalletId: null,
  currencyCode: 'CAD',
  secondaryCurrencyCode: null,
  amount: '250.00' as Money,
  secondaryAmount: null,
  appliedRate: null,
  failureReason: null,
  ledgerEntryIds: { credit: 'l-1' },
  createdAt: '2026-09-29T10:00:00Z',
  updatedAt: '2026-09-29T10:05:00Z',
  ...overrides,
});

export const exchangeItem = (overrides: Partial<TransactionItemResponse> = {}) =>
  item({
    type: 'EXCHANGE',
    id: 'x-1',
    walletId: 'w-cad',
    secondaryWalletId: 'w-ngn',
    currencyCode: 'CAD',
    secondaryCurrencyCode: 'NGN',
    amount: '100.00' as Money,
    secondaryAmount: '108945.12' as Money,
    appliedRate: '1089.451200000000' as Money,
    ledgerEntryIds: { debit: 'l-2', credit: 'l-3' },
    ...overrides,
  });

export const withdrawalItem = (overrides: Partial<TransactionItemResponse> = {}) =>
  item({
    type: 'WITHDRAWAL',
    id: 'wd-1',
    status: 'PENDING',
    amount: '100.00' as Money,
    ledgerEntryIds: { hold: 'l-4' },
    ...overrides,
  });

export const historyPage = (
  items: TransactionItemResponse[],
  { page = 0, totalPages = 1 }: { page?: number; totalPages?: number } = {},
) => ({ items, page, size: 20, totalElements: items.length, totalPages });

export const summary = (overrides: Record<string, unknown> = {}) => ({
  from: '1970-01-01T00:00:00Z',
  to: '2026-09-29T12:00:00Z',
  totalCount: 3,
  countByType: { FUNDING: 1, WITHDRAWAL: 1, EXCHANGE: 1 },
  countByStatus: { 'FUNDING:SUCCESS': 1, 'WITHDRAWAL:PENDING': 1, 'EXCHANGE:SUCCESS': 1 },
  successfulFundingByCurrency: [{ currencyCode: 'CAD', totalAmount: '250.00', count: 1 }],
  successfulWithdrawalByCurrency: [],
  successfulExchangeCount: 1,
  ...overrides,
});
