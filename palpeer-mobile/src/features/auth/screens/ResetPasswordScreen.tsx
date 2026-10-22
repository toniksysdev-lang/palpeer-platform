import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View, type TextInput } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextLink } from '@/components/ui/TextLink';
import { useSecretCommand } from '@/hooks/useSecretCommand';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useResendOtpMutation } from '@/services/api/authApi';
import { toAppError } from '@/services/api/errors';
import { accountCommands } from '@/services/auth/accountCommands';

import { AuthLayout } from '../components/AuthLayout';
import { applyServerErrors, authErrorMessage } from '../errors';
import { resetPasswordSchema, type ResetPasswordForm } from '../schemas';
import { useResendCooldown } from '../useResendCooldown';

export function ResetPasswordScreen() {
  useSensitiveScreen();
  const theme = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{ email?: string; debugOtp?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const initialDebugOtp =
    typeof params.debugOtp === 'string' && params.debugOtp.length > 0 ? params.debugOtp : null;
  const [debugOtp, setDebugOtp] = useState<string | null>(initialDebugOtp);
  const [confirmReset] = useSecretCommand(accountCommands.confirmPasswordReset);
  const [resendOtp, { isLoading: resending }] = useResendOtpMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const cooldown = useResendCooldown(60);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await confirmReset({ email, code: values.code, newPassword: values.newPassword });
      router.replace({ pathname: '/login', params: { email, notice: 'reset' } });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['code', 'newPassword']));
    }
  });

  const resend = async () => {
    setFormError(null);
    try {
      const result = await resendOtp({
        email,
        purpose: 'PASSWORD_RESET',
        channel: 'EMAIL',
      }).unwrap();
      setValue('code', '');
      const nextDebug =
        typeof result?.debugOtp === 'string' && result.debugOtp.length > 0
          ? result.debugOtp
          : null;
      setDebugOtp(nextDebug);
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
        <Button label="Reset password" onPress={() => router.replace('/forgot-password')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Use the 6-digit code from your email, then choose a new password."
    >
      <FormAlert
        tone="info"
        message={`If an account exists for ${email}, a reset code is on its way. It expires in 10 minutes.`}
      />
      {__DEV__ && debugOtp ? (
        <FormAlert
          tone="info"
          message={`Dev reset code: ${debugOtp}`}
          testID="reset-debug-otp"
        />
      ) : null}
      <FormAlert message={formError} testID="reset-error" />

      <Controller
        control={control}
        name="code"
        render={({ field, fieldState }) => (
          <OtpInput
            value={field.value}
            onChangeText={field.onChange}
            onComplete={() => passwordRef.current?.focus()}
            error={fieldState.error?.message}
            testID="reset-code"
          />
        )}
      />
      <View style={{ alignItems: 'center' }}>
        <TextLink
          label={cooldown.canResend ? 'Send a new code' : `Resend in ${cooldown.remaining}s`}
          onPress={resend}
          disabled={!cooldown.canResend || resending}
          testID="reset-resend"
        />
      </View>

      <Controller
        control={control}
        name="newPassword"
        render={({ field, fieldState }) => (
          <PasswordInput
            ref={passwordRef}
            label="New password"
            placeholder="At least 8 characters"
            hint="8 to 128 characters."
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            testID="reset-password"
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field, fieldState }) => (
          <PasswordInput
            ref={confirmRef}
            label="Confirm new password"
            placeholder="Re-enter your new password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            testID="reset-confirm"
          />
        )}
      />
      <AppText variant="caption" tone="muted">
        Resetting your password signs you out on all devices.
      </AppText>
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label="Reset password"
          loadingLabel="Resetting…"
          onPress={onSubmit}
          loading={isSubmitting}
          testID="reset-submit"
        />
      </View>
    </AuthLayout>
  );
}
