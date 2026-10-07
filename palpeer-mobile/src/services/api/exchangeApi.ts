import type {
  ExchangeAmountRequest,
  ExchangeCalculationResponse,
  ExchangeQuoteResponse,
  ExchangeTransactionResponse,
} from '@/types/api/exchange';

import { baseApi } from './baseApi';
import { jsonDecimal } from './json';
import { walletBalanceTags } from './walletApi';

function amountBody({ sourceWalletId, targetWalletId, fixedSide, amount }: ExchangeAmountRequest) {
  return fixedSide === 'SOURCE'
    ? { sourceWalletId, targetWalletId, sourceAmount: jsonDecimal(amount) }
    : { sourceWalletId, targetWalletId, targetAmount: jsonDecimal(amount) };
}

/** Shared cache key so the review screen reads the quote the exchange form requested. */
export const EXCHANGE_QUOTE_CACHE_KEY = 'exchange-quote';

export const exchangeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Read-only calculation; nothing is persisted. Rates can change, so results aren't reused. */
    calculateExchange: build.query<ExchangeCalculationResponse, ExchangeAmountRequest>({
      query: (request) => ({
        path: '/exchange/calculate',
        method: 'POST',
        body: amountBody(request),
      }),
      keepUnusedDataFor: 0,
    }),
    /** Locks a time-bound quote (`expiresAt`). */
    previewExchange: build.mutation<ExchangeQuoteResponse, ExchangeAmountRequest>({
      query: (request) => ({
        path: '/exchange/preview',
        method: 'POST',
        body: amountBody(request),
      }),
    }),
    executeExchange: build.mutation<
      ExchangeTransactionResponse,
      { quote: ExchangeQuoteResponse; idempotencyKey: string }
    >({
      query: ({ quote, idempotencyKey }) => ({
        path: '/exchange/execute',
        method: 'POST',
        body: { quoteId: quote.quoteId },
        idempotencyKey,
      }),
      invalidatesTags: (_result, error, { quote }) =>
        error
          ? []
          : [
              ...walletBalanceTags(quote.sourceWalletId),
              ...walletBalanceTags(quote.targetWalletId),
            ],
    }),
    getExchange: build.query<ExchangeTransactionResponse, string>({
      query: (exchangeId) => ({
        path: `/exchange/transactions/${encodeURIComponent(exchangeId)}`,
      }),
      providesTags: (_result, _error, id) => [{ type: 'Transaction', id: `EXCHANGE-${id}` }],
    }),
  }),
});

export const {
  useCalculateExchangeQuery,
  usePreviewExchangeMutation,
  useExecuteExchangeMutation,
  useGetExchangeQuery,
} = exchangeApi;
