import type { Money } from '@/utils/money';

import type { IsoInstant, Uuid } from './common';

/** VERIFIED: `PromotionType`. */
export type PromotionType = 'REFERRAL' | 'SIGNUP' | 'CAMPAIGN' | 'OTHER';

/** VERIFIED: `PromotionResponse`. `GET /promotions/active` is not personalised. */
export type PromotionResponse = {
  id: Uuid;
  code: string;
  title: string;
  description: string | null;
  promotionType: PromotionType;
  active: boolean;
  startsAt: IsoInstant | null;
  endsAt: IsoInstant | null;
  bonusAmount: Money | null;
  bonusCurrencyCode: string | null;
  createdAt: IsoInstant;
};

/** VERIFIED: `ReferralStatus`. */
export type ReferralStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';

/** VERIFIED: `ReferralResponse`. Codes are `REF` + 10 upper-case hex characters and single-use. */
export type ReferralResponse = {
  id: Uuid;
  referrerUserId: Uuid;
  refereeUserId: Uuid | null;
  referralCode: string;
  status: ReferralStatus;
  promotionId: Uuid | null;
  createdAt: IsoInstant;
};

/** VERIFIED: `ApplyReferralRequest`. Case-insensitive, ≤ 40 characters. */
export type ApplyReferralRequest = { referralCode: string };

/** VERIFIED: `BonusStatus`. Only `PENDING` is produced today (no payout). */
export type BonusStatus = 'PENDING' | 'GRANTED' | 'CANCELLED' | 'FAILED';

/** VERIFIED: `BonusResponse` (`ledgerEntryId` left out: always null, never shown). */
export type BonusResponse = {
  id: Uuid;
  userId: Uuid;
  promotionId: Uuid | null;
  referralId: Uuid | null;
  amount: Money;
  currencyCode: string;
  status: BonusStatus;
  reason: string | null;
  createdAt: IsoInstant;
};
