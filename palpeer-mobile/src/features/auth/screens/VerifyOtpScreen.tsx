import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { OtpInput } from '@/components/ui/OtpInput';
import { TextLink } from '@/components/ui/TextLink';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useToast } from '@/providers/ToastProvider';
import { useSecretCommand } from '@/hooks/useSecretCommand';
import {
  useRequestPhoneOtpMutation,
  useResendOtpMutation,
  useVerifyPhoneOtpMutation,
} from '@/services/api/authApi';
import { toAppError } from '@/services/api/errors';
import { accountCommands } from '@/services/auth/accountCommands';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { signupDraftStorage } from '@/services/storage/signupDraftStorage';

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

/**
 * Signup order: phone entry → SMS OTP → create account → email OTP.
 * The code field is never autofilled — users enter the code from SMS/email.
 */
export function VerifyOtpScreen({ purpose }: Props) {
  useSensitiveScreen();
  const toast = useToast();
  const numberPad = useOptionalNumberPad();
  const params = useLocalSearchParams<{
    email?: string;
    phone?: string;
    signup?: string;
    countryIso2?: string;
  }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const phone = typeof params.phone === 'string' ? params.phone : '';
  const countryIso2 = typeof params.countryIso2 === 'string' ? params.countryIso2 : '';
  const isPhone = purpose === 'PHONE_VERIFICATION';
  const preRegisterPhone = isPhone && params.signup === '1' && phone.length > 0;
  const channel = isPhone ? 'SMS' : 'EMAIL';

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifyOtp] = useSecretCommand(accountCommands.verifyOtp);
  const [resendOtp, { isLoading: resending }] = useResendOtpMutation();
  const [requestPhoneOtp, requestPhoneState] = useRequestPhoneOtpMutation();
  const [verifyPhoneOtp] = useVerifyPhoneOtpMutation();
  const cooldown = useResendCooldown(60);

  const goToLogin = () =>
    router.replace({ pathname: '/login', params: { email, notice: 'verified' } });

  const goToRegister = () => {
    numberPad?.close();
    router.push({
      pathname: '/register',
      params: { phone, ...(countryIso2 ? { countryIso2 } : null) },
    });
  };

  const submit = async (value: string) => {
    if (value.length !== OTP_LENGTH || busy) return;
    setCodeError(null);
    setFormError(null);

    setBusy(true);
    try {
      if (preRegisterPhone) {
        await verifyPhoneOtp({ phone, code: value }).unwrap();
        if (countryIso2.length === 2) {
          await preferencesStorage.setSignupCountryIso2(countryIso2);
        }
        await signupDraftStorage.save({
          phone,
          countryIso2: countryIso2 || null,
          step: 'REGISTER',
        });
        toast.show({ type: 'success', title: 'Phone verified' });
        goToRegister();
        return;
      }

      if (!email) return;

      await verifyOtp({ email, purpose, channel, code: value });
      if (isPhone) {
        goToLogin();
      } else {
        const draft = await signupDraftStorage.load();
        const resolvedCountry =
          (countryIso2.length === 2 ? countryIso2 : null) ||
          draft?.countryIso2 ||
          (await preferencesStorage.getSignupCountryIso2());
        if (resolvedCountry) {
          await preferencesStorage.setSignupCountryIso2(resolvedCountry);
        }
        await signupDraftStorage.save({
          phone: phone || draft?.phone || undefined,
          email,
          countryIso2: resolvedCountry,
          step: 'LOGIN',
        });
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
      try {
        await requestPhoneOtp({ phone }).unwrap();
        setCode('');
        cooldown.restart();
        toast.show({ type: 'success', title: 'New code sent' });
      } catch (raw) {
        setFormError(authErrorMessage(toAppError(raw)));
      }
      return;
    }

    try {
      await resendOtp({ email, purpose, channel }).unwrap();
      setCode('');
      cooldown.restart();
      toast.show({ type: 'success', title: 'New code sent' });
    } catch (raw) {
      setFormError(authErrorMessage(toAppError(raw)));
    }
  };

  if (preRegisterPhone) {
    return (
      <AuthLayout title="Verify phone" subtitle="Enter the SMS code we sent you" centered>
        <AppText tone="secondary" align="center">
          We sent a {OTP_LENGTH}-digit SMS verification code to {maskPhone(phone)}. Enter it below
          to continue creating your account.
        </AppText>
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
              disabled={!cooldown.canResend || resending || requestPhoneState.isLoading}
              testID="verify-resend"
            />
          </View>
        </View>

        <Button
          label="Submit"
          shape="pill"
          onPress={() => void submit(code)}
          loading={busy}
          loadingLabel="Verifying…"
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
