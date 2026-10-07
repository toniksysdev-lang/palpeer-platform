import type { BinaryResponse } from '@/services/api/client';
import { ApiClientError } from '@/types/api';
import type { TransactionItem, TransactionPage } from '@/types/users';

const now = Date.now();

function itemsForUser(userId: string): TransactionItem[] {
  return [
    {
      type: 'FUNDING',
      id: '00000000-0000-4000-8000-000000000101',
      status: 'COMPLETED',
      walletId: 'w-1',
      currencyCode: 'CAD',
      amount: '250.00',
      createdAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now - 3600000).toISOString(),
    },
    {
      type: 'WITHDRAWAL',
      id: '11111111-1111-4111-8111-111111111111',
      status: 'FAILED',
      walletId: 'w-1',
      currencyCode: 'CAD',
      amount: '40.00',
      failureReason: 'Provider declined (mock)',
      createdAt: new Date(now - 7200000).toISOString(),
      updatedAt: new Date(now - 7000000).toISOString(),
    },
    {
      type: 'EXCHANGE',
      id: '22222222-2222-4222-8222-222222222222',
      status: 'COMPLETED',
      walletId: 'w-1',
      secondaryWalletId: 'w-2',
      currencyCode: 'CAD',
      secondaryCurrencyCode: 'NGN',
      amount: '100.00',
      secondaryAmount: '104850.00',
      appliedRate: '1048.50',
      ledgerEntryIds: { debit: 'le-1', credit: 'le-2' },
      createdAt: new Date(now - 86400000).toISOString(),
      updatedAt: new Date(now - 86400000).toISOString(),
    },
  ].map((row) => ({
    ...row,
    // Keep fixture ids stable; userId is only used for query routing in mock mode.
    failureReason:
      row.type === 'WITHDRAWAL' ? `${row.failureReason} · user ${userId}` : row.failureReason,
  }));
}

const globalCatalog: TransactionItem[] = [
  {
    type: 'FUNDING',
    id: '33333333-3333-4333-8333-333333333301',
    userId: 'u-2',
    status: 'SUCCESS',
    walletId: 'w-1',
    currencyCode: 'CAD',
    amount: '250.00',
    createdAt: new Date(now - 3600000).toISOString(),
    updatedAt: new Date(now - 3500000).toISOString(),
  },
  {
    type: 'EXCHANGE',
    id: '33333333-3333-4333-8333-333333333302',
    userId: 'u-2',
    status: 'SUCCESS',
    walletId: 'w-1',
    secondaryWalletId: 'w-2',
    currencyCode: 'CAD',
    secondaryCurrencyCode: 'NGN',
    amount: '100.00',
    secondaryAmount: '104850.00',
    appliedRate: '1048.50',
    ledgerEntryIds: { debit: 'le-1', credit: 'le-2' },
    createdAt: new Date(now - 7200000).toISOString(),
    updatedAt: new Date(now - 7200000).toISOString(),
  },
  {
    type: 'WITHDRAWAL',
    id: '33333333-3333-4333-8333-333333333303',
    userId: 'u-3',
    status: 'FAILED',
    walletId: 'w-3',
    currencyCode: 'CAD',
    amount: '40.00',
    failureReason: 'Provider declined (mock)',
    createdAt: new Date(now - 86400000).toISOString(),
    updatedAt: new Date(now - 86000000).toISOString(),
  },
  {
    type: 'FUNDING',
    id: '33333333-3333-4333-8333-333333333304',
    userId: 'u-3',
    status: 'PENDING',
    walletId: 'w-3',
    currencyCode: 'CAD',
    amount: '75.00',
    createdAt: new Date(now - 86400000 * 2).toISOString(),
    updatedAt: new Date(now - 86400000 * 2).toISOString(),
  },
  {
    type: 'WITHDRAWAL',
    id: '33333333-3333-4333-8333-333333333305',
    userId: 'u-2',
    status: 'SUCCESS',
    walletId: 'w-2',
    currencyCode: 'NGN',
    amount: '15000.00',
    createdAt: new Date(now - 86400000 * 5).toISOString(),
    updatedAt: new Date(now - 86400000 * 5).toISOString(),
  },
];

type MockTransactionFilters = {
  type?: string;
  status?: string;
  currencyCode?: string;
  userId?: string;
  from?: string;
  to?: string;
};

function filterGlobal(params: MockTransactionFilters): TransactionItem[] {
  const from = params.from ? Date.parse(params.from) : null;
  const to = params.to ? Date.parse(params.to) : null;
  return globalCatalog
    .filter((row) => {
      const created = Date.parse(row.createdAt);
      return (
        (!params.type || row.type === params.type) &&
        (!params.status || row.status === params.status) &&
        (!params.currencyCode || row.currencyCode === params.currencyCode) &&
        (!params.userId || row.userId === params.userId) &&
        (from == null || created >= from) &&
        (to == null || created <= to)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mockSearchTransactions(
  params: MockTransactionFilters & { page?: number; size?: number } = {},
): TransactionPage {
  const rows = filterGlobal(params);
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const start = page * size;
  return {
    items: rows.slice(start, start + size).map((row) => ({ ...row })),
    page,
    size,
    totalElements: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)),
  };
}

export function mockGetTransaction(type: string, id: string): TransactionItem {
  const found = globalCatalog.find((row) => row.type === type && row.id === id);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Transaction not found');
  }
  return { ...found };
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function mockExportTransactions(params: MockTransactionFilters = {}): BinaryResponse {
  const header = ['type', 'id', 'userId', 'status', 'currencyCode', 'amount', 'createdAt'];
  const lines = filterGlobal(params).map((row) =>
    [row.type, row.id, row.userId, row.status, row.currencyCode, row.amount, row.createdAt]
      .map(csvCell)
      .join(','),
  );
  const csv = [header.join(','), ...lines].join('\n');
  return {
    blob: new Blob([csv], { type: 'text/csv' }),
    contentType: 'text/csv',
    filename: null,
  };
}

export function mockAdminRecentTransactions(userId: string): TransactionItem[] {
  return itemsForUser(userId).slice(0, 2);
}

export function mockAdminTransactionHistory(
  userId: string,
  params?: { type?: string; page?: number; size?: number },
): TransactionPage {
  let rows = itemsForUser(userId);
  if (params?.type) {
    rows = rows.filter((row) => row.type === params.type);
  }
  const page = params?.page ?? 0;
  const size = params?.size ?? 20;
  const start = page * size;
  const slice = rows.slice(start, start + size);
  return {
    items: slice,
    page,
    size,
    totalElements: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / size)),
  };
}
