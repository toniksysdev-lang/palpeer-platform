import { apiRequest } from '@/services/api/client';
import type {
  CreateMarketingAdvertInput,
  MarketingAdvert,
  UpdateMarketingAdvertInput,
} from '@/types/marketing';

export async function listMarketingAdverts(): Promise<MarketingAdvert[]> {
  return apiRequest<MarketingAdvert[]>('/admin/marketing-adverts');
}

export async function createMarketingAdvert(
  input: CreateMarketingAdvertInput,
): Promise<MarketingAdvert> {
  return apiRequest<MarketingAdvert>('/admin/marketing-adverts', {
    method: 'POST',
    body: {
      title: input.title.trim(),
      body: input.body.trim(),
      imageUrl: input.imageUrl.trim(),
      ctaLabel: input.ctaLabel.trim(),
      ctaPath: input.ctaPath.trim(),
      sortOrder: input.sortOrder ?? 0,
      active: input.active ?? true,
    },
  });
}

export async function updateMarketingAdvert(
  id: string,
  input: UpdateMarketingAdvertInput,
): Promise<MarketingAdvert> {
  return apiRequest<MarketingAdvert>(`/admin/marketing-adverts/${id}`, {
    method: 'PUT',
    body: {
      title: input.title?.trim(),
      body: input.body?.trim(),
      imageUrl: input.imageUrl?.trim(),
      ctaLabel: input.ctaLabel?.trim(),
      ctaPath: input.ctaPath?.trim(),
      sortOrder: input.sortOrder,
      active: input.active,
    },
  });
}

export async function deleteMarketingAdvert(id: string): Promise<void> {
  await apiRequest<void>(`/admin/marketing-adverts/${id}`, { method: 'DELETE' });
}
