import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { TextInput } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { applyServerErrors } from '@/features/auth/errors';
import { changePasswordSchema, type ChangePasswordForm } from '@/features/auth/schemas';
import { accountCommands } from '@/services/auth/accountCommands';
import { sessionManager } from '@/services/auth/session';

/**
 * The backend revokes every refresh token on success, including this phone's, so the app signs out
 * and the login screen explains why (R-A-8).
 */
export function ChangePasswordScreen() {
  useSensitiveScreen();
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaving(true);
    const result = await accountCommands.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    if (!result.ok) {
      setSaving(false);
      setFormError(applyServerErrors(result.error, setError, ['currentPassword', 'newPassword']));
      return;
    }
    await sessionManager.signOut('passwordChanged');
  });

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label="Change password"
          loadingLabel="Updating…"
          onPress={onSubmit}
          loading={saving || isSubmitting}
          testID="password-submit"
        />
      }
    >
      <StackHeader title="Change password" />
      <AppText tone="secondary">
        After changing your password you&apos;ll be signed out on every device, including this one.
        Sign in again with your new password.
      </AppText>
      <FormAlert message={formError} testID="password-error" />

      <Controller
        control={control}
        name="currentPassword"
        render={({ field, fieldState }) => (
          <PasswordInput
            label="Current password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
            onSubmitEditing={() => newRef.current?.focus()}
            testID="password-current"
          />
        )}
      />
      <Controller
        control={control}
        name="newPassword"
        render={({ field, fieldState }) => (
          <PasswordInput
            ref={newRef}
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
            testID="password-new"
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
            testID="password-confirm"
          />
        )}
      />
    </Screen>
  );
}
