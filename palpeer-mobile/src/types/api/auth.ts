import type { Uuid } from './common';

/** VERIFIED: `AuthTokensResponse` returned by POST /auth/login and POST /auth/refresh. */
export type AuthTokensResponse = {
  userId: Uuid;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
};

/** VERIFIED: `RefreshTokenRequest`. */
export type RefreshTokenRequest = {
  refreshToken: string;
};

/** VERIFIED: `LogoutRequest` (public endpoint, always 200). */
export type LogoutRequest = {
  refreshToken: string;
};

export type LoginRequest = {
  /** Email address or phone number. */
  email: string;
  password: string;
};

/** VERIFIED: POST /auth/google — Google ID token exchange. */
export type GoogleAuthRequest = {
  idToken: string;
};

/** VERIFIED: `RegisterRequest`. email ≤ 320, phone ≤ 32 (no format rule), password 8–128. */
export type RegisterRequest = {
  email: string;
  phone: string;
  password: string;
};

/** VERIFIED: `RegisterResponse` (201). Registration does not return tokens. */
export type RegisterResponse = {
  userId: Uuid;
  email: string;
  phone: string;
  status: string;
  message: string;
  /** Present only when the API has OTP log-code enabled (local/dev autofill). */
  debugOtp?: string | null;
};

/** VERIFIED: `OtpResendResponse`. */
export type OtpResendResponse = {
  debugOtp?: string | null;
};

/** VERIFIED: `OtpPurpose`. */
export type OtpPurpose = 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION' | 'PASSWORD_RESET';

/** VERIFIED: `OtpChannel`. */
export type OtpChannel = 'EMAIL' | 'SMS';

/** VERIFIED: `OtpVerifyRequest`. `PASSWORD_RESET` is rejected by this endpoint. */
export type OtpVerifyRequest = {
  email: string;
  purpose: Exclude<OtpPurpose, 'PASSWORD_RESET'>;
  channel: OtpChannel;
  code: string;
};

/** VERIFIED: `OtpResendRequest`. */
export type OtpResendRequest = {
  email: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
};

/** VERIFIED: `PasswordResetRequestDto`. Always 200 whether or not the account exists. */
export type PasswordResetRequest = {
  email: string;
};

/** VERIFIED: `PasswordResetConfirmRequest`. Revokes every refresh token of the user. */
export type PasswordResetConfirmRequest = {
  email: string;
  code: string;
  newPassword: string;
};

/** VERIFIED: `ChangePasswordRequest`. Revokes every refresh token of the user, including this one. */
export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

/**
 * VERIFIED: `SessionResponse` from GET /auth/sessions. One session = one active refresh token; no
 * device, IP or location data exists. `current` is only true when the caller sends its refresh
 * token in `X-Refresh-Token`.
 */
export type SessionResponse = {
  id: Uuid;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};
