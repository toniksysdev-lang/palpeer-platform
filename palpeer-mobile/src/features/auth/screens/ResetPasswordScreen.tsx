import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { FormAlert } from '@/components/feedback/FormAlert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextLink } from '@/components/ui/TextLink';
import { useToast } from '@/providers/ToastProvider';
import { useResendOtpMutation } from '@/services/api/authApi';
import { toAppError } from '@/services/api/errors';

import { AuthLayout } from '../components/AuthLayout';
import { authErrorMessage } from '../errors';
import { OTP_LENGTH, otpSchema } from '../schemas';
import { useResendCooldown } from '../useResendCooldown';

type CheckCodeForm = z.infer<typeof otpSchema>;

/** Password reset step 2 — check email / enter the 6-digit code (one field). */
export function ResetPasswordScreen() {
  const toast = useToast();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const [resendOtp, { isLoading: resending }] = useResendOtpMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const cooldown = useResendCooldown(45);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<CheckCodeForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    router.push({
      pathname: '/make-new-password',
      params: { email, code: values.code },
    });
  });

  const resend = async () => {
    setFormError(null);
    try {
      await resendOtp({
        email,
        purpose: 'PASSWORD_RESET',
        channel: 'EMAIL',
      }).unwrap();
      setValue('code', '');
      cooldown.restart();
      toast.show({ type: 'success', title: 'New code sent' });
    } catch (raw) {
      setFormError(authErrorMessage(toAppError(raw)));
    }
  };

  if (!email) {
    return (
      <AuthLayout title="Reset link incomplete">
        <FormAlert message="Start the password reset again so we know which account to update." />
        <Button label="I forgot my password" onPress={() => router.replace('/forgot-password')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Check my email" subtitle={`If ${email} has an account, a code is coming. It ends in 10 minutes.`}>
      <FormAlert message={formError} testID="reset-error" />

      <Controller
        control={control}
        name="code"
        render={({ field, fieldState }) => (
          <Input
            label="Code"
            placeholder={`${OTP_LENGTH} numbers`}
            value={field.value}
            onChangeText={(text) => field.onChange(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            numberPad="digits"
            numberPadMaxLength={OTP_LENGTH}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={OTP_LENGTH}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            testID="reset-code"
          />
        )}
      />
      <View style={{ alignItems: 'center' }}>
        <TextLink
          label={cooldown.canResend ? 'Send code again' : `Send code again (${cooldown.remaining}s)`}
          onPress={resend}
          disabled={!cooldown.canResend || resending}
          testID="reset-resend"
        />
      </View>
      <Button
        label="Continue"
        loadingLabel="Checking…"
        onPress={onSubmit}
        loading={isSubmitting}
        testID="reset-submit"
      />
    </AuthLayout>
  );
}
