import { authorizedRequest } from '@/services/api/authorized';
import { apiRequest, type ApiResult } from '@/services/api/client';
import type {
  AuthTokensResponse,
  ChangePasswordRequest,
  GoogleAuthRequest,
  LoginRequest,
  OtpVerifyRequest,
  PasswordResetConfirmRequest,
  RegisterRequest,
  RegisterResponse,
} from '@/types/api/auth';

import { deviceLoginPayload } from './deviceLogin';

/**
 * Account calls whose request or response bodies are secrets (passwords, one-time codes, tokens).
 * Like `securityCommands`, they bypass RTK Query, which keeps mutation arguments and results in
 * Redux state and dev tooling.
 */
export const accountCommands = {
  async login(
    body: Pick<LoginRequest, 'email' | 'password'>,
  ): Promise<ApiResult<AuthTokensResponse>> {
    const device = await deviceLoginPayload();
    return apiRequest('/auth/login', {
      method: 'POST',
      body: { ...body, ...device },
      timeoutMs: 120_000,
    });
  },

  async loginWithGoogle(body: Pick<GoogleAuthRequest, 'idToken'>): Promise<ApiResult<AuthTokensResponse>> {
    const device = await deviceLoginPayload();
    return apiRequest('/auth/google', { method: 'POST', body: { ...body, ...device } });
  },

  register(body: RegisterRequest): Promise<ApiResult<RegisterResponse>> {
    // Render free-tier cold starts often exceed the default 15s client timeout.
    return apiRequest('/auth/register', { method: 'POST', body, timeoutMs: 120_000 });
  },

  verifyOtp(body: OtpVerifyRequest): Promise<ApiResult<void>> {
    return apiRequest('/auth/otp/verify', { method: 'POST', body });
  },

  confirmPasswordReset(body: PasswordResetConfirmRequest): Promise<ApiResult<void>> {
    return apiRequest('/auth/password-reset/confirm', { method: 'POST', body });
  },

  changePassword(body: ChangePasswordRequest): Promise<ApiResult<void>> {
    return authorizedRequest('/auth/password/change', { method: 'POST', body });
  },
};
