import type { AppError } from '@/services/api/errors';
import type {
  BonusStatus,
  PromotionResponse,
  PromotionType,
  ReferralStatus,
} from '@/types/api/promotion';
import { formatDateTime } from '@/utils/datetime';

export const REFERRAL_CODE_MAX = 40;

export function normalizeReferralCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  REFERRAL: 'Referral',
  SIGNUP: 'Sign-up',
  CAMPAIGN: 'Campaign',
  OTHER: 'Offer',
};

export function promotionTypeLabel(type: PromotionType): string {
  return PROMOTION_TYPE_LABELS[type] ?? type;
}

/** "Until 30 Sep 2026, 10:00" / "From …" / "From … until …"; null when open-ended. */
export function promotionPeriod(
  promotion: Pick<PromotionResponse, 'startsAt' | 'endsAt'>,
): string | null {
  const from = formatDateTime(promotion.startsAt);
  const until = formatDateTime(promotion.endsAt);
  if (from && until) return `From ${from} until ${until}`;
  if (until) return `Until ${until}`;
  if (from) return `From ${from}`;
  return null;
}

const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  OPEN: 'Not used yet',
  COMPLETED: 'Used',
  CANCELLED: 'Cancelled',
};

export function referralStatusLabel(status: ReferralStatus): string {
  return REFERRAL_STATUS_LABELS[status] ?? status;
}

const BONUS_STATUS_LABELS: Record<BonusStatus, string> = {
  PENDING: 'Pending',
  GRANTED: 'Granted',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

export function bonusStatusLabel(status: BonusStatus): string {
  return BONUS_STATUS_LABELS[status] ?? status;
}

export function bonusStatusTone(status: BonusStatus): 'warning' | 'success' | 'neutral' | 'danger' {
  switch (status) {
    case 'GRANTED':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** VERIFIED codes from PromotionService.applyReferral. */
const MESSAGES: Record<string, string> = {
  REFERRAL_ALREADY_APPLIED: "You've already used a referral code.",
  REFERRAL_NOT_OPEN: 'This code has already been used. Ask your friend for a new one.',
  REFERRAL_SELF: "You can't use your own referral code.",
};

export function referralErrorMessage(error: AppError): string {
  const known = error.code ? MESSAGES[error.code] : undefined;
  if (known) return known;
  if (error.status === 404) return "We couldn't find that code. Check it and try again.";
  return error.message;
}

export function shareMessage(code: string): string {
  return `Join me on PALPEER. Use my referral code ${code} in the app under Invite friends: palpeer://referrals?code=${code}`;
}
