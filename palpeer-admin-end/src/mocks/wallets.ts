import type { SpringPage } from '@/types/admin';
import { ApiClientError } from '@/types/api';
import type {
  AdminMoneyMovement,
  LedgerTransactionSummary,
  MoneyMovementStatus,
  WalletSummary,
} from '@/types/wallets';

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

const movements: AdminMoneyMovement[] = [
  {
    id: 'tx-fund-u-2',
    type: 'FUNDING',
    walletId: 'w-1',
    userId: 'u-2',
    amount: '250.00',
    currencyCode: 'CAD',
    status: 'SUCCESS',
    failureReason: null,
    reference: 'mock-provider-ref',
    providerName: 'MOCK',
    createdAt: new Date(now - 3600000).toISOString(),
  },
  {
    id: 'tx-wd-pending',
    type: 'WITHDRAWAL',
    walletId: 'w-2',
    userId: 'u-2',
    amount: '15000.00',
    currencyCode: 'NGN',
    status: 'PENDING',
    failureReason: null,
    reference: 'bank-123',
    providerName: null,
    createdAt: new Date(now - 1800000).toISOString(),
  },
];

export function mockWalletMovements(walletId: string): AdminMoneyMovement[] {
  return movements
    .filter((row) => row.walletId === walletId)
    .map((row) => ({ ...row }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mockCreateFunding(
  walletId: string,
  amount: string,
  providerReference?: string,
): AdminMoneyMovement {
  const wallet = mockGetWallet(walletId);
  const created: AdminMoneyMovement = {
    id: `tx-fund-${Date.now()}`,
    type: 'FUNDING',
    walletId,
    userId: wallet.userId,
    amount,
    currencyCode: wallet.currencyCode,
    status: 'INITIATED',
    failureReason: null,
    reference: providerReference ?? null,
    providerName: null,
    createdAt: new Date().toISOString(),
  };
  movements.unshift(created);
  return { ...created };
}

export function mockCreateWithdrawal(
  walletId: string,
  amount: string,
  destinationReference?: string,
): AdminMoneyMovement {
  const wallet = mockGetWallet(walletId);
  const created: AdminMoneyMovement = {
    id: `tx-wd-${Date.now()}`,
    type: 'WITHDRAWAL',
    walletId,
    userId: wallet.userId,
    amount,
    currencyCode: wallet.currencyCode,
    status: 'PENDING',
    failureReason: null,
    reference: destinationReference ?? null,
    providerName: null,
    createdAt: new Date().toISOString(),
  };
  movements.unshift(created);
  const pending = Number(wallet.pendingBalance) + Number(amount);
  const available = Number(wallet.availableBalance) - Number(amount);
  wallet.availableBalance = available.toFixed(2);
  wallet.pendingBalance = pending.toFixed(2);
  const idx = catalog.findIndex((row) => row.id === walletId);
  if (idx >= 0) catalog[idx] = { ...wallet };
  return { ...created };
}

export function mockActOnMovement(
  walletId: string,
  movementId: string,
  action: 'process' | 'fail' | 'reverse',
  reason?: string,
): AdminMoneyMovement {
  const row = movements.find((item) => item.id === movementId && item.walletId === walletId);
  if (!row) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Movement not found');
  }
  let next: MoneyMovementStatus = row.status;
  if (action === 'process') next = 'SUCCESS';
  if (action === 'fail') next = 'FAILED';
  if (action === 'reverse') next = 'REVERSED';
  row.status = next;
  row.failureReason = action === 'fail' ? reason ?? 'Failed by admin' : row.failureReason;
  if (action === 'process' && row.type === 'FUNDING') {
    const wallet = mockGetWallet(walletId);
    wallet.availableBalance = (Number(wallet.availableBalance) + Number(row.amount)).toFixed(2);
    const idx = catalog.findIndex((item) => item.id === walletId);
    if (idx >= 0) catalog[idx] = { ...wallet };
  }
  return { ...row };
}
