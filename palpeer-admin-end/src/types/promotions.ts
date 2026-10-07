export const PROMOTION_TYPES = ['REFERRAL', 'SIGNUP', 'CAMPAIGN', 'OTHER'] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const REFERRAL_STATUSES = ['OPEN', 'COMPLETED', 'CANCELLED'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const BONUS_STATUSES = ['PENDING', 'GRANTED', 'CANCELLED', 'FAILED'] as const;
export type BonusStatus = (typeof BONUS_STATUSES)[number];

export type PromotionSummary = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  promotionType: PromotionType | string;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  bonusAmount?: number | string | null;
  bonusCurrencyCode?: string | null;
  createdAt: string;
};

export type CreatePromotionInput = {
  code: string;
  title: string;
  description?: string;
  promotionType: PromotionType;
  startsAt?: string | null;
  endsAt?: string | null;
  bonusAmount?: string | null;
  bonusCurrencyCode?: string | null;
};

export type ReferralSummary = {
  id: string;
  referrerUserId: string;
  refereeUserId?: string | null;
  referralCode: string;
  status: ReferralStatus | string;
  promotionId?: string | null;
  createdAt: string;
};

export type BonusSummary = {
  id: string;
  userId: string;
  promotionId?: string | null;
  referralId?: string | null;
  amount: number | string;
  currencyCode: string;
  status: BonusStatus | string;
  reason?: string | null;
  ledgerEntryId?: string | null;
  createdAt: string;
};
