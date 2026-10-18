import type { MarketingAdvertResponse } from '@/types/api/marketing';

import { baseApi } from './baseApi';

export const marketingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMarketingAdverts: build.query<MarketingAdvertResponse[], void>({
      query: () => ({ path: '/public/marketing-adverts', public: true }),
      providesTags: [{ type: 'MarketingAdvert', id: 'ACTIVE' }],
    }),
  }),
});

export const { useGetMarketingAdvertsQuery } = marketingApi;
