import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { toAppError, type AppError } from '@/services/api/errors';

/** Backend auth error codes (VERIFIED in the API map) → user-facing copy. */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Email/phone or password is incorrect.',
  USER_DISABLED: 'This account has been disabled. Please contact support.',
  EMAIL_NOT_VERIFIED: 'Verify your email before signing in.',
  PASSWORD_LOGIN_UNAVAILABLE: 'This account uses Google Sign-In. Continue with Google.',
  PASSWORD_NOT_SET: 'No password is set for this account. Use Forgot password to create one.',
  INVALID_GOOGLE_TOKEN: 'Google sign-in failed. Try again.',
  GOOGLE_EMAIL_UNVERIFIED: 'Your Google email must be verified to continue.',
  GOOGLE_AUTH_DISABLED: 'Google Sign-In is not available in this build.',
  GOOGLE_ACCOUNT_CONFLICT: 'This email is linked to a different Google account.',
  EMAIL_ALREADY_REGISTERED: 'An account with this email already exists.',
  PHONE_ALREADY_REGISTERED: 'An account with this phone number already exists. Sign in instead.',
  SIGNUP_INCOMPLETE: 'Registration is incomplete for this phone. Continue where you left off.',
  EMAIL_ALREADY_VERIFIED: 'Your email is already verified. Sign in to continue.',
  OTP_INVALID: 'That code is incorrect. Check it and try again.',
  OTP_EXPIRED: 'This code has expired. Request a new one.',
  OTP_MAX_ATTEMPTS: 'Too many incorrect attempts. Request a new code.',
  OTP_NOT_FOUND: 'There is no active code. Request a new one.',
  OTP_CHANNEL_MISMATCH: 'This code is no longer valid. Request a new one.',
  OTP_EMAIL_FAILED: 'We could not send the email. Check your address and try again.',
  USER_NOT_FOUND: "We couldn't find an account for this email.",
  INVALID_CURRENT_PASSWORD: 'Your current password is incorrect.',
  // Legacy code from a short-lived reject-concurrent policy; login now takes over the session.
  SESSION_ALREADY_ACTIVE:
    'Signed in on another device. Try again — that session will be replaced.',
};

/** Codes that belong to a single form field rather than the whole form. */
const FIELD_FOR_CODE: Record<string, string> = {
  EMAIL_ALREADY_REGISTERED: 'email',
  PHONE_ALREADY_REGISTERED: 'phone',
  OTP_INVALID: 'code',
  OTP_EXPIRED: 'code',
  OTP_MAX_ATTEMPTS: 'code',
  OTP_NOT_FOUND: 'code',
  OTP_CHANNEL_MISMATCH: 'code',
  INVALID_CURRENT_PASSWORD: 'currentPassword',
};

export function authErrorMessage(error: AppError): string {
  return (error.code && MESSAGES[error.code]) || error.message;
}

/**
 * Applies server errors to a form: validation violations and field-specific codes go to their
 * field; anything else is returned as a form-level message.
 */
export function applyServerErrors<T extends FieldValues>(
  raw: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  const error = toAppError(raw);
  let handled = false;

  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message });
      handled = true;
    }
  }

  const codeField = error.code ? FIELD_FOR_CODE[error.code] : undefined;
  if (codeField && (fields as readonly string[]).includes(codeField)) {
    setError(codeField as Path<T>, { type: 'server', message: authErrorMessage(error) });
    return null;
  }

  return handled ? null : authErrorMessage(error);
}
