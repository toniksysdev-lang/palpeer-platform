import { apiRequest } from '@/services/api/client';
import type { P2PRateBound, UpsertP2PRateBoundInput } from '@/types/rates';

export async function listP2PRateBounds(): Promise<P2PRateBound[]> {
  return apiRequest<P2PRateBound[]>('/admin/p2p/rate-bounds');
}

export async function upsertP2PRateBound(input: UpsertP2PRateBoundInput): Promise<P2PRateBound> {
  return apiRequest<P2PRateBound>('/admin/p2p/rate-bounds', {
    method: 'PUT',
    body: {
      baseCurrencyCode: input.baseCurrencyCode.trim().toUpperCase(),
      quoteCurrencyCode: input.quoteCurrencyCode.trim().toUpperCase(),
      minRate: input.minRate,
      maxRate: input.maxRate,
    },
  });
}

export async function deleteP2PRateBound(id: string): Promise<void> {
  await apiRequest<null>(`/admin/p2p/rate-bounds/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
