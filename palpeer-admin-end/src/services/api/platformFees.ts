import { apiBinaryRequest, apiRequest, type BinaryResponse } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import type {
  PlatformFeeRevenue,
  PlatformFeeSourceType,
  PlatformFeeSummary,
} from '@/types/fees';

export type PlatformFeeSearchParams = {
  sourceType?: PlatformFeeSourceType;
  currency?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: string;
};

export type PlatformFeeSummaryParams = {
  currency?: string;
  q?: string;
  from?: string;
  to?: string;
};

export async function searchPlatformFees(
  params: PlatformFeeSearchParams = {},
): Promise<SpringPage<PlatformFeeRevenue>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.sourceType) search.set('sourceType', params.sourceType);
  if (params.currency) search.set('currency', params.currency);
  if (params.q) search.set('q', params.q);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  if (params.sort) search.set('sort', params.sort);

  return apiRequest<SpringPage<PlatformFeeRevenue>>(`/admin/platform-fees?${search.toString()}`);
}

export async function getPlatformFeeSummary(
  params: PlatformFeeSummaryParams = {},
): Promise<PlatformFeeSummary> {
  const search = new URLSearchParams();
  if (params.currency) search.set('currency', params.currency);
  if (params.q) search.set('q', params.q);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  const qs = search.toString();
  return apiRequest<PlatformFeeSummary>(`/admin/platform-fees/summary${qs ? `?${qs}` : ''}`);
}

export async function getPlatformFee(id: string): Promise<PlatformFeeRevenue> {
  return apiRequest<PlatformFeeRevenue>(`/admin/platform-fees/${encodeURIComponent(id)}`);
}

export async function exportPlatformFees(
  params: PlatformFeeSearchParams = {},
): Promise<BinaryResponse> {
  const search = new URLSearchParams();
  if (params.sourceType) search.set('sourceType', params.sourceType);
  if (params.currency) search.set('currency', params.currency);
  if (params.q) search.set('q', params.q);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);
  const qs = search.toString();
  return apiBinaryRequest(`/admin/platform-fees/export${qs ? `?${qs}` : ''}`, {
    accept: 'application/vnd.ms-excel',
  });
}
