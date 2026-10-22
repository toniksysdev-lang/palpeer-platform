import { apiRequest } from '@/services/api/client';
import type { InstantExFeeTier, UpsertInstantExFeeTierInput } from '@/types/fees';

function toBody(input: UpsertInstantExFeeTierInput) {
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

export async function listInstantExFeeTiers(): Promise<InstantExFeeTier[]> {
  return apiRequest<InstantExFeeTier[]>('/admin/fees/instantex');
}

export async function createInstantExFeeTier(
  input: UpsertInstantExFeeTierInput,
): Promise<InstantExFeeTier> {
  return apiRequest<InstantExFeeTier>('/admin/fees/instantex', {
    method: 'POST',
    body: toBody(input),
  });
}

export async function updateInstantExFeeTier(
  id: string,
  input: UpsertInstantExFeeTierInput,
): Promise<InstantExFeeTier> {
  return apiRequest<InstantExFeeTier>(`/admin/fees/instantex/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: toBody(input),
  });
}

export async function deleteInstantExFeeTier(id: string): Promise<void> {
  await apiRequest<void>(`/admin/fees/instantex/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
