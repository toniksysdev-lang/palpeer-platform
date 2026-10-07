import type { CardResponse, CardTransactionResponse, IssueCardRequest } from '@/types/api/card';
import type { SpringPage } from '@/types/api/common';

import { baseApi } from './baseApi';

const CARD_LIST = { type: 'Card' as const, id: 'LIST' };

export const CARD_TRANSACTIONS_PAGE_SIZE = 20;

/** Issuer-internal ids the app never needs; dropped so they can't be shown, cached or logged. */
function toCard(raw: CardResponse & { providerCardId?: unknown }): CardResponse {
  const { providerCardId: _dropped, ...card } = raw;
  return card;
}

function toCardTransaction(
  raw: CardTransactionResponse & { providerTransactionId?: unknown; ledgerEntryId?: unknown },
): CardTransactionResponse {
  const { providerTransactionId: _provider, ledgerEntryId: _ledger, ...transaction } = raw;
  return transaction;
}

function cardTags(card: CardResponse | undefined, id: string) {
  return [CARD_LIST, { type: 'Card' as const, id: card?.id ?? id }];
}

export const cardApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCards: build.query<CardResponse[], void>({
      query: () => ({ path: '/cards' }),
      transformResponse: (cards: CardResponse[]) => cards.map(toCard),
      providesTags: (result) => [
        CARD_LIST,
        ...(result ?? []).map((card) => ({ type: 'Card' as const, id: card.id })),
      ],
    }),
    getCard: build.query<CardResponse, string>({
      query: (cardId) => ({ path: `/cards/${encodeURIComponent(cardId)}` }),
      transformResponse: toCard,
      providesTags: (_result, _error, cardId) => [{ type: 'Card', id: cardId }],
    }),
    getCardTransactions: build.infiniteQuery<SpringPage<CardTransactionResponse>, string, number>({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
      },
      query: ({ queryArg: cardId, pageParam }) => ({
        path: `/cards/${encodeURIComponent(cardId)}/transactions`,
        query: { page: pageParam, size: CARD_TRANSACTIONS_PAGE_SIZE },
      }),
      transformResponse: (page: SpringPage<CardTransactionResponse>) => ({
        ...page,
        content: page.content.map(toCardTransaction),
      }),
      providesTags: (_result, _error, cardId) => [{ type: 'Card', id: `TX-${cardId}` }],
    }),
    issueCard: build.mutation<CardResponse, IssueCardRequest>({
      query: (body) => ({ path: '/cards', method: 'POST', body }),
      transformResponse: toCard,
      invalidatesTags: (_result, error) => (error ? [] : [CARD_LIST]),
    }),
    blockCard: build.mutation<CardResponse, string>({
      query: (cardId) => ({ path: `/cards/${encodeURIComponent(cardId)}/block`, method: 'POST' }),
      transformResponse: toCard,
      invalidatesTags: (result, _error, cardId) => cardTags(result, cardId),
    }),
    unblockCard: build.mutation<CardResponse, string>({
      query: (cardId) => ({ path: `/cards/${encodeURIComponent(cardId)}/unblock`, method: 'POST' }),
      transformResponse: toCard,
      invalidatesTags: (result, _error, cardId) => cardTags(result, cardId),
    }),
  }),
});

export const {
  useGetCardsQuery,
  useGetCardQuery,
  useGetCardTransactionsInfiniteQuery,
  useIssueCardMutation,
  useBlockCardMutation,
  useUnblockCardMutation,
} = cardApi;
