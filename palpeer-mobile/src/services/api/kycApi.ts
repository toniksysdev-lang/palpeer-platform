import type {
  KycProgressResponse,
  KycStatusResponse,
  KycVerificationResponse,
  StartKycVerificationRequest,
} from '@/types/api/kyc';

import { baseApi } from './baseApi';

/**
 * KYC reads and verification start. Document/selfie uploads go through `uploadMultipart`
 * (XHR, for progress) and invalidate the `KycStatus` tag themselves.
 */
export const kycApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getKycStatus: build.query<KycStatusResponse, void>({
      query: () => ({ path: '/kyc/status' }),
      providesTags: ['KycStatus'],
    }),
    getKycProgress: build.query<KycProgressResponse, void>({
      query: () => ({ path: '/kyc/progress' }),
      providesTags: ['KycStatus'],
    }),
    startKycVerification: build.mutation<KycVerificationResponse, StartKycVerificationRequest>({
      query: (body) => ({ path: '/kyc/verification/start', method: 'POST', body }),
      invalidatesTags: ['KycStatus'],
    }),
  }),
});

export const { useGetKycStatusQuery, useGetKycProgressQuery, useStartKycVerificationMutation } =
  kycApi;
