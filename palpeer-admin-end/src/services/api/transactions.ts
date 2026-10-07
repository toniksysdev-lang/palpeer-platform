import { apiBinaryRequest, apiRequest, type BinaryResponse } from '@/services/api/client';
import type { TransactionItem, TransactionPage } from '@/types/users';

export type AdminTransactionHistoryParams = {
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
};

export type AdminTransactionSearchParams = {
  type?: string;
  status?: string;
  currencyCode?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
};

export async function getAdminUserRecentTransactions(
  userId: string,
  limit = 20,
): Promise<TransactionItem[]> {
  return apiRequest<TransactionItem[]>(
    `/admin/users/${encodeURIComponent(userId)}/transactions/recent?limit=${limit}`,
  );
}

export async function getAdminUserTransactionHistory(
  userId: string,
  params?: AdminTransactionHistoryParams,
): Promise<TransactionPage> {
  const search = new URLSearchParams({
    page: String(params?.page ?? 0),
    size: String(params?.size ?? 20),
  });
  if (params?.type) search.set('type', params.type);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  return apiRequest<TransactionPage>(
    `/admin/users/${encodeURIComponent(userId)}/transactions/history?${search.toString()}`,
  );
}

function transactionFilterSearch(params: AdminTransactionSearchParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.type) search.set('type', params.type);
  if (params.status) search.set('status', params.status);
  if (params.currencyCode) search.set('currencyCode', params.currencyCode);
  if (params.userId) search.set('userId', params.userId);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  return search;
}

export async function searchAdminTransactions(
  params: AdminTransactionSearchParams = {},
): Promise<TransactionPage> {
  const search = transactionFilterSearch(params);
  search.set('page', String(params.page ?? 0));
  search.set('size', String(params.size ?? 20));
  return apiRequest<TransactionPage>(`/admin/transactions?${search.toString()}`);
}

export async function getAdminTransaction(type: string, id: string): Promise<TransactionItem> {
  return apiRequest<TransactionItem>(
    `/admin/transactions/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
  );
}

export async function exportAdminTransactions(
  params: AdminTransactionSearchParams = {},
): Promise<BinaryResponse> {
  const query = transactionFilterSearch(params).toString();
  return apiBinaryRequest(`/admin/transactions/export${query ? `?${query}` : ''}`, {
    accept: 'text/csv',
  });
}
