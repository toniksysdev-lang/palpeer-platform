import { Decimal } from 'decimal.js-light';

import type { AppError } from '@/services/api/errors';
import type {
  BonusCurrencySummary,
  BonusResponse,
  BonusStatus,
  PromotionResponse,
  PromotionType,
  ReferralStatus,
} from '@/types/api/promotion';
import { formatDateTime } from '@/utils/datetime';
import { toMoney } from '@/utils/money';

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

/**
 * Per-wallet totals matching `GET /promotions/bonuses/mine/summary`.
 * Used when the summary endpoint is unavailable or still loading.
 */
export function summarizeBonuses(
  bonuses: readonly Pick<BonusResponse, 'amount' | 'currencyCode' | 'status'>[],
): BonusCurrencySummary[] {
  const unused = new Map<string, Decimal>();
  const used = new Map<string, Decimal>();
  for (const bonus of bonuses) {
    if (bonus.status === 'FAILED') continue;
    const currency = (bonus.currencyCode ?? '').trim().toUpperCase();
    if (!currency) continue;
    let amount: Decimal;
    try {
      amount = new Decimal(String(bonus.amount ?? '').trim() || '0');
    } catch {
      continue;
    }
    if (bonus.status === 'PENDING') {
      unused.set(currency, (unused.get(currency) ?? new Decimal(0)).plus(amount));
    } else if (bonus.status === 'GRANTED' || bonus.status === 'CANCELLED') {
      used.set(currency, (used.get(currency) ?? new Decimal(0)).plus(amount));
    }
  }
  return [...new Set([...unused.keys(), ...used.keys()])]
    .sort((a, b) => a.localeCompare(b))
    .map((currencyCode) => {
      const unusedAmount = unused.get(currencyCode) ?? new Decimal(0);
      const usedAmount = used.get(currencyCode) ?? new Decimal(0);
      return {
        currencyCode,
        totalAmount: toMoney(unusedAmount.plus(usedAmount).toFixed()),
        unusedAmount: toMoney(unusedAmount.toFixed()),
        usedAmount: toMoney(usedAmount.toFixed()),
      };
    });
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
