import type {
  BusinessInterestResponse,
  CreateBusinessInterestRequest,
} from '@/types/api/businessInterest';

import { baseApi } from './baseApi';

export const businessInterestApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    submitBusinessInterest: build.mutation<
      BusinessInterestResponse,
      CreateBusinessInterestRequest
    >({
      query: (body) => ({
        path: '/public/business-account-interest',
        method: 'POST',
        body,
        public: true,
      }),
    }),
  }),
  overrideExisting: process.env.NODE_ENV !== 'production',
});

export const { useSubmitBusinessInterestMutation } = businessInterestApi;
