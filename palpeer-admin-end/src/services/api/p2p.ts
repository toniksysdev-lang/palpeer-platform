import { apiRequest } from '@/services/api/client';
import type { P2POrderSummary, P2PRequestSummary } from '@/types/admin';
import type { UpdateP2PStatusInput } from '@/types/p2p';

export type AdminP2PListParams = {
  status?: string;
  userId?: string;
};

function p2pQuery(params: AdminP2PListParams): string {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.userId) search.set('userId', params.userId);
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listAdminP2PRequests(
  params: AdminP2PListParams = {},
): Promise<P2PRequestSummary[]> {
  return apiRequest<P2PRequestSummary[]>(`/admin/p2p/requests${p2pQuery(params)}`);
}

export async function listAdminP2POrders(
  params: AdminP2PListParams = {},
): Promise<P2POrderSummary[]> {
  return apiRequest<P2POrderSummary[]>(`/admin/p2p/orders${p2pQuery(params)}`);
}

export async function updateAdminP2PRequestStatus(
  requestId: string,
  input: UpdateP2PStatusInput,
): Promise<P2PRequestSummary> {
  return apiRequest<P2PRequestSummary>(`/admin/p2p/requests/${encodeURIComponent(requestId)}/status`, {
    method: 'PUT',
    body: input,
  });
}

export async function updateAdminP2POrderStatus(
  orderId: string,
  input: UpdateP2PStatusInput,
): Promise<P2POrderSummary> {
  return apiRequest<P2POrderSummary>(`/admin/p2p/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PUT',
    body: input,
  });
}
