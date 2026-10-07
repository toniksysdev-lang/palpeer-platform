import { apiRequest } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import type { LedgerTransactionSummary, WalletSummary } from '@/types/wallets';

export type AdminWalletListParams = {
  page?: number;
  size?: number;
  sort?: string;
};

export type AdminWalletFilterParams = AdminWalletListParams & {
  userId?: string;
  currencyCode?: string;
};

export async function listAdminWallets(
  params: AdminWalletFilterParams = {},
): Promise<SpringPage<WalletSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.sort) search.set('sort', params.sort);
  if (params.userId) search.set('userId', params.userId);
  if (params.currencyCode) search.set('currencyCode', params.currencyCode);
  return apiRequest<SpringPage<WalletSummary>>(`/admin/wallets?${search.toString()}`);
}

export async function getAdminWallet(walletId: string): Promise<WalletSummary> {
  return apiRequest<WalletSummary>(`/admin/wallets/${encodeURIComponent(walletId)}`);
}

export async function listAdminWalletTransactions(
  walletId: string,
  params: AdminWalletListParams = {},
): Promise<SpringPage<LedgerTransactionSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.sort) search.set('sort', params.sort);
  return apiRequest<SpringPage<LedgerTransactionSummary>>(
    `/admin/wallets/${encodeURIComponent(walletId)}/transactions?${search.toString()}`,
  );
}
