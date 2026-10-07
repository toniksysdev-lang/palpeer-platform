import { ApiClientError } from '@/types/api';
import type { AdminUserSummary, SpringPage } from '@/types/admin';
import type { TransactionItem, TransactionPage, UpdateUserAdminInput } from '@/types/users';

const now = Date.now();

export const mockUsersCatalog: AdminUserSummary[] = [
  {
    id: 'u-1',
    email: 'operator@palpeer.local',
    phone: '+10000000001',
    status: 'ACTIVE',
    enabled: true,
    emailVerified: true,
    phoneVerified: true,
    createdAt: new Date(now - 86400000 * 40).toISOString(),
  },
  {
    id: 'u-2',
    email: 'member@palpeer.local',
    phone: '+10000000002',
    status: 'PENDING_VERIFICATION',
    enabled: true,
    emailVerified: false,
    phoneVerified: false,
    createdAt: new Date(now - 86400000 * 2).toISOString(),
  },
  {
    id: 'u-3',
    email: 'trader@palpeer.local',
    phone: null,
    status: 'ACTIVE',
    enabled: true,
    emailVerified: true,
    phoneVerified: true,
    createdAt: new Date(now - 86400000 * 18).toISOString(),
  },
  {
    id: 'u-4',
    email: 'suspended@palpeer.local',
    phone: '+10000000004',
    status: 'SUSPENDED',
    enabled: false,
    emailVerified: true,
    phoneVerified: true,
    createdAt: new Date(now - 86400000 * 90).toISOString(),
  },
  {
    id: 'u-5',
    email: 'closed@palpeer.local',
    phone: null,
    status: 'CLOSED',
    enabled: false,
    emailVerified: true,
    phoneVerified: false,
    createdAt: new Date(now - 86400000 * 200).toISOString(),
  },
];

function sortUsers(rows: AdminUserSummary[], sort?: string): AdminUserSummary[] {
  const [field, direction] = (sort ?? 'createdAt,desc').split(',');
  const desc = direction !== 'asc';
  return [...rows].sort((a, b) => {
    const left = String((a as Record<string, unknown>)[field ?? 'createdAt'] ?? '');
    const right = String((b as Record<string, unknown>)[field ?? 'createdAt'] ?? '');
    const cmp = left.localeCompare(right);
    return desc ? -cmp : cmp;
  });
}

export function mockListUsers(params?: {
  page?: number;
  size?: number;
  sort?: string;
  email?: string;
  status?: string;
}): SpringPage<AdminUserSummary> {
  const page = params?.page ?? 0;
  const size = params?.size ?? 20;
  const email = params?.email?.toLowerCase();
  const filtered = mockUsersCatalog.filter(
    (user) =>
      (!email || user.email.toLowerCase().includes(email)) &&
      (!params?.status || user.status === params.status),
  );
  const sorted = sortUsers(filtered, params?.sort);
  const start = page * size;
  const content = sorted.slice(start, start + size);
  const totalElements = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
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

export function mockGetUser(userId: string): AdminUserSummary {
  const found = mockUsersCatalog.find((user) => user.id === userId);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'User not found');
  }
  return found;
}

export function mockUpdateUser(userId: string, input: UpdateUserAdminInput): AdminUserSummary {
  const index = mockUsersCatalog.findIndex((user) => user.id === userId);
  if (index < 0) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'User not found');
  }
  const current = mockUsersCatalog[index]!;
  const next: AdminUserSummary = {
    ...current,
    status: input.status ?? current.status,
    enabled: input.enabled ?? current.enabled,
  };
  if (input.status === 'SUSPENDED' || input.status === 'CLOSED') {
    next.enabled = false;
  }
  if (input.status === 'ACTIVE' && input.enabled == null) {
    next.enabled = true;
  }
  mockUsersCatalog[index] = next;
  return next;
}

export function mockUserRecentTransactions(userId: string): TransactionItem[] {
  return [
    {
      type: 'FUNDING',
      id: `tx-fund-${userId}`,
      status: 'COMPLETED',
      walletId: 'w-1',
      currencyCode: 'CAD',
      amount: '250.00',
      createdAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now - 3600000).toISOString(),
    },
    {
      type: 'EXCHANGE',
      id: `tx-fx-${userId}`,
      status: 'COMPLETED',
      walletId: 'w-1',
      secondaryWalletId: 'w-2',
      currencyCode: 'CAD',
      secondaryCurrencyCode: 'NGN',
      amount: '100.00',
      secondaryAmount: '104850.00',
      appliedRate: '1048.50',
      createdAt: new Date(now - 7200000).toISOString(),
      updatedAt: new Date(now - 7200000).toISOString(),
    },
  ];
}

export function mockUserTransactionHistory(userId: string): TransactionPage {
  const items = mockUserRecentTransactions(userId);
  return {
    items,
    page: 0,
    size: 20,
    totalElements: items.length,
    totalPages: 1,
  };
}
