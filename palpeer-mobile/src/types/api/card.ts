import type { Money } from '@/utils/money';

import type { IsoInstant, Uuid } from './common';

/** VERIFIED: `CardStatus`. Customer flows only produce ACTIVE and BLOCKED. */
export type CardStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'CLOSED';

/**
 * VERIFIED: `CardResponse`, minus `providerCardId`. The issuer's internal card id is returned by the
 * backend but has no use in the app, so it is dropped before the response reaches app state.
 * There is no PAN or CVV in the contract; the card number exists only as `lastFour`.
 */
export type CardResponse = {
  id: Uuid;
  walletId: Uuid | null;
  /** `STUB` today: no real issuer (R-CD-4). */
  providerName: string;
  lastFour: string;
  brand: string;
  currencyCode: string;
  status: CardStatus;
  expiryMonth: number | null;
  expiryYear: number | null;
  cardholderName: string | null;
  createdAt: IsoInstant;
};

/** VERIFIED: `IssueCardRequest`. `walletId` must be the caller's and in the same currency. */
export type IssueCardRequest = {
  currencyCode: string;
  walletId?: Uuid;
  /** ≤ 120 characters. */
  cardholderName?: string;
};

/** VERIFIED: `CardTransactionType`. */
export type CardTransactionType =
  'AUTHORIZATION' | 'CAPTURE' | 'REFUND' | 'REVERSAL' | 'FEE' | 'OTHER';

/** VERIFIED: `CardTransactionStatus`. */
export type CardTransactionStatus = 'PENDING' | 'SETTLED' | 'FAILED' | 'REVERSED';

/** VERIFIED: `CardTransactionResponse` (provider transaction id left out, as above). */
export type CardTransactionResponse = {
  id: Uuid;
  cardId: Uuid;
  entryType: CardTransactionType;
  status: CardTransactionStatus;
  amount: Money;
  currencyCode: string;
  merchantName: string | null;
  occurredAt: IsoInstant;
  failureReason: string | null;
  createdAt: IsoInstant;
};
