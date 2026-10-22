import { apiRequest } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import type { NegotiationSummary } from '@/types/negotiations';

export type AdminNegotiationListParams = {
  page?: number;
  size?: number;
  sort?: string;
  userId?: string;
  status?: string;
};

export async function listAdminNegotiations(
  params: AdminNegotiationListParams = {},
): Promise<SpringPage<NegotiationSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.sort) search.set('sort', params.sort);
  if (params.userId) search.set('userId', params.userId);
  if (params.status) search.set('status', params.status);
  return apiRequest<SpringPage<NegotiationSummary>>(
    `/admin/negotiations?${search.toString()}`,
  );
}

export async function getAdminNegotiation(negotiationId: string): Promise<NegotiationSummary> {
  return apiRequest<NegotiationSummary>(
    `/admin/negotiations/${encodeURIComponent(negotiationId)}`,
  );
}

export async function adminCancelNegotiation(
  negotiationId: string,
): Promise<NegotiationSummary> {
  return apiRequest<NegotiationSummary>(
    `/admin/negotiations/${encodeURIComponent(negotiationId)}/cancel`,
    { method: 'POST' },
  );
}

export async function adminAcceptNegotiation(
  negotiationId: string,
): Promise<NegotiationSummary> {
  return apiRequest<NegotiationSummary>(
    `/admin/negotiations/${encodeURIComponent(negotiationId)}/accept`,
    { method: 'POST' },
  );
}
