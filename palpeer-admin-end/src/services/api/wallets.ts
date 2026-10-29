import { apiRequest } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import type {
  AdminMoneyMovement,
  LedgerTransactionSummary,
  WalletSummary,
} from '@/types/wallets';

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

export async function listAdminWalletMovements(walletId: string): Promise<AdminMoneyMovement[]> {
  return apiRequest<AdminMoneyMovement[]>(
    `/admin/wallets/${encodeURIComponent(walletId)}/movements`,
  );
}

export async function createAdminWalletFunding(
  walletId: string,
  input: { amount: string; providerReference?: string },
  idempotencyKey: string,
): Promise<AdminMoneyMovement> {
  const created = await apiRequest<{
    id: string;
    walletId: string;
    amount: string | number;
    currencyCode: string;
    status: AdminMoneyMovement['status'];
    failureReason?: string | null;
    providerName?: string | null;
    providerReference?: string | null;
    createdAt: string;
  }>(`/admin/wallets/${encodeURIComponent(walletId)}/fundings`, {
    method: 'POST',
    body: {
      amount: input.amount,
      providerReference: input.providerReference?.trim() || null,
    },
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return {
    id: created.id,
    type: 'FUNDING',
    walletId: created.walletId,
    userId: '',
    amount: created.amount,
    currencyCode: created.currencyCode,
    status: created.status,
    failureReason: created.failureReason,
    reference: created.providerReference,
    providerName: created.providerName,
    createdAt: created.createdAt,
  };
}

export async function createAdminWalletWithdrawal(
  walletId: string,
  input: { amount: string; destinationReference?: string },
  idempotencyKey: string,
): Promise<AdminMoneyMovement> {
  const created = await apiRequest<{
    id: string;
    walletId: string;
    amount: string | number;
    currencyCode: string;
    status: AdminMoneyMovement['status'];
    failureReason?: string | null;
    providerName?: string | null;
    destinationReference?: string | null;
    createdAt: string;
  }>(`/admin/wallets/${encodeURIComponent(walletId)}/withdrawals`, {
    method: 'POST',
    body: {
      amount: input.amount,
      destinationReference: input.destinationReference?.trim() || null,
    },
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return {
    id: created.id,
    type: 'WITHDRAWAL',
    walletId: created.walletId,
    userId: '',
    amount: created.amount,
    currencyCode: created.currencyCode,
    status: created.status,
    failureReason: created.failureReason,
    reference: created.destinationReference,
    providerName: created.providerName,
    createdAt: created.createdAt,
  };
}

export type MoneyMovementAction = 'process' | 'fail' | 'reverse';

export async function actOnAdminWalletFunding(
  walletId: string,
  fundingId: string,
  action: MoneyMovementAction,
  options?: { reason?: string; mfaCode?: string },
): Promise<void> {
  await apiRequest<unknown>(
    `/admin/wallets/${encodeURIComponent(walletId)}/fundings/${encodeURIComponent(fundingId)}/${action}`,
    {
      method: 'POST',
      body:
        action === 'fail'
          ? { reason: options?.reason?.trim() || null }
          : action === 'process' || action === 'reverse'
            ? { code: options?.mfaCode?.trim() }
            : undefined,
    },
  );
}

export async function actOnAdminWalletWithdrawal(
  walletId: string,
  withdrawalId: string,
  action: MoneyMovementAction,
  options?: { reason?: string; mfaCode?: string },
): Promise<void> {
  await apiRequest<unknown>(
    `/admin/wallets/${encodeURIComponent(walletId)}/withdrawals/${encodeURIComponent(withdrawalId)}/${action}`,
    {
      method: 'POST',
      body:
        action === 'fail'
          ? { reason: options?.reason?.trim() || null }
          : action === 'process' || action === 'reverse'
            ? { code: options?.mfaCode?.trim() }
            : undefined,
    },
  );
}
