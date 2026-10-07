import type {
  CounterOfferRequest,
  CreateOfferRequest,
  NegotiationResponse,
} from '@/types/api/negotiation';

import { baseApi } from './baseApi';
import { jsonDecimal } from './json';

const MINE = { type: 'Negotiation', id: 'MINE' } as const;

function terms({ amount, rate }: { amount: string; rate: string }) {
  return { amount: jsonDecimal(amount), rate: jsonDecimal(rate) };
}

export const negotiationApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Negotiations where I own the request or made the first offer; optionally for one request. */
    getMyNegotiations: build.query<NegotiationResponse[], { p2pRequestId?: string } | void>({
      query: (arg) => ({
        path: '/negotiations/me',
        query: arg?.p2pRequestId ? { p2pRequestId: arg.p2pRequestId } : undefined,
      }),
      providesTags: (result) => [
        MINE,
        ...(result ?? []).map((negotiation) => ({
          type: 'Negotiation' as const,
          id: negotiation.id,
        })),
      ],
    }),
    getNegotiation: build.query<NegotiationResponse, string>({
      query: (id) => ({ path: `/negotiations/${encodeURIComponent(id)}` }),
      providesTags: (_result, _error, id) => [{ type: 'Negotiation', id }],
    }),
    createOffer: build.mutation<NegotiationResponse, CreateOfferRequest>({
      query: ({ p2pRequestId, ...offer }) => ({
        path: '/negotiations/offers',
        method: 'POST',
        body: { p2pRequestId, ...terms(offer) },
      }),
      invalidatesTags: (_result, error) => (error ? [] : [MINE]),
    }),
    counterOffer: build.mutation<NegotiationResponse, { id: string; offer: CounterOfferRequest }>({
      query: ({ id, offer }) => ({
        path: `/negotiations/${encodeURIComponent(id)}/counter`,
        method: 'POST',
        body: terms(offer),
      }),
      // A 409 means the other side moved first; refetching shows whose turn it is now.
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Negotiation', id }, MINE],
    }),
    /** Creates the P2P order with the offer's terms; the response carries `p2pOrderId`. */
    acceptNegotiation: build.mutation<NegotiationResponse, { id: string; p2pRequestId: string }>({
      query: ({ id }) => ({
        path: `/negotiations/${encodeURIComponent(id)}/accept`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { id, p2pRequestId }) => [
        { type: 'Negotiation', id },
        MINE,
        ...requestClosedTags(p2pRequestId),
      ],
    }),
    /** Declines the other side's pending offer (only on my turn); the negotiation ends. */
    rejectNegotiation: build.mutation<NegotiationResponse, string>({
      query: (id) => ({ path: `/negotiations/${encodeURIComponent(id)}/reject`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Negotiation', id }, MINE],
    }),
    /** Withdraws from an open negotiation (either participant, any turn). */
    cancelNegotiation: build.mutation<NegotiationResponse, string>({
      query: (id) => ({ path: `/negotiations/${encodeURIComponent(id)}/cancel`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Negotiation', id }, MINE],
    }),
  }),
});

/** Cache entries that change once a P2P request is accepted and leaves the marketplace. */
export function requestClosedTags(p2pRequestId: string) {
  return [
    { type: 'P2PRequest' as const, id: p2pRequestId },
    { type: 'P2PRequest' as const, id: 'OPEN' },
    { type: 'P2PRequest' as const, id: 'MINE' },
    { type: 'P2POrder' as const, id: 'MINE' },
  ];
}

export const {
  useGetMyNegotiationsQuery,
  useGetNegotiationQuery,
  useCreateOfferMutation,
  useCounterOfferMutation,
  useAcceptNegotiationMutation,
  useRejectNegotiationMutation,
  useCancelNegotiationMutation,
} = negotiationApi;
