import type {
  CreateP2PRequest,
  P2POrderResponse,
  P2POrderSummaryResponse,
  P2PRequestResponse,
  UpdateP2PRequest,
} from '@/types/api/p2p';

import { baseApi } from './baseApi';
import { jsonDecimal } from './json';

const OPEN_LIST = { type: 'P2PRequest', id: 'OPEN' } as const;
const MINE = { type: 'P2PRequest', id: 'MINE' } as const;
const ORDERS = { type: 'P2POrder', id: 'MINE' } as const;

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
      invalidatesTags: (_result, error) => (error ? [] : [OPEN_LIST, MINE]),
    }),
    updateRequest: build.mutation<P2PRequestResponse, { id: string; changes: UpdateP2PRequest }>({
      query: ({ id, changes }) => ({
        path: requestPath(id),
        method: 'PUT',
        body: updateBody(changes),
      }),
      // A 409 means the request left OPEN meanwhile; refetching shows its current status.
      invalidatesTags: (_result, _error, { id }) => [{ type: 'P2PRequest', id }, OPEN_LIST, MINE],
    }),
    cancelRequest: build.mutation<null, string>({
      query: (id) => ({ path: requestPath(id), method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'P2PRequest', id }, OPEN_LIST, MINE],
    }),
    acceptRequest: build.mutation<P2POrderResponse, string>({
      query: (id) => ({ path: `${requestPath(id)}/accept`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'P2PRequest', id },
        OPEN_LIST,
        MINE,
        ORDERS,
      ],
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
  }),
});

export const {
  useGetOpenRequestsQuery,
  useGetMyRequestsQuery,
  useGetRequestQuery,
  useCreateRequestMutation,
  useUpdateRequestMutation,
  useCancelRequestMutation,
  useAcceptRequestMutation,
  useGetMyOrdersQuery,
  useGetOrderQuery,
} = p2pApi;
