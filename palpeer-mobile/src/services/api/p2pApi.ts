import type {
  CreateP2PRequest,
  P2PFeeEstimateResponse,
  P2POrderResponse,
  P2POrderSummaryResponse,
  P2PRateBoundsResponse,
  P2PRequestResponse,
  UpdateP2PRequest,
} from '@/types/api/p2p';

import { baseApi } from './baseApi';
import { jsonDecimal } from './json';

const OPEN_LIST = { type: 'P2PRequest', id: 'OPEN' } as const;
const MINE = { type: 'P2PRequest', id: 'MINE' } as const;
const ORDERS = { type: 'P2POrder', id: 'MINE' } as const;
/** Sell holds / releases change available + pending balances. */
const WALLET_LIST = { type: 'Wallet' as const, id: 'LIST' };

function requestPath(id: string) {
  return `/p2p/requests/${encodeURIComponent(id)}`;
}

function createBody(request: CreateP2PRequest) {
  return {
    ...request,
    amount: jsonDecimal(request.amount),
    rate: jsonDecimal(request.rate),
  };
}

function updateBody({ amount, rate, ...rest }: UpdateP2PRequest) {
  return {
    ...rest,
    ...(amount !== undefined ? { amount: jsonDecimal(amount) } : null),
    ...(rate !== undefined ? { rate: jsonDecimal(rate) } : null),
  };
}

export const p2pApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Configured min/max rate for a pair; null when admin has not set bounds. */
    getP2PRateBounds: build.query<
      P2PRateBoundsResponse | null,
      { baseCurrencyCode: string; quoteCurrencyCode: string }
    >({
      query: ({ baseCurrencyCode, quoteCurrencyCode }) => ({
        path: '/p2p/rate-bounds',
        query: { baseCurrencyCode, quoteCurrencyCode },
      }),
    }),
    /** Buyer platform fee estimate from configured P2P fee tiers. */
    getP2PFeeEstimate: build.query<
      P2PFeeEstimateResponse,
      {
        baseCurrencyCode: string;
        quoteCurrencyCode: string;
        amount: string;
        rate?: string;
        applyBonusCredit?: boolean;
        /** Explicit promo code — never auto-applied without this. */
        promotionCode?: string | null;
      }
    >({
      query: ({
        baseCurrencyCode,
        quoteCurrencyCode,
        amount,
        rate,
        applyBonusCredit,
        promotionCode,
      }) => ({
        path: '/p2p/fee-estimate',
        query: {
          baseCurrencyCode,
          quoteCurrencyCode,
          amount,
          ...(rate ? { rate } : {}),
          ...(applyBonusCredit ? { applyBonusCredit: true } : {}),
          ...(promotionCode?.trim() ? { promotionCode: promotionCode.trim() } : {}),
        },
      }),
    }),
    /** OPEN, non-expired requests from every user (including the caller), newest first. */
    getOpenRequests: build.query<P2PRequestResponse[], void>({
      query: () => ({ path: '/p2p/requests' }),
      providesTags: [OPEN_LIST],
    }),
    /** The caller's requests in every status, newest first. */
    getMyRequests: build.query<P2PRequestResponse[], void>({
      query: () => ({ path: '/p2p/me/requests' }),
      providesTags: [MINE],
    }),
    getRequest: build.query<P2PRequestResponse, string>({
      query: (id) => ({ path: requestPath(id) }),
      providesTags: (_result, _error, id) => [{ type: 'P2PRequest', id }],
    }),
    createRequest: build.mutation<P2PRequestResponse, CreateP2PRequest>({
      query: (request) => ({ path: '/p2p/requests', method: 'POST', body: createBody(request) }),
      invalidatesTags: (_result, error) => (error ? [] : [OPEN_LIST, MINE, WALLET_LIST]),
    }),
    updateRequest: build.mutation<P2PRequestResponse, { id: string; changes: UpdateP2PRequest }>({
      query: ({ id, changes }) => ({
        path: requestPath(id),
        method: 'PUT',
        body: updateBody(changes),
      }),
      // A 409 means the request left OPEN meanwhile; refetching shows its current status.
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'P2PRequest', id },
        OPEN_LIST,
        MINE,
        WALLET_LIST,
      ],
    }),
    /** OPEN → cancel; CANCELLED/EXPIRED → remove from history. */
    cancelRequest: build.mutation<null, string>({
      query: (id) => ({ path: requestPath(id), method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'P2PRequest', id },
        OPEN_LIST,
        MINE,
        WALLET_LIST,
      ],
    }),
    /** Alias for removing a cancelled/expired request from history (same DELETE endpoint). */
    deleteRequest: build.mutation<null, string>({
      query: (id) => ({ path: requestPath(id), method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'P2PRequest', id },
        OPEN_LIST,
        MINE,
      ],
    }),
    acceptRequest: build.mutation<
      P2POrderResponse,
      string | { id: string; applyBonusCredit?: boolean; promotionCode?: string | null }
    >({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const applyBonusCredit = typeof arg === 'string' ? undefined : arg.applyBonusCredit;
        const promotionCode = typeof arg === 'string' ? undefined : arg.promotionCode?.trim();
        return {
          path: `${requestPath(id)}/accept`,
          method: 'POST',
          query: {
            ...(applyBonusCredit ? { applyBonusCredit: true } : {}),
            ...(promotionCode ? { promotionCode } : {}),
          },
        };
      },
      invalidatesTags: (_result, _error, arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        return [
          { type: 'P2PRequest', id },
          OPEN_LIST,
          MINE,
          ORDERS,
          WALLET_LIST,
          { type: 'Bonus', id: 'MINE' },
        ];
      },
    }),
    /** Orders where the caller is the requester or the acceptor, newest first. */
    getMyOrders: build.query<P2POrderSummaryResponse[], void>({
      query: () => ({ path: '/p2p/me/orders' }),
      providesTags: [ORDERS],
    }),
    /** Participants only; anyone else gets 404. */
    getOrder: build.query<P2POrderResponse, string>({
      query: (id) => ({ path: `/p2p/orders/${encodeURIComponent(id)}` }),
      providesTags: (_result, _error, id) => [{ type: 'P2POrder', id }],
    }),
    /** Remove a cancelled order from the caller's history only. */
    deleteOrder: build.mutation<null, string>({
      query: (id) => ({
        path: `/p2p/orders/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'P2POrder', id }, ORDERS],
    }),
  }),
});

export const {
  useGetP2PRateBoundsQuery,
  useGetP2PFeeEstimateQuery,
  useGetOpenRequestsQuery,
  useGetMyRequestsQuery,
  useGetRequestQuery,
  useCreateRequestMutation,
  useUpdateRequestMutation,
  useCancelRequestMutation,
  useDeleteRequestMutation,
  useAcceptRequestMutation,
  useGetMyOrdersQuery,
  useGetOrderQuery,
  useDeleteOrderMutation,
} = p2pApi;
