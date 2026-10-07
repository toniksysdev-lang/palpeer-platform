import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View, type TextInput } from 'react-native';

import { PalpeerLogo } from '@/components/brand/PalpeerLogo';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextLink } from '@/components/ui/TextLink';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useTheme } from '@/providers/ThemeProvider';
import { useSecretCommand } from '@/hooks/useSecretCommand';
import { accountCommands } from '@/services/auth/accountCommands';

import { AuthLayout } from '../components/AuthLayout';
import { LegalAgreement } from '../components/LegalAgreement';
import { applyServerErrors } from '../errors';
import { registerSchema, type RegisterForm } from '../schemas';

export function RegisterScreen() {
  useSensitiveScreen();
  const theme = useTheme();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = typeof params.phone === 'string' ? params.phone.trim() : '';
  const [register] = useSecretCommand(accountCommands.register);
  const [formError, setFormError] = useState<string | null>(null);
  const usernameRef = useRef<TextInput>(null);
  const referralRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      username: '',
      referralCode: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!phone) {
      setFormError('Start again from your phone number so we can create your account.');
      return;
    }
    try {
      const result = await register({
        email: values.email.trim(),
        phone,
        password: values.password,
      });
      router.replace({
        pathname: '/verify-email',
        params: {
          email: result.email,
          ...(result.debugOtp ? { otp: result.debugOtp } : {}),
        },
      });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'password']));
    }
  });

  if (!phone) {
    return (
      <AuthLayout title="Create your account" centered>
        <FormAlert message="Start with your phone number to create an account." />
        <Button
          label="Enter phone number"
          shape="pill"
          onPress={() => router.replace('/enter-phone')}
          testID="register-go-phone"
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      centered
      header={
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.md }}>
          <PalpeerLogo width={150} />
        </View>
      }
      footer={
        <View style={{ gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs }}>
            <AppText tone="secondary">Already have an account?</AppText>
            <TextLink label="Login" tone="info" onPress={() => router.replace('/login')} testID="go-login" />
          </View>
          <LegalAgreement prefix="By signing up you agree to our" testID="register-legal" />
        </View>
      }
    >
      <FormAlert message={formError} testID="register-error" />

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Input
            label="Email"
            placeholder="Email"
            appearance="elevated"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => usernameRef.current?.focus()}
            left={<Icon icon={Mail} size="md" color={theme.colors.textMuted} />}
            testID="register-email"
          />
        )}
      />
      <Controller
        control={control}
        name="username"
        render={({ field, fieldState }) => (
          <Input
            ref={usernameRef}
            label="Username"
            placeholder="Enter unique username"
            appearance="elevated"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => referralRef.current?.focus()}
            testID="register-username"
          />
        )}
      />
      <Controller
        control={control}
        name="referralCode"
        render={({ field, fieldState }) => (
          <Input
            ref={referralRef}
            label="Referral Code"
            placeholder="Optional"
            appearance="elevated"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            testID="register-referral"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordInput
            ref={passwordRef}
            label="Create password"
            placeholder="Password"
            appearance="elevated"
            left={<Icon icon={Lock} size="md" color={theme.colors.textMuted} />}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            testID="register-password"
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field, fieldState }) => (
          <PasswordInput
            ref={confirmRef}
            label="Confirm password"
            placeholder="Confirm password"
            appearance="elevated"
            left={<Icon icon={Lock} size="md" color={theme.colors.textMuted} />}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            testID="register-confirm"
          />
        )}
      />
      <Button
        label="Sign up"
        loadingLabel="Creating account…"
        shape="pill"
        onPress={onSubmit}
        loading={isSubmitting}
        testID="register-submit"
      />
    </AuthLayout>
  );
}
