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
  /** Stable per-install id — required for single-device login enforcement. */
  deviceIdentifier: string;
  deviceName?: string;
  platform?: string;
};

/** VERIFIED: POST /auth/google — Google ID token exchange. */
export type GoogleAuthRequest = {
  idToken: string;
  deviceIdentifier: string;
  deviceName?: string;
  platform?: string;
};

/** VERIFIED: `RegisterRequest`. email ≤ 320, username 3–32 [A-Za-z0-9_], phone ≤ 32, password 8–128. */
export type RegisterRequest = {
  email: string;
  username: string;
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
  /** Present only when the API has OTP log-code enabled (dev troubleshooting; never autofilled). */
  debugOtp?: string | null;
};

/** VERIFIED: `OtpResendResponse`. */
export type OtpResendResponse = {
  debugOtp?: string | null;
};

/** VERIFIED: `SignupStatusResponse` from POST /auth/signup/status. */
export type SignupNextStep =
  | 'PHONE_OTP_REQUIRED'
  | 'REGISTER_REQUIRED'
  | 'EMAIL_OTP_REQUIRED'
  | 'LOGIN_READY'
  | 'BLOCKED';

export type SignupStatusResponse = {
  nextStep: SignupNextStep;
  phone: string;
  email: string | null;
  maskedEmail: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  hasLoggedIn: boolean;
  status: string | null;
};

export type SignupStatusRequest = { phone: string };

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

/**
 * VERIFIED: `PasswordResetRequestDto`. Always 200 whether or not the account exists.
 * Response is `OtpResendResponse` (`debugOtp` only when OTP log-code is enabled).
 */
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
 * VERIFIED: `SessionResponse` from GET /auth/sessions. One session = one active refresh token.
 * `current` is only true when the caller sends its refresh token in `X-Refresh-Token`.
 */
export type SessionResponse = {
  id: Uuid;
  createdAt: string;
  expiresAt: string;
  current: boolean;
  deviceIdentifier: string | null;
  deviceName: string | null;
  platform: string | null;
};
