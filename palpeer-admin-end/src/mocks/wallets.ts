import type { SpringPage } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import type { LedgerTransactionSummary, WalletSummary } from '@/types/wallets';

const now = Date.now();

const catalog: WalletSummary[] = [
  {
    id: 'w-1',
    userId: 'u-2',
    currencyCode: 'CAD',
    availableBalance: '1250.55',
    pendingBalance: '0.00',
  },
  {
    id: 'w-2',
    userId: 'u-2',
    currencyCode: 'NGN',
    availableBalance: '480000.00',
    pendingBalance: '15000.00',
  },
  {
    id: 'w-3',
    userId: 'u-3',
    currencyCode: 'CAD',
    availableBalance: '80.00',
    pendingBalance: '20.00',
  },
];

const ledger: Record<string, LedgerTransactionSummary[]> = {
  'w-1': [
    {
      id: 'lt-1',
      walletId: 'w-1',
      entryType: 'CREDIT',
      amount: '250.00',
      currencyCode: 'CAD',
      availableBalanceAfter: '1250.55',
      pendingBalanceAfter: '0.00',
      referenceType: 'FUNDING',
      referenceId: 'tx-fund-u-2',
      description: 'Mock funding credit',
      createdAt: new Date(now - 3600000).toISOString(),
    },
  ],
  'w-2': [],
  'w-3': [],
};

function toPage<T>(rows: T[], page: number, size: number): SpringPage<T> {
  const start = page * size;
  const content = rows.slice(start, start + size);
  const totalElements = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size) || 1);
  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    numberOfElements: content.length,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export function mockListWallets(params?: {
  page?: number;
  size?: number;
  userId?: string;
  currencyCode?: string;
}): SpringPage<WalletSummary> {
  return toPage(
    catalog
      .filter(
        (wallet) =>
          (!params?.userId || wallet.userId === params.userId) &&
          (!params?.currencyCode || wallet.currencyCode === params.currencyCode),
      )
      .map((wallet) => ({ ...wallet })),
    params?.page ?? 0,
    params?.size ?? 20,
  );
}

export function mockGetWallet(walletId: string): WalletSummary {
  const found = catalog.find((wallet) => wallet.id === walletId);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Wallet not found');
  }
  return { ...found };
}

export function mockWalletTransactions(
  walletId: string,
  params?: { page?: number; size?: number },
): SpringPage<LedgerTransactionSummary> {
  const rows = (ledger[walletId] ?? []).map((row) => ({ ...row }));
  return toPage(rows, params?.page ?? 0, params?.size ?? 20);
}
