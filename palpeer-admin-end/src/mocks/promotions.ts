import type { SpringPage } from '@/types/admin';
import type {
  BonusSummary,
  CreatePromotionInput,
  PromotionSummary,
  ReferralSummary,
  UpdatePromotionInput,
} from '@/types/promotions';
import type { AdminBonusSearchParams, AdminReferralSearchParams } from '@/services/api/promotions';
import { ApiClientError } from '@/types/api';

const now = Date.now();

const promotions: PromotionSummary[] = [
  {
    id: 'promo-1',
    code: 'WELCOME10',
    title: 'Welcome bonus',
    description: 'Mock signup promotion',
    promotionType: 'SIGNUP',
    active: true,
    startsAt: new Date(now - 86400000 * 7).toISOString(),
    endsAt: new Date(now + 86400000 * 30).toISOString(),
    bonusAmount: '10.00',
    bonusCurrencyCode: 'CAD',
    createdAt: new Date(now - 86400000 * 7).toISOString(),
  },
  {
    id: 'promo-2',
    code: 'REFER25',
    title: 'Referral reward',
    description: 'Mock referral campaign',
    promotionType: 'REFERRAL',
    active: true,
    startsAt: new Date(now - 86400000).toISOString(),
    endsAt: null,
    bonusAmount: '25.00',
    bonusCurrencyCode: 'CAD',
    createdAt: new Date(now - 86400000).toISOString(),
  },
];

const referrals: ReferralSummary[] = [
  {
    id: 'ref-1',
    referrerUserId: '00000000-0000-4000-8000-000000000001',
    refereeUserId: null,
    referralCode: 'REFMOCKOPEN01',
    status: 'OPEN',
    promotionId: null,
    createdAt: new Date(now - 86400000 * 2).toISOString(),
  },
  {
    id: 'ref-2',
    referrerUserId: '00000000-0000-4000-8000-000000000001',
    refereeUserId: '00000000-0000-4000-8000-000000000002',
    referralCode: 'REFMOCKDONE02',
    status: 'COMPLETED',
    promotionId: 'promo-2',
    createdAt: new Date(now - 86400000).toISOString(),
  },
];

const bonuses: BonusSummary[] = [
  {
    id: 'bonus-1',
    userId: '00000000-0000-4000-8000-000000000001',
    promotionId: 'promo-2',
    referralId: 'ref-2',
    amount: '25.00',
    currencyCode: 'CAD',
    status: 'PENDING',
    reason: 'Referral bonus',
    ledgerEntryId: null,
    createdAt: new Date(now - 86400000).toISOString(),
  },
  {
    id: 'bonus-2',
    userId: '00000000-0000-4000-8000-000000000002',
    promotionId: 'promo-2',
    referralId: 'ref-2',
    amount: '25.00',
    currencyCode: 'CAD',
    status: 'PENDING',
    reason: 'Referred signup bonus',
    ledgerEntryId: null,
    createdAt: new Date(now - 86400000).toISOString(),
  },
];

function toPage<T>(rows: T[], page: number, size: number): SpringPage<T> {
  const start = page * size;
  const content = rows.slice(start, start + size);
  const totalElements = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size) || 1);
  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    numberOfElements: content.length,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export function mockListActivePromotions(): PromotionSummary[] {
  return promotions.filter((row) => row.active).map((row) => ({ ...row }));
}

export function mockCreatePromotion(input: CreatePromotionInput): PromotionSummary {
  if (promotions.some((row) => row.code.toLowerCase() === input.code.trim().toLowerCase())) {
    throw new ApiClientError(409, 'PROMOTION_EXISTS', 'Promotion code already exists.');
  }
  const created: PromotionSummary = {
    id: `promo-${Date.now()}`,
    code: input.code.trim().toUpperCase(),
    title: input.title.trim(),
    description: input.description ?? null,
    promotionType: input.promotionType,
    active: true,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    bonusAmount: input.bonusAmount ?? null,
    bonusCurrencyCode: input.bonusCurrencyCode ?? null,
    eligibilityJson: input.eligibilityJson ?? null,
    createdAt: new Date().toISOString(),
  };
  promotions.unshift(created);
  return { ...created };
}

export function mockUpdatePromotion(id: string, input: UpdatePromotionInput): PromotionSummary {
  const index = promotions.findIndex((row) => row.id === id);
  if (index < 0) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Promotion not found.');
  }
  const code = input.code.trim().toUpperCase();
  if (
    promotions.some(
      (row) => row.id !== id && row.code.toLowerCase() === code.toLowerCase(),
    )
  ) {
    throw new ApiClientError(409, 'PROMOTION_EXISTS', 'Promotion code already exists.');
  }
  const updated: PromotionSummary = {
    ...promotions[index],
    code,
    title: input.title.trim(),
    description: input.description ?? null,
    promotionType: input.promotionType,
    active: input.active,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    bonusAmount: input.bonusAmount ?? null,
    bonusCurrencyCode: input.bonusCurrencyCode ?? null,
    eligibilityJson:
      input.eligibilityJson !== undefined
        ? input.eligibilityJson
        : promotions[index].eligibilityJson,
  };
  promotions[index] = updated;
  return { ...updated };
}

export function mockListAdminReferrals(
  params: AdminReferralSearchParams = {},
): SpringPage<ReferralSummary> {
  let rows = referrals.map((row) => ({ ...row }));
  if (params.status) rows = rows.filter((row) => row.status === params.status);
  if (params.referralCode?.trim()) {
    const code = params.referralCode.trim().toLowerCase();
    rows = rows.filter((row) => row.referralCode.toLowerCase() === code);
  }
  if (params.referrerUserId?.trim()) {
    rows = rows.filter((row) => row.referrerUserId === params.referrerUserId?.trim());
  }
  if (params.refereeUserId?.trim()) {
    rows = rows.filter((row) => row.refereeUserId === params.refereeUserId?.trim());
  }
  return toPage(rows, params.page ?? 0, params.size ?? 20);
}

export function mockGetAdminReferral(id: string): ReferralSummary {
  const found = referrals.find((row) => row.id === id);
  if (!found) {
    throw new ApiClientError(404, 'RESOURCE_NOT_FOUND', 'Referral not found.');
  }
  return { ...found };
}

export function mockListAdminBonuses(params: AdminBonusSearchParams = {}): SpringPage<BonusSummary> {
  let rows = bonuses.map((row) => ({ ...row }));
  if (params.status) rows = rows.filter((row) => row.status === params.status);
  if (params.userId?.trim()) rows = rows.filter((row) => row.userId === params.userId?.trim());
  if (params.referralId?.trim()) {
    rows = rows.filter((row) => row.referralId === params.referralId?.trim());
  }
  return toPage(rows, params.page ?? 0, params.size ?? 20);
}
