import type { Money } from '@/utils/money';

import type { IsoInstant, Uuid } from './common';

/** VERIFIED: `P2PSide`. What BUY/SELL means relative to base/quote is not defined (P8-01, P-1). */
export type P2PSide = 'BUY' | 'SELL';

/**
 * VERIFIED: `P2PStatus`, shared by requests and orders. Customers only cause OPEN → ACCEPTED
 * (accept) and OPEN → CANCELLED (owner cancel); OPEN → EXPIRED happens once `expiresAt` passes.
 * COMPLETED and admin CANCELLED are set by admins only.
 */
export type P2PStatus = 'OPEN' | 'ACCEPTED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

/** VERIFIED: `P2PRequestResponse`. `posterDisplayName` is profile name or a safe fallback. */
export type P2PRequestResponse = {
  id: Uuid;
  userId: Uuid;
  /** Present from API; older payloads may omit it. */
  posterDisplayName?: string | null;
  side: P2PSide;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  amount: Money;
  rate: Money;
  status: P2PStatus;
  expiresAt: IsoInstant | null;
  notes: string | null;
  createdAt: IsoInstant;
  /** Present when a fee tier matches the request amount (base currency). */
  estimatedFeeAmount?: Money | null;
  estimatedFeeCurrency?: string | null;
  /** Buyer opted in to apply PENDING bonus credit toward the platform fee. */
  applyBonusCredit?: boolean;
};

/** VERIFIED: `P2PRateBoundsResponse` from `GET /p2p/rate-bounds` (null when none configured). */
export type P2PRateBoundsResponse = {
  id: Uuid;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  minRate: Money;
  maxRate: Money;
};

/** VERIFIED: `CreateP2PRequestDto`. Base ≠ quote; amount and rate > 0; `expiresAt` in the future. */
export type CreateP2PRequest = {
  side: P2PSide;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  amount: Money;
  rate: Money;
  expiresAt?: IsoInstant;
  notes?: string;
  applyBonusCredit?: boolean;
};

/**
 * VERIFIED: `UpdateP2PRequestDto`; omitted fields stay unchanged. `expiresAt` can be moved but not
 * cleared; an empty `notes` string clears the notes.
 */
export type UpdateP2PRequest = {
  amount?: Money;
  rate?: Money;
  expiresAt?: IsoInstant;
  notes?: string;
  applyBonusCredit?: boolean;
};

/** VERIFIED: `P2POrderResponse` (accept result and `GET /p2p/orders/{id}`); no currency codes. */
export type P2POrderResponse = {
  id: Uuid;
  requestId: Uuid;
  requesterId: Uuid;
  acceptorId: Uuid;
  amount: Money;
  rate: Money;
  status: P2PStatus;
  createdAt: IsoInstant;
  /** Platform fee charged to the buyer at settle (base currency). */
  feeAmount?: Money | null;
  feeCurrencyCode?: string | null;
};

/** `GET /p2p/fee-estimate` — buyer platform fee for a pair/amount. */
export type P2PFeeEstimateResponse = {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  amount: Money;
  /** Gross platform fee before promotions / bonus credit. */
  estimatedFeeAmount: Money | null;
  estimatedFeeCurrency: string | null;
  /** Amount waived via promotion + PENDING bonus credit. */
  feeDiscountAmount?: Money | null;
  /** Net fee after discount (what the buyer is charged). */
  feeAfterDiscount?: Money | null;
  appliedPromotionCode?: string | null;
  pendingBonusCredit?: Money | null;
};

/** VERIFIED: `P2POrderSummaryResponse` from `GET /p2p/me/orders` (order + the request's pair). */
export type P2POrderSummaryResponse = P2POrderResponse & {
  side: P2PSide | null;
  baseCurrencyCode: string | null;
  quoteCurrencyCode: string | null;
  /** Originating request expiry, when set. */
  expiresAt?: IsoInstant | null;
};
