import type {
  ExchangeRateResponse,
  PublicInstantRateResponse,
  PublicP2PRateResponse,
  PublicP2PRequestResponse,
} from '@/types/api/exchange';
import type { CurrencyResponse } from '@/types/api/wallet';

import { baseApi } from './baseApi';

export const currencyApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getCurrencies: build.query<CurrencyResponse[], void>({
      query: () => ({ path: '/currencies' }),
      providesTags: [{ type: 'Currency', id: 'LIST' }],
      keepUnusedDataFor: 60 * 60,
    }),
    /** Latest published rate for one base/quote pair; 404 when none is published. */
    getLatestRate: build.query<ExchangeRateResponse, { base: string; quote: string }>({
      query: ({ base, quote }) => ({ path: '/exchange-rates/latest', query: { base, quote } }),
      providesTags: (_result, _error, { base, quote }) => [
        { type: 'Rate', id: `${base}/${quote}` },
      ],
      keepUnusedDataFor: 30,
    }),
    /** Public InstantEX board — admin-published rates for every pair (no auth). */
    getPublicInstantRates: build.query<PublicInstantRateResponse[], void>({
      query: () => ({ path: '/public/instant-rates', public: true }),
      providesTags: [{ type: 'Rate', id: 'PUBLIC_INSTANT' }],
      keepUnusedDataFor: 30,
    }),
    /** Public Live P2P board — open request rates without owner details (no auth). */
    getPublicP2PRates: build.query<PublicP2PRateResponse[], void>({
      query: () => ({ path: '/public/p2p-rates', public: true }),
      providesTags: [{ type: 'P2PRequest', id: 'PUBLIC_RATES' }],
      keepUnusedDataFor: 15,
    }),
    /** Shared open P2P request for guest Accept (no auth). */
    getPublicP2PRequest: build.query<PublicP2PRequestResponse, string>({
      query: (id) => ({ path: `/public/p2p-requests/${encodeURIComponent(id)}`, public: true }),
      providesTags: (_result, _error, id) => [{ type: 'P2PRequest', id: `PUBLIC_${id}` }],
      keepUnusedDataFor: 15,
    }),
  }),
});

export const {
  useGetCurrenciesQuery,
  useGetLatestRateQuery,
  useGetPublicInstantRatesQuery,
  useGetPublicP2PRatesQuery,
  useGetPublicP2PRequestQuery,
} = currencyApi;
