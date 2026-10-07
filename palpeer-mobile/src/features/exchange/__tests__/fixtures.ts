import { ok } from '@/tests/fetchMock';

export const CURRENCIES = ok([
  { id: 'c-cad', code: 'CAD', symbol: 'C$', precision: 2 },
  { id: 'c-ngn', code: 'NGN', symbol: 'N', precision: 2 },
  { id: 'c-usd', code: 'USD', symbol: '$', precision: 2 },
]);

export const wallet = (id: string, currencyCode: string, availableBalance = '0E-12') => ({
  id,
  userId: 'u-1',
  currencyCode,
  availableBalance,
  pendingBalance: '0E-12',
});

export const WALLETS = ok([
  wallet('w-cad', 'CAD', '500.000000000000'),
  wallet('w-ngn', 'NGN', '0E-12'),
  wallet('w-usd', 'USD', '0E-12'),
]);

export const calculation = (overrides: Record<string, unknown> = {}) => ({
  sourceWalletId: 'w-cad',
  targetWalletId: 'w-ngn',
  sourceCurrencyCode: 'CAD',
  targetCurrencyCode: 'NGN',
  sourceAmount: '100.00',
  targetAmount: '105000.00',
  appliedRate: '1050.000000000000',
  rateSide: 'SELL',
  ...overrides,
});

export const quote = (overrides: Record<string, unknown> = {}) => ({
  ...calculation(),
  quoteId: 'q-1',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  status: 'OPEN',
  ...overrides,
});

export const exchange = (overrides: Record<string, unknown> = {}) => ({
  id: 'x-1',
  quoteId: 'q-1',
  sourceWalletId: 'w-cad',
  targetWalletId: 'w-ngn',
  sourceAmount: '100.000000000000',
  targetAmount: '105000.000000000000',
  appliedRate: '1050.000000000000',
  status: 'SUCCESS',
  idempotencyKey: 'k',
  debitLedgerEntryId: 'l-1',
  creditLedgerEntryId: 'l-2',
  failureReason: null,
  createdAt: '2026-09-28T21:40:08Z',
  ...overrides,
});

export const created = (data: unknown) => ({
  status: 201,
  body: { success: true, data, timestamp: '' },
});
