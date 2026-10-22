import { apiRequest } from '@/services/api/client';
import type { SpringPage } from '@/types/admin';
import type {
  BonusStatus,
  BonusSummary,
  CreatePromotionInput,
  PromotionSummary,
  ReferralStatus,
  ReferralSummary,
  UpdatePromotionCampaignInput,
  UpdatePromotionInput,
} from '@/types/promotions';

export async function listActivePromotions(): Promise<PromotionSummary[]> {
  return apiRequest<PromotionSummary[]>('/promotions/active');
}

export async function createPromotion(input: CreatePromotionInput): Promise<PromotionSummary> {
  return apiRequest<PromotionSummary>('/promotions', {
    method: 'POST',
    body: {
      code: input.code.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      promotionType: input.promotionType,
      startsAt: input.startsAt || null,
      endsAt: input.endsAt || null,
      bonusAmount: input.bonusAmount ? input.bonusAmount : null,
      bonusCurrencyCode: input.bonusCurrencyCode?.trim() || null,
      eligibilityJson: input.eligibilityJson ?? null,
    },
  });
}

export type AdminReferralSearchParams = {
  status?: ReferralStatus | '';
  referralCode?: string;
  referrerUserId?: string;
  refereeUserId?: string;
  page?: number;
  size?: number;
  sort?: string;
};

export type AdminBonusSearchParams = {
  status?: BonusStatus | '';
  userId?: string;
  referralId?: string;
  page?: number;
  size?: number;
  sort?: string;
};

export async function listAdminReferrals(
  params: AdminReferralSearchParams = {},
): Promise<SpringPage<ReferralSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
    sort: params.sort ?? 'createdAt,desc',
  });
  if (params.status) search.set('status', params.status);
  if (params.referralCode?.trim()) search.set('referralCode', params.referralCode.trim());
  if (params.referrerUserId?.trim()) search.set('referrerUserId', params.referrerUserId.trim());
  if (params.refereeUserId?.trim()) search.set('refereeUserId', params.refereeUserId.trim());
  return apiRequest<SpringPage<ReferralSummary>>(`/admin/referrals?${search.toString()}`);
}

export async function getAdminReferral(id: string): Promise<ReferralSummary> {
  return apiRequest<ReferralSummary>(`/admin/referrals/${encodeURIComponent(id)}`);
}

export async function listAdminBonuses(
  params: AdminBonusSearchParams = {},
): Promise<SpringPage<BonusSummary>> {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
    sort: params.sort ?? 'createdAt,desc',
  });
  if (params.status) search.set('status', params.status);
  if (params.userId?.trim()) search.set('userId', params.userId.trim());
  if (params.referralId?.trim()) search.set('referralId', params.referralId.trim());
  return apiRequest<SpringPage<BonusSummary>>(`/admin/bonuses?${search.toString()}`);
}

export async function getAdminPromotion(id: string): Promise<PromotionSummary> {
  return apiRequest<PromotionSummary>(`/admin/promotions/${encodeURIComponent(id)}`);
}

export async function updatePromotion(
  id: string,
  input: UpdatePromotionInput,
): Promise<PromotionSummary> {
  return apiRequest<PromotionSummary>(`/admin/promotions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: {
      code: input.code.trim(),
      title: input.title.trim(),
      description: input.description?.trim() || null,
      promotionType: input.promotionType,
      active: input.active,
      startsAt: input.startsAt || null,
      endsAt: input.endsAt || null,
      bonusAmount: input.bonusAmount ? input.bonusAmount : null,
      bonusCurrencyCode: input.bonusCurrencyCode?.trim() || null,
      eligibilityJson: input.eligibilityJson ?? null,
    },
  });
}

export async function updatePromotionCampaign(
  id: string,
  input: UpdatePromotionCampaignInput,
): Promise<PromotionSummary> {
  return apiRequest<PromotionSummary>(`/admin/promotions/${encodeURIComponent(id)}/campaign`, {
    method: 'PUT',
    body: {
      formulaJson: input.formulaJson ?? null,
      eligibilityJson: input.eligibilityJson ?? null,
    },
  });
}

export async function settleAdminBonus(id: string): Promise<BonusSummary> {
  return apiRequest<BonusSummary>(`/admin/bonuses/${encodeURIComponent(id)}/settle`, {
    method: 'POST',
  });
}

export async function cancelAdminBonus(id: string): Promise<BonusSummary> {
  return apiRequest<BonusSummary>(`/admin/bonuses/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}
