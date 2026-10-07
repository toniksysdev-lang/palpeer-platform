import { apiRequest } from '@/services/api/client';
import type { AdminSearchResponse } from '@/types/search';

export const ADMIN_SEARCH_MIN_LENGTH = 2;

export async function adminSearch(q: string, signal?: AbortSignal): Promise<AdminSearchResponse> {
  const search = new URLSearchParams({ q });
  return apiRequest<AdminSearchResponse>(`/admin/search?${search.toString()}`, { signal });
}
