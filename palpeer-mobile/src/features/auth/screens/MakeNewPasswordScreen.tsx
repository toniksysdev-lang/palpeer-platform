import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View, type TextInput } from 'react-native';
import { z } from 'zod';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useSecretCommand } from '@/hooks/useSecretCommand';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useTheme } from '@/providers/ThemeProvider';
import { accountCommands } from '@/services/auth/accountCommands';

import { AuthLayout } from '../components/AuthLayout';
import { applyServerErrors } from '../errors';

const makeNewPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be 128 characters or fewer'),
    confirmPassword: z.string().min(1, 'Type it again'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type MakeNewPasswordForm = z.infer<typeof makeNewPasswordSchema>;

/** Password reset step 3 — set a new password, then return to Log in. */
export function MakeNewPasswordScreen() {
  useSensitiveScreen();
  const theme = useTheme();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const code = typeof params.code === 'string' ? params.code : '';
  const [confirmReset] = useSecretCommand(accountCommands.confirmPasswordReset);
  const [formError, setFormError] = useState<string | null>(null);
  const confirmRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<MakeNewPasswordForm>({
    resolver: zodResolver(makeNewPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await confirmReset({ email, code, newPassword: values.newPassword });
      router.replace({
        pathname: '/login',
        params: { email, notice: 'reset' },
      });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['newPassword']));
    }
  });

  if (!email || !code) {
    return (
      <AuthLayout title="Reset link incomplete">
        <FormAlert message="Start the password reset again so we know which account to update." />
        <Button label="I forgot my password" onPress={() => router.replace('/forgot-password')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Make a new password" subtitle="8 to 128 characters. Same rule as sign-up.">
      <FormAlert message={formError} testID="new-password-error" />
      <Controller
        control={control}
        name="newPassword"
        render={({ field, fieldState }) => (
          <PasswordInput
            label="New password"
            placeholder="Type a new password"
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
            label="Type it again"
            placeholder="Re-enter your new password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            testID="reset-confirm"
          />
        )}
      />
      <AppText variant="caption" tone="muted">
        I will be logged out on all my phones.
      </AppText>
      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label="Change my password"
          loadingLabel="Changing…"
          onPress={onSubmit}
          loading={isSubmitting}
          testID="new-password-submit"
        />
      </View>
    </AuthLayout>
  );
}
