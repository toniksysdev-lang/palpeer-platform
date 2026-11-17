import { useCallback, useState } from 'react';
import { router } from 'expo-router';

import { authErrorMessage } from '@/features/auth/errors';
import { toE164 } from '@/features/auth/signupCountries';
import { useSecretCommand } from '@/hooks/useSecretCommand';
import {
  useRequestPasswordResetMutation,
  useResendSignupEmailOtpMutation,
} from '@/services/api/authApi';
import { apiRequest } from '@/services/api/client';
import { toAppError } from '@/services/api/errors';
import { accountCommands } from '@/services/auth/accountCommands';
import { sessionManager } from '@/services/auth/session';
import type { OtpResendResponse, SignupStatusResponse } from '@/types/api/auth';

type OkErr = { ok: true } | { ok: false; error: string };

/** Where design Start should jump after resuming incomplete phone signup. */
export type ResumeSignupResult =
  | { ok: true; next: 'phoneCode' | 'account' | 'emailCode' | 'login'; email?: string; created?: boolean }
  | { ok: false; error: string };

/**
 * Live auth for the design Start screen: login, signup (phone → account → email OTP),
 * and forgot-password.
 */
export function useLiveAuth() {
  const [loginCmd] = useSecretCommand(accountCommands.login);
  const [registerCmd] = useSecretCommand(accountCommands.register);
  const [verifyOtpCmd] = useSecretCommand(accountCommands.verifyOtp);
  const [confirmResetCmd] = useSecretCommand(accountCommands.confirmPasswordReset);
  const [resendSignupEmail] = useResendSignupEmailOtpMutation();
  const [requestPasswordReset] = useRequestPasswordResetMutation();

  const [authError, setAuthError] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const fail = (error: unknown): { ok: false; error: string } => {
    const appErr = toAppError(error);
    const msg = authErrorMessage(appErr);
    setAuthError(msg);
    setAuthErrorCode(appErr.code ?? null);
    return { ok: false, error: msg };
  };

  const clearAuthError = useCallback(() => {
    setAuthError(null);
    setAuthErrorCode(null);
  }, []);

  const onLogin = useCallback(
    async (who: string, pass: string) => {
      const identifier = who.trim();
      const password = pass;
      if (!identifier || !password) {
        setLoginError('Enter your email or phone, and your password.');
        return false;
      }
      // Backend login field is `email` but also accepts E.164 phone; normalize email case.
      const email = identifier.includes('@') ? identifier.toLowerCase() : identifier;
      setLoginError(null);
      setLoginBusy(true);
      try {
        const tokens = await loginCmd({ email, password });
        const sessionEmail = email.includes('@') ? email : null;
        await sessionManager.start(tokens, sessionEmail);
        return true;
      } catch (error) {
        setLoginError(authErrorMessage(toAppError(error)));
        return false;
      } finally {
        setLoginBusy(false);
      }
    },
    [loginCmd],
  );

  /** Design phone field is national digits; default corridor dial codes CAD/NGN. */
  const phoneE164 = useCallback((national: string, dial = '+1') => {
    const digits = national.replace(/\D/g, '');
    if (national.trim().startsWith('+')) return national.trim();
    // 11-digit Nigerian mobiles often start with 0; strip leading 0 for NG dial.
    if (dial === '+234' && digits.startsWith('0')) {
      return toE164(dial, digits.slice(1));
    }
    return toE164(dial, digits);
  }, []);

  /**
   * Phone OTP uses apiRequest directly (not RTK mutations). refetchOnFocus / query churn
   * was aborting the mutation signal mid-flight, which surfaced as a generic failure on Continue.
   */
  const onRequestPhoneOtp = useCallback(
    async (nationalPhone: string, dialCode = '+1'): Promise<OkErr> => {
      clearAuthError();
      setAuthBusy(true);
      try {
        const phone = phoneE164(nationalPhone, dialCode);
        const result = await apiRequest<OtpResendResponse>('/auth/otp/phone/request', {
          method: 'POST',
          body: { phone },
        });
        if (!result.ok) return fail(result.error);
        return { ok: true };
      } catch (error) {
        return fail(error);
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthError, phoneE164],
  );

  /**
   * After SIGNUP_INCOMPLETE: POST /auth/signup/status and map nextStep onto Start stages
   * (account / email OTP / login), matching EnterPhoneScreen resume.
   */
  const onResumeIncompleteSignup = useCallback(
    async (nationalPhone: string, dialCode = '+1'): Promise<ResumeSignupResult> => {
      clearAuthError();
      setAuthBusy(true);
      try {
        const phone = phoneE164(nationalPhone, dialCode);
        const statusResult = await apiRequest<SignupStatusResponse>('/auth/signup/status', {
          method: 'POST',
          body: { phone },
        });
        if (!statusResult.ok) return fail(statusResult.error);

        const status = statusResult.data;
        switch (status.nextStep) {
          case 'PHONE_OTP_REQUIRED': {
            const otp = await apiRequest<OtpResendResponse>('/auth/otp/phone/request', {
              method: 'POST',
              body: { phone },
            });
            if (!otp.ok) return fail(otp.error);
            return { ok: true, next: 'phoneCode' };
          }
          case 'REGISTER_REQUIRED':
            return { ok: true, next: 'account' };
          case 'EMAIL_OTP_REQUIRED': {
            if (!status.email) {
              const msg = 'We found your account, but email verification could not be resumed.';
              setAuthError(msg);
              setAuthErrorCode('SIGNUP_INCOMPLETE');
              return { ok: false, error: msg };
            }
            try {
              await resendSignupEmail({ phone }).unwrap();
            } catch {
              // Still open email OTP — user can tap Send code again.
            }
            return { ok: true, next: 'emailCode', email: status.email };
          }
          case 'LOGIN_READY':
            return {
              ok: true,
              next: 'login',
              email: status.email ?? phone,
              created: !status.hasLoggedIn,
            };
          case 'BLOCKED': {
            const msg = 'This account has been disabled. Please contact support.';
            setAuthError(msg);
            setAuthErrorCode('USER_DISABLED');
            return { ok: false, error: msg };
          }
          default: {
            const msg = 'Could not continue with this phone number. Try again.';
            setAuthError(msg);
            return { ok: false, error: msg };
          }
        }
      } catch (error) {
        return fail(error);
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthError, phoneE164, resendSignupEmail],
  );

  const onVerifyPhoneOtp = useCallback(
    async (nationalPhone: string, code: string, dialCode = '+1'): Promise<OkErr> => {
      clearAuthError();
      setAuthBusy(true);
      try {
        const phone = phoneE164(nationalPhone, dialCode);
        const result = await apiRequest<void>('/auth/otp/phone/verify', {
          method: 'POST',
          body: { phone, code: code.trim() },
        });
        if (!result.ok) return fail(result.error);
        return { ok: true };
      } catch (error) {
        return fail(error);
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthError, phoneE164],
  );

  const onRegister = useCallback(
    async (input: {
      email: string;
      username: string;
      password: string;
      nationalPhone: string;
      dialCode?: string;
    }): Promise<OkErr> => {
      clearAuthError();
      setAuthBusy(true);
      try {
        const phone = phoneE164(input.nationalPhone, input.dialCode ?? '+1');
        await registerCmd({
          email: input.email.trim().toLowerCase(),
          username: input.username.trim(),
          phone,
          password: input.password,
        });
        return { ok: true };
      } catch (error) {
        return fail(error);
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthError, phoneE164, registerCmd],
  );

  const onVerifyEmailOtp = useCallback(
    async (email: string, code: string): Promise<OkErr> => {
      clearAuthError();
      setAuthBusy(true);
      try {
        await verifyOtpCmd({
          email: email.trim().toLowerCase(),
          purpose: 'EMAIL_VERIFICATION',
          channel: 'EMAIL',
          code: code.trim(),
        });
        return { ok: true };
      } catch (error) {
        return fail(error);
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthError, verifyOtpCmd],
  );

  const onResendEmailOtp = useCallback(
    async (phoneNational: string, dialCode = '+1'): Promise<OkErr> => {
      clearAuthError();
      setAuthBusy(true);
      try {
        await resendSignupEmail({ phone: phoneE164(phoneNational, dialCode) }).unwrap();
        return { ok: true };
      } catch (error) {
        return fail(error);
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthError, phoneE164, resendSignupEmail],
  );

  const onRequestPasswordReset = useCallback(
    async (email: string): Promise<OkErr> => {
      clearAuthError();
      setAuthBusy(true);
      try {
        await requestPasswordReset({ email: email.trim().toLowerCase() }).unwrap();
        return { ok: true };
      } catch (error) {
        return fail(error);
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthError, requestPasswordReset],
  );

  const onConfirmPasswordReset = useCallback(
    async (email: string, code: string, newPassword: string): Promise<OkErr> => {
      clearAuthError();
      setAuthBusy(true);
      try {
        await confirmResetCmd({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword,
        });
        return { ok: true };
      } catch (error) {
        return fail(error);
      } finally {
        setAuthBusy(false);
      }
    },
    [clearAuthError, confirmResetCmd],
  );

  const goAfterLogin = useCallback((where: 'home' | 'buy' | 'help' = 'home') => {
    if (where === 'buy') router.replace('/People');
    else if (where === 'help') router.replace('/MoreHelp');
    else router.replace('/Main');
  }, []);

  return {
    backend: true as const,
    onLogin,
    goAfterLogin,
    loginError,
    loginBusy,
    clearLoginError: () => setLoginError(null),
    authError,
    authErrorCode,
    authBusy,
    clearAuthError,
    onRequestPhoneOtp,
    onResumeIncompleteSignup,
    onVerifyPhoneOtp,
    onRegister,
    onVerifyEmailOtp,
    onResendEmailOtp,
    onRequestPasswordReset,
    onConfirmPasswordReset,
  };
}
