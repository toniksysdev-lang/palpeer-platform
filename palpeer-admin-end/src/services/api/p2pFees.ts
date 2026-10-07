import { apiRequest } from '@/services/api/client';
import type { P2PFeeTier, UpsertP2PFeeTierInput } from '@/types/fees';

function toBody(input: UpsertP2PFeeTierInput) {
  const max = input.maxAmount?.trim();
  return {
    baseCurrencyCode: input.baseCurrencyCode.trim().toUpperCase(),
    quoteCurrencyCode: input.quoteCurrencyCode.trim().toUpperCase(),
    feeType: input.feeType,
    feeValue: input.feeValue,
    minAmount: input.minAmount,
    maxAmount: max ? max : null,
    active: input.active,
  };
}

export async function listP2PFeeTiers(): Promise<P2PFeeTier[]> {
  return apiRequest<P2PFeeTier[]>('/admin/fees/p2p');
}

export async function createP2PFeeTier(input: UpsertP2PFeeTierInput): Promise<P2PFeeTier> {
  return apiRequest<P2PFeeTier>('/admin/fees/p2p', {
    method: 'POST',
    body: toBody(input),
  });
}

export async function updateP2PFeeTier(
  id: string,
  input: UpsertP2PFeeTierInput,
): Promise<P2PFeeTier> {
  return apiRequest<P2PFeeTier>(`/admin/fees/p2p/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: toBody(input),
  });
}

export async function deleteP2PFeeTier(id: string): Promise<void> {
  await apiRequest<null>(`/admin/fees/p2p/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
