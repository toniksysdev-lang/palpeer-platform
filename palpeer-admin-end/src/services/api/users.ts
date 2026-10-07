import { apiRequest } from '@/services/api/client';
import type { AdminUserSummary, SpringPage } from '@/types/admin';
import type {
  TransactionItem,
  TransactionPage,
  UpdateUserAdminInput,
} from '@/types/users';

export async function listAdminUsers(params?: {
  page?: number;
  size?: number;
  sort?: string;
  email?: string;
  status?: string;
}): Promise<SpringPage<AdminUserSummary>> {
  const page = params?.page ?? 0;
  const size = params?.size ?? 20;
  const search = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (params?.sort) {
    search.set('sort', params.sort);
  }
  if (params?.email) {
    search.set('email', params.email);
  }
  if (params?.status) {
    search.set('status', params.status);
  }
  return apiRequest<SpringPage<AdminUserSummary>>(`/admin/users?${search.toString()}`);
}

export async function getAdminUser(userId: string): Promise<AdminUserSummary> {
  return apiRequest<AdminUserSummary>(`/admin/users/${userId}`);
}

export async function updateAdminUser(
  userId: string,
  input: UpdateUserAdminInput,
): Promise<AdminUserSummary> {
  return apiRequest<AdminUserSummary>(`/admin/users/${userId}`, {
    method: 'PUT',
    body: input,
  });
}

export async function getAdminUserRecentTransactions(
  userId: string,
  limit = 20,
): Promise<TransactionItem[]> {
  return apiRequest<TransactionItem[]>(
    `/admin/users/${userId}/transactions/recent?limit=${limit}`,
  );
}

export async function getAdminUserTransactionHistory(
  userId: string,
  params?: {
    type?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  },
): Promise<TransactionPage> {
  const search = new URLSearchParams({
    page: String(params?.page ?? 0),
    size: String(params?.size ?? 20),
  });
  if (params?.type) {
    search.set('type', params.type);
  }
  if (params?.from) {
    search.set('from', params.from);
  }
  if (params?.to) {
    search.set('to', params.to);
  }
  return apiRequest<TransactionPage>(
    `/admin/users/${userId}/transactions/history?${search.toString()}`,
  );
}
