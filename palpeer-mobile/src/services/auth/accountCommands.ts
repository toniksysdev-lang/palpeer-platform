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

/**
 * Account calls whose request or response bodies are secrets (passwords, one-time codes, tokens).
 * Like `securityCommands`, they bypass RTK Query, which keeps mutation arguments and results in
 * Redux state and dev tooling.
 */
export const accountCommands = {
  login(body: LoginRequest): Promise<ApiResult<AuthTokensResponse>> {
    return apiRequest('/auth/login', { method: 'POST', body });
  },

  loginWithGoogle(body: GoogleAuthRequest): Promise<ApiResult<AuthTokensResponse>> {
    return apiRequest('/auth/google', { method: 'POST', body });
  },

  register(body: RegisterRequest): Promise<ApiResult<RegisterResponse>> {
    return apiRequest('/auth/register', { method: 'POST', body });
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
