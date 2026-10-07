import { apiRequest } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import type { CardSummary, CardTransactionSummary } from '@/types/cards';

export type AdminCardListParams = {
  page?: number;
  size?: number;
  sort?: string;
};

export type AdminCardFilterParams = AdminCardListParams & {
  userId?: string;
  status?: string;
};

export async function listAdminCards(
  params: AdminCardFilterParams = {},
): Promise<SpringPage<CardSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.sort) search.set('sort', params.sort);
  if (params.userId) search.set('userId', params.userId);
  if (params.status) search.set('status', params.status);
  return apiRequest<SpringPage<CardSummary>>(`/admin/cards?${search.toString()}`);
}

export async function getAdminCard(cardId: string): Promise<CardSummary> {
  return apiRequest<CardSummary>(`/admin/cards/${encodeURIComponent(cardId)}`);
}

export async function listAdminCardTransactions(
  cardId: string,
  params: AdminCardListParams = {},
): Promise<SpringPage<CardTransactionSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.sort) search.set('sort', params.sort);
  return apiRequest<SpringPage<CardTransactionSummary>>(
    `/admin/cards/${encodeURIComponent(cardId)}/transactions?${search.toString()}`,
  );
}

export async function adminBlockCard(cardId: string): Promise<CardSummary> {
  return apiRequest<CardSummary>(`/admin/cards/${encodeURIComponent(cardId)}/block`, {
    method: 'POST',
  });
}

export async function adminUnblockCard(cardId: string): Promise<CardSummary> {
  return apiRequest<CardSummary>(`/admin/cards/${encodeURIComponent(cardId)}/unblock`, {
    method: 'POST',
  });
}
