import type { SpringPage } from '@/types/api/common';
import type {
  BankOptionResponse,
  CreateFundingRequest,
  CreateWalletRequest,
  CreateWalletTransferRequest,
  CreateWithdrawalRequest,
  FundingTransactionResponse,
  LedgerTransactionResponse,
  TransactionItemResponse,
  TransferRecipientResponse,
  WalletResponse,
  WalletTransferResponse,
  WithdrawalTransactionResponse,
} from '@/types/api/wallet';

import { baseApi } from './baseApi';
import { jsonDecimal } from './json';
import { TRANSACTION_HISTORY, TRANSACTION_SUMMARY } from './transactionApi';

const WALLET_LIST = { type: 'Wallet' as const, id: 'LIST' };
const RECENT = { type: 'Transaction' as const, id: 'RECENT' };
/** Every list a new or finished money movement shows up in. */
const ACTIVITY = [RECENT, TRANSACTION_HISTORY, TRANSACTION_SUMMARY];

export const LEDGER_PAGE_SIZE = 20;

/** The idempotency key belongs to one user intent and is reused when that intent is retried. */
type WithKey<T> = T & { idempotencyKey: string };

export const walletApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWallets: build.query<WalletResponse[], void>({
      query: () => ({ path: '/wallets' }),
      providesTags: (result) => [
        WALLET_LIST,
        ...(result ?? []).map((wallet) => ({ type: 'Wallet' as const, id: wallet.id })),
      ],
    }),
    getWallet: build.query<WalletResponse, string>({
      query: (walletId) => ({ path: `/wallets/${encodeURIComponent(walletId)}` }),
      providesTags: (_result, _error, walletId) => [{ type: 'Wallet', id: walletId }],
    }),
    getWalletTransactions: build.infiniteQuery<
      SpringPage<LedgerTransactionResponse>,
      string,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
      },
      query: ({ queryArg: walletId, pageParam }) => ({
        path: `/wallets/${encodeURIComponent(walletId)}/transactions`,
        query: { page: pageParam, size: LEDGER_PAGE_SIZE },
      }),
      providesTags: (_result, _error, walletId) => [{ type: 'Wallet', id: `LEDGER-${walletId}` }],
    }),
    createWallet: build.mutation<WalletResponse, CreateWalletRequest>({
      query: (body) => ({ path: '/wallets', method: 'POST', body }),
      invalidatesTags: [WALLET_LIST],
    }),

    /** Newest funding/withdrawal/exchange items; used to surface in-progress movements. */
    getRecentTransactions: build.query<TransactionItemResponse[], number | void>({
      query: (limit) => ({ path: '/transactions/recent', query: { limit: limit ?? 20 } }),
      providesTags: [RECENT],
    }),

    createFunding: build.mutation<FundingTransactionResponse, WithKey<CreateFundingRequest>>({
      query: ({
        walletId,
        amount,
        interacEmail,
        interacFirstName,
        interacLastName,
        idempotencyKey,
      }) => ({
        path: '/funding',
        method: 'POST',
        body: {
          walletId,
          amount: jsonDecimal(amount),
          ...(interacEmail ? { interacEmail } : null),
          ...(interacFirstName ? { interacFirstName } : null),
          ...(interacLastName ? { interacLastName } : null),
        },
        idempotencyKey,
      }),
      // Pending funding only needs activity lists; SUCCESS (e.g. sandbox auto-settle) updates balances now.
      invalidatesTags: (result, error, { walletId }) => {
        if (error) return [];
        if (result?.status === 'SUCCESS') return walletBalanceTags(walletId);
        return ACTIVITY;
      },
    }),
    getFunding: build.query<FundingTransactionResponse, string>({
      query: (fundingId) => ({ path: `/funding/${encodeURIComponent(fundingId)}` }),
      providesTags: (_result, _error, id) => [{ type: 'Transaction', id: `FUNDING-${id}` }],
    }),

    createWithdrawal: build.mutation<
      WithdrawalTransactionResponse,
      WithKey<CreateWithdrawalRequest>
    >({
      query: ({ walletId, amount, destinationReference, idempotencyKey }) => ({
        path: '/withdrawals',
        method: 'POST',
        body: { walletId, amount: jsonDecimal(amount), destinationReference },
        idempotencyKey,
      }),
      // The hold moves money from available to pending as soon as the withdrawal is created.
      invalidatesTags: (_result, error, { walletId }) =>
        error
          ? []
          : [
              WALLET_LIST,
              ...ACTIVITY,
              { type: 'Wallet', id: walletId },
              { type: 'Wallet', id: `LEDGER-${walletId}` },
            ],
    }),
    getWithdrawal: build.query<WithdrawalTransactionResponse, string>({
      query: (withdrawalId) => ({ path: `/withdrawals/${encodeURIComponent(withdrawalId)}` }),
      providesTags: (_result, _error, id) => [{ type: 'Transaction', id: `WITHDRAWAL-${id}` }],
    }),

    /** Nigerian (default) payout banks for NGN withdrawals. */
    getWithdrawalBanks: build.query<BankOptionResponse[], string | void>({
      query: (country) => ({
        path: '/withdrawals/banks',
        query: { country: country ?? 'NG' },
      }),
    }),

    createWalletTransfer: build.mutation<
      WalletTransferResponse,
      WithKey<CreateWalletTransferRequest>
    >({
      query: ({ sourceWalletId, recipient, amount, note, idempotencyKey }) => ({
        path: '/transfers',
        method: 'POST',
        body: {
          sourceWalletId,
          recipient,
          amount: jsonDecimal(amount),
          ...(note ? { note } : {}),
        },
        idempotencyKey,
      }),
      invalidatesTags: (_result, error, { sourceWalletId }) =>
        error
          ? []
          : [
              WALLET_LIST,
              ...ACTIVITY,
              { type: 'Wallet', id: sourceWalletId },
              { type: 'Wallet', id: `LEDGER-${sourceWalletId}` },
            ],
    }),

    /** Confirms email/phone exists and returns the recipient's full name for review. */
    lookupTransferRecipient: build.query<
      TransferRecipientResponse,
      { q: string; currencyCode?: string }
    >({
      query: ({ q, currencyCode }) => ({
        path: '/transfers/recipient',
        query: { q, ...(currencyCode ? { currencyCode } : {}) },
      }),
    }),
  }),
});

export const {
  useGetWalletsQuery,
  useGetWalletQuery,
  useGetWalletTransactionsInfiniteQuery,
  useCreateWalletMutation,
  useGetRecentTransactionsQuery,
  useCreateFundingMutation,
  useGetFundingQuery,
  useCreateWithdrawalMutation,
  useGetWithdrawalQuery,
  useGetWithdrawalBanksQuery,
  useCreateWalletTransferMutation,
  useLazyLookupTransferRecipientQuery,
} = walletApi;

/** Tags to refresh once a funding or withdrawal reaches a final status. */
export function walletBalanceTags(walletId: string) {
  return [
    WALLET_LIST,
    ...ACTIVITY,
    { type: 'Wallet' as const, id: walletId },
    { type: 'Wallet' as const, id: `LEDGER-${walletId}` },
  ];
}
