import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { TextLink } from '@/components/ui/TextLink';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useSecretCommand } from '@/hooks/useSecretCommand';
import { useResendOtpMutation } from '@/services/api/authApi';
import { toAppError } from '@/services/api/errors';
import { accountCommands } from '@/services/auth/accountCommands';

import { AuthLayout } from '../components/AuthLayout';
import { authErrorMessage } from '../errors';
import { OTP_LENGTH } from '../schemas';
import { maskEmail, maskPhone } from '../signupCountries';
import { useResendCooldown } from '../useResendCooldown';

type Props = {
  purpose: 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION';
};

const CODE_ERRORS = new Set([
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_MAX_ATTEMPTS',
  'OTP_NOT_FOUND',
  'OTP_CHANNEL_MISMATCH',
]);

/** Pre-registration phone step has no SMS yet — any 6-digit code continues; autofill this one. */
const PHONE_SIGNUP_OTP = '123456';

function sanitizeOtp(raw: string | undefined): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

/**
 * Signup order: phone entry → phone OTP (client gate; SMS provider pending) → create account →
 * email OTP (real). Email OTP is autofilled when the API returns `debugOtp` (OTP_LOG_CODE).
 */
export function VerifyOtpScreen({ purpose }: Props) {
  useSensitiveScreen();
  const theme = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{
    email?: string;
    phone?: string;
    signup?: string;
    otp?: string;
  }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const phone = typeof params.phone === 'string' ? params.phone : '';
  const isPhone = purpose === 'PHONE_VERIFICATION';
  const preRegisterPhone = isPhone && params.signup === '1' && phone.length > 0;
  const channel = isPhone ? 'SMS' : 'EMAIL';
  const initialOtp = preRegisterPhone
    ? PHONE_SIGNUP_OTP
    : sanitizeOtp(typeof params.otp === 'string' ? params.otp : undefined);

  const [code, setCode] = useState(initialOtp);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyOtp] = useSecretCommand(accountCommands.verifyOtp);
  const [resendOtp, { isLoading: resending }] = useResendOtpMutation();
  const cooldown = useResendCooldown(60);

  useEffect(() => {
    if (initialOtp.length === OTP_LENGTH) setCode(initialOtp);
  }, [initialOtp]);

  const goToLogin = () =>
    router.replace({ pathname: '/login', params: { email, notice: 'verified' } });

  const goToRegister = () =>
    router.push({ pathname: '/register', params: { phone } });

  const submit = async (value: string) => {
    if (value.length !== OTP_LENGTH || busy) return;
    setCodeError(null);
    setFormError(null);

    if (preRegisterPhone) {
      goToRegister();
      return;
    }

    if (!email) return;

    setBusy(true);
    try {
      await verifyOtp({ email, purpose, channel, code: value });
      if (isPhone) {
        goToLogin();
      } else {
        toast.show({ type: 'success', title: 'Email verified' });
        goToLogin();
      }
    } catch (raw) {
      const error = toAppError(raw);
      setCode('');
      if (error.code && CODE_ERRORS.has(error.code)) {
        setCodeError(authErrorMessage(error));
      } else {
        setFormError(authErrorMessage(error));
      }
      setBusy(false);
    }
  };

  const resend = async () => {
    setCodeError(null);
    setFormError(null);

    if (preRegisterPhone) {
      setCode(PHONE_SIGNUP_OTP);
      cooldown.restart();
      toast.show({
        type: 'info',
        title: 'SMS delivery isn’t available yet',
        message: 'Your code was filled in again. Continue, or skip and verify later.',
      });
      return;
    }

    try {
      const result = await resendOtp({ email, purpose, channel }).unwrap();
      const next = sanitizeOtp(result?.debugOtp ?? undefined);
      setCode(next.length === OTP_LENGTH ? next : '');
      cooldown.restart();
      toast.show({ type: 'success', title: 'New code sent' });
    } catch (raw) {
      setFormError(authErrorMessage(toAppError(raw)));
    }
  };

  if (preRegisterPhone) {
    return (
      <AuthLayout title="Verify phone" subtitle="Please verify your phone number" centered>
        <AppText tone="secondary" align="center">
          We have sent a {OTP_LENGTH}-digit verification code to {maskPhone(phone)}. Enter this
          code below.
        </AppText>
        <FormAlert
          tone="info"
          message="Text message delivery isn’t available yet. Your code is filled in — tap Submit to continue, or skip and verify later."
        />
        <FormAlert message={formError} testID="verify-error" />

        <OtpInput
          value={code}
          onChangeText={(value) => {
            setCode(value);
            if (codeError) setCodeError(null);
          }}
          onComplete={submit}
          error={codeError}
          editable={!busy}
          testID="verify-code"
        />

        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            <AppText tone="secondary">Didn&apos;t get the code? </AppText>
            <TextLink
              label={
                cooldown.canResend ? 'Resend code' : `Resend code (${cooldown.remaining}s)`
              }
              tone="info"
              onPress={resend}
              disabled={!cooldown.canResend || resending}
              testID="verify-resend"
            />
          </View>
        </View>

        <Button
          label="Submit"
          shape="pill"
          onPress={() => submit(code)}
          disabled={code.length !== OTP_LENGTH}
          testID="verify-submit"
        />
        <Button
          label="Skip for now"
          variant="ghost"
          onPress={goToRegister}
          testID="verify-skip"
        />
      </AuthLayout>
    );
  }

  if (!email) {
    return (
      <AuthLayout title="Verification link incomplete">
        <FormAlert message="We couldn't tell which account to verify. Please sign in or register again." />
        <Button label="Go to sign in" onPress={() => router.replace('/login')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={isPhone ? 'Verify phone' : 'Verify email'}
      subtitle={
        isPhone ? 'Please verify your phone number' : 'Please verify your email address'
      }
      centered
    >
      <AppText tone="secondary" align="center">
        {isPhone
          ? `We have sent a ${OTP_LENGTH}-digit verification code to the phone number on your account. Enter this code below.`
          : `We have sent a ${OTP_LENGTH}-digit verification code to ${maskEmail(email)}. Enter this code below.`}
      </AppText>
      {isPhone ? (
        <FormAlert
          tone="info"
          message="Text message delivery isn’t available yet, so you may not receive this code. You can skip this step and verify your phone later."
        />
      ) : null}
      <FormAlert message={formError} testID="verify-error" />

      <OtpInput
        value={code}
        onChangeText={(value) => {
          setCode(value);
          if (codeError) setCodeError(null);
        }}
        onComplete={submit}
        error={codeError}
        editable={!busy}
        testID="verify-code"
      />

      <View style={{ alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
          <AppText tone="secondary">Didn&apos;t get the code? </AppText>
          <TextLink
            label={
              cooldown.canResend ? 'Resend code' : `Resend code (${cooldown.remaining}s)`
            }
            tone="info"
            onPress={resend}
            disabled={!cooldown.canResend || resending}
            testID="verify-resend"
          />
        </View>
      </View>

      <Button
        label="Submit"
        loadingLabel="Verifying…"
        shape="pill"
        onPress={() => submit(code)}
        loading={busy}
        disabled={code.length !== OTP_LENGTH}
        testID="verify-submit"
      />

      {isPhone ? (
        <Button label="Skip for now" variant="ghost" onPress={goToLogin} testID="verify-skip" />
      ) : null}
    </AuthLayout>
  );
}
