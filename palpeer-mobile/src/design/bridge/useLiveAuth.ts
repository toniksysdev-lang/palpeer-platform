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
import type { OtpResendResponse } from '@/types/api/auth';

type OkErr = { ok: true } | { ok: false; error: string };

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
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const fail = (error: unknown): OkErr => {
    const msg = authErrorMessage(toAppError(error));
    setAuthError(msg);
    return { ok: false, error: msg };
  };

  const onLogin = useCallback(
    async (who: string, pass: string) => {
      const identifier = who.trim();
      setLoginError(null);
      setLoginBusy(true);
      try {
        const tokens = await loginCmd({ email: identifier, password: pass });
        const sessionEmail = identifier.includes('@') ? identifier.toLowerCase() : null;
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
      setAuthError(null);
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
    [phoneE164],
  );

  const onVerifyPhoneOtp = useCallback(
    async (nationalPhone: string, code: string, dialCode = '+1'): Promise<OkErr> => {
      setAuthError(null);
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
    [phoneE164],
  );

  const onRegister = useCallback(
    async (input: {
      email: string;
      username: string;
      password: string;
      nationalPhone: string;
      dialCode?: string;
    }): Promise<OkErr> => {
      setAuthError(null);
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
    [phoneE164, registerCmd],
  );

  const onVerifyEmailOtp = useCallback(
    async (email: string, code: string): Promise<OkErr> => {
      setAuthError(null);
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
    [verifyOtpCmd],
  );

  const onResendEmailOtp = useCallback(
    async (phoneNational: string, dialCode = '+1'): Promise<OkErr> => {
      setAuthError(null);
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
    [phoneE164, resendSignupEmail],
  );

  const onRequestPasswordReset = useCallback(
    async (email: string): Promise<OkErr> => {
      setAuthError(null);
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
    [requestPasswordReset],
  );

  const onConfirmPasswordReset = useCallback(
    async (email: string, code: string, newPassword: string): Promise<OkErr> => {
      setAuthError(null);
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
    [confirmResetCmd],
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
    authBusy,
    clearAuthError: () => setAuthError(null),
    onRequestPhoneOtp,
    onVerifyPhoneOtp,
    onRegister,
    onVerifyEmailOtp,
    onResendEmailOtp,
    onRequestPasswordReset,
    onConfirmPasswordReset,
  };
}
