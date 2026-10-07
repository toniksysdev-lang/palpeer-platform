import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { FormAlert } from '@/components/feedback/FormAlert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRequestPasswordResetMutation } from '@/services/api/authApi';

import { AuthLayout } from '../components/AuthLayout';
import { applyServerErrors } from '../errors';
import { forgotPasswordSchema, type ForgotPasswordForm } from '../schemas';

export function ForgotPasswordScreen() {
  const [requestReset, { isLoading }] = useRequestPasswordResetMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const email = values.email.trim();
    try {
      await requestReset({ email }).unwrap();
      router.push({ pathname: '/reset-password', params: { email } });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email']));
    }
  });

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send you a 6-digit reset code."
    >
      <FormAlert message={formError} testID="forgot-error" />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Input
            label="Email address"
            placeholder="you@example.com"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={onSubmit}
            testID="forgot-email"
          />
        )}
      />
      <Button
        label="Send reset code"
        loadingLabel="Sending…"
        onPress={onSubmit}
        loading={isLoading || isSubmitting}
        testID="forgot-submit"
      />
    </AuthLayout>
  );
}
