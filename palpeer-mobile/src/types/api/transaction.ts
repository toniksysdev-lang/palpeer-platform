import type { Money } from '@/utils/money';

import type { IsoInstant } from './common';
import type { TransactionActivityType, TransactionItemResponse } from './wallet';

export type { TransactionActivityType, TransactionItemResponse };

/** VERIFIED: `GET /transactions/history` query. `from`/`to` are ISO instants; `page` is 0-based. */
export type TransactionHistoryArgs = {
  type?: TransactionActivityType;
  from?: IsoInstant;
  to?: IsoInstant;
};

/** VERIFIED: `TransactionPageResponse` (not a Spring `Page`). `size` is clamped to 1..100. */
export type TransactionPageResponse = {
  items: TransactionItemResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/** VERIFIED: `TransactionSummaryResponse.CurrencyAmountTotal`. */
export type CurrencyAmountTotal = {
  currencyCode: string;
  totalAmount: Money;
  count: number;
};

/**
 * VERIFIED: `TransactionSummaryResponse`. Without `from`/`to` the window is the last 30 days.
 * `countByStatus` keys are `"<TYPE>:<STATUS>"`, e.g. `"FUNDING:SUCCESS"`.
 */
export type TransactionSummaryResponse = {
  from: IsoInstant;
  to: IsoInstant;
  totalCount: number;
  countByType: Partial<Record<TransactionActivityType, number>>;
  countByStatus: Record<string, number>;
  successfulFundingByCurrency: CurrencyAmountTotal[];
  successfulWithdrawalByCurrency: CurrencyAmountTotal[];
  successfulExchangeCount: number;
};

export type TransactionSummaryArgs = { from?: IsoInstant; to?: IsoInstant };
