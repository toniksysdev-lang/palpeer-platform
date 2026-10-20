import type {
  OtpResendRequest,
  OtpResendResponse,
  PasswordResetRequest,
  SessionResponse,
} from '@/types/api/auth';
import { secureStorage } from '@/services/storage/secureStorage';

import { authorizedRequest } from './authorized';
import { baseApi } from './baseApi';

const SESSIONS = { type: 'Session', id: 'LIST' } as const;

/**
 * Auth endpoints without secrets in their bodies. Login, registration, OTP verification and
 * password changes live in `accountCommands`; refresh and logout are owned by `sessionManager`
 * because they must run outside React (single-flight refresh, cold-start restore).
 */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    resendOtp: build.mutation<OtpResendResponse, OtpResendRequest>({
      query: (body) => ({ path: '/auth/otp/resend', method: 'POST', body, public: true }),
    }),
    requestPhoneOtp: build.mutation<OtpResendResponse, { phone: string }>({
      query: (body) => ({
        path: '/auth/otp/phone/request',
        method: 'POST',
        body,
        public: true,
      }),
    }),
    verifyPhoneOtp: build.mutation<void, { phone: string; code: string }>({
      query: (body) => ({
        path: '/auth/otp/phone/verify',
        method: 'POST',
        body,
        public: true,
      }),
    }),
    getRegistrationCountries: build.query<string[], void>({
      query: () => ({ path: '/public/registration-countries', method: 'GET', public: true }),
    }),
    requestPasswordReset: build.mutation<void, PasswordResetRequest>({
      query: (body) => ({
        path: '/auth/password-reset/request',
        method: 'POST',
        body,
        public: true,
      }),
    }),
    /**
     * The refresh token is read from Secure Store here, not passed as an argument, so it never
     * lands in the RTK Query cache keys.
     */
    getSessions: build.query<SessionResponse[], void>({
      async queryFn() {
        const stored = await secureStorage.loadSession();
        const result = await authorizedRequest<SessionResponse[]>('/auth/sessions', {
          headers: stored ? { 'X-Refresh-Token': stored.refreshToken } : undefined,
        });
        return result.ok ? { data: result.data ?? [] } : { error: result.error };
      },
      providesTags: [SESSIONS],
    }),
    revokeSession: build.mutation<void, string>({
      query: (id) => ({ path: `/auth/sessions/${encodeURIComponent(id)}/revoke`, method: 'POST' }),
      invalidatesTags: [SESSIONS],
    }),
    revokeAllSessions: build.mutation<void, void>({
      query: () => ({ path: '/auth/sessions/revoke-all', method: 'POST' }),
      invalidatesTags: [SESSIONS],
    }),
  }),
});

export const {
  useResendOtpMutation,
  useRequestPhoneOtpMutation,
  useVerifyPhoneOtpMutation,
  useGetRegistrationCountriesQuery,
  useRequestPasswordResetMutation,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeAllSessionsMutation,
} = authApi;
