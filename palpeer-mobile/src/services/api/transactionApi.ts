import type {
  TransactionActivityType,
  TransactionHistoryArgs,
  TransactionItemResponse,
  TransactionPageResponse,
  TransactionSummaryArgs,
  TransactionSummaryResponse,
} from '@/types/api/transaction';

import { baseApi } from './baseApi';

export const TRANSACTION_HISTORY = { type: 'Transaction' as const, id: 'HISTORY' };
export const TRANSACTION_SUMMARY = { type: 'Transaction' as const, id: 'SUMMARY' };

export const HISTORY_PAGE_SIZE = 20;

export const transactionApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Funding, withdrawals, exchanges, transfers and settled P2P orders, newest first. */
    getTransactionHistory: build.infiniteQuery<
      TransactionPageResponse,
      TransactionHistoryArgs,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage) =>
          lastPage.page + 1 < lastPage.totalPages ? lastPage.page + 1 : undefined,
      },
      query: ({ queryArg, pageParam }) => ({
        path: '/transactions/history',
        query: {
          type: queryArg.type,
          from: queryArg.from,
          to: queryArg.to,
          page: pageParam,
          size: HISTORY_PAGE_SIZE,
        },
      }),
      providesTags: [TRANSACTION_HISTORY],
    }),
    getTransaction: build.query<
      TransactionItemResponse,
      { type: TransactionActivityType; id: string }
    >({
      query: ({ type, id }) => ({
        path: `/transactions/${type}/${encodeURIComponent(id)}`,
      }),
      providesTags: (_result, _error, { type, id }) => [
        { type: 'Transaction', id: `${type}-${id}` },
      ],
    }),
    getTransactionSummary: build.query<TransactionSummaryResponse, TransactionSummaryArgs>({
      query: ({ from, to }) => ({ path: '/transactions/summary', query: { from, to } }),
      providesTags: [TRANSACTION_SUMMARY],
    }),
  }),
});

export const {
  useGetTransactionHistoryInfiniteQuery,
  useGetTransactionQuery,
  useGetTransactionSummaryQuery,
} = transactionApi;
