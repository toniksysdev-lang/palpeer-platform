import type { Money } from '@/utils/money';

import type { IsoInstant, Uuid } from './common';
import type { P2PSide } from './p2p';

/** VERIFIED: `ExchangeRateResponse` from `GET /exchange-rates/latest`. Buy/sell meaning is P4-03. */
export type ExchangeRateResponse = {
  id: Uuid;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  buyRate: Money;
  sellRate: Money;
  effectiveDate: IsoInstant;
};

/** VERIFIED: `GET /public/instant-rates` — latest InstantEX rate for every published pair. */
export type PublicInstantRateResponse = ExchangeRateResponse;

/** VERIFIED: `PublicP2PRateResponse` from `GET /public/p2p-rates` (no owner id or notes). */
export type PublicP2PRateResponse = {
  id: Uuid;
  side: P2PSide;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  amount: Money;
  rate: Money;
  expiresAt: IsoInstant | null;
  createdAt: IsoInstant;
};

/** VERIFIED: `PublicP2PRequestResponse` from `GET /public/p2p-requests/{id}` (share / guest Accept). */
export type PublicP2PRequestResponse = {
  id: Uuid;
  side: P2PSide;
  status: 'OPEN';
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  amount: Money;
  rate: Money;
  posterDisplayName: string | null;
  expiresAt: IsoInstant | null;
  createdAt: IsoInstant;
};

/** Which side of the exchange the user typed; the backend calculates the other side. */
export type ExchangeFixedSide = 'SOURCE' | 'TARGET';

/**
 * App-level input for `ExchangeCalculateRequest` (VERIFIED: exactly one of `sourceAmount` or
 * `targetAmount`, each > 0). `fixedSide` decides which field is sent.
 */
export type ExchangeAmountRequest = {
  sourceWalletId: Uuid;
  targetWalletId: Uuid;
  fixedSide: ExchangeFixedSide;
  amount: Money;
};

/** VERIFIED: `rateSide` values chosen by the backend (provisional rule P7-01). */
export type ExchangeRateSide = 'SELL' | 'INVERSE_BUY';

/** VERIFIED: `ExchangeCalculationResponse`. Amounts are scaled to each currency's precision. */
export type ExchangeCalculationResponse = {
  sourceWalletId: Uuid;
  targetWalletId: Uuid;
  sourceCurrencyCode: string;
  targetCurrencyCode: string;
  sourceAmount: Money;
  targetAmount: Money;
  /** Target units per one source unit. */
  appliedRate: Money;
  rateSide: ExchangeRateSide | string;
  estimatedFeeAmount?: Money | null;
  estimatedFeeCurrency?: string | null;
};

/** VERIFIED: `ExchangeQuoteStatus`. */
export type ExchangeQuoteStatus = 'OPEN' | 'EXECUTED' | 'EXPIRED';

/** VERIFIED: `ExchangeQuoteResponse` from `POST /exchange/preview` (quote TTL defaults to 60 s). */
export type ExchangeQuoteResponse = ExchangeCalculationResponse & {
  quoteId: Uuid;
  expiresAt: IsoInstant;
  status: ExchangeQuoteStatus | string;
};

/** VERIFIED: `ExchangeTransactionStatus`. */
export type ExchangeTransactionStatus = 'INITIATED' | 'SUCCESS' | 'FAILED';

/** VERIFIED: `ExchangeTransactionResponse`. Currency codes aren't included; resolve via wallets. */
export type ExchangeTransactionResponse = {
  id: Uuid;
  quoteId: Uuid;
  sourceWalletId: Uuid;
  targetWalletId: Uuid;
  sourceAmount: Money;
  targetAmount: Money;
  appliedRate: Money;
  status: ExchangeTransactionStatus;
  idempotencyKey: string;
  debitLedgerEntryId: Uuid | null;
  creditLedgerEntryId: Uuid | null;
  failureReason: string | null;
  createdAt: IsoInstant;
};
