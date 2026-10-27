import { zodResolver } from '@hookform/resolvers/zod';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View, type TextInput } from 'react-native';

import { PalpeerLogo } from '@/components/brand/PalpeerLogo';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TextLink } from '@/components/ui/TextLink';
import { REFERRAL_CODE_MAX, normalizeReferralCode } from '@/features/promotions/logic';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useTheme } from '@/providers/ThemeProvider';
import { useSecretCommand } from '@/hooks/useSecretCommand';
import { accountCommands } from '@/services/auth/accountCommands';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { referralStorage } from '@/services/storage/referralStorage';
import { signupDraftStorage } from '@/services/storage/signupDraftStorage';

import { AuthLayout } from '../components/AuthLayout';
import { LegalAgreement } from '../components/LegalAgreement';
import { applyServerErrors } from '../errors';
import { registerSchema, type RegisterForm } from '../schemas';

export function RegisterScreen() {
  useSensitiveScreen();
  const theme = useTheme();
  const numberPad = useOptionalNumberPad();
  const params = useLocalSearchParams<{ phone?: string; countryIso2?: string }>();
  const phone = typeof params.phone === 'string' ? params.phone.trim() : '';
  const countryIso2Param =
    typeof params.countryIso2 === 'string' ? params.countryIso2.trim().toUpperCase() : '';
  const [countryIso2, setCountryIso2] = useState(countryIso2Param);
  const [register] = useSecretCommand(accountCommands.register);
  const [formError, setFormError] = useState<string | null>(null);

  // Keep phone-signup country through account creation so profile can default residence.
  useEffect(() => {
    if (countryIso2Param.length === 2) {
      setCountryIso2(countryIso2Param);
      void preferencesStorage.setSignupCountryIso2(countryIso2Param);
      return;
    }
    void (async () => {
      const fromPref = await preferencesStorage.getSignupCountryIso2();
      if (fromPref) {
        setCountryIso2(fromPref);
        return;
      }
      const draft = await signupDraftStorage.load();
      const fromDraft = draft?.countryIso2?.trim().toUpperCase() ?? '';
      if (fromDraft.length === 2) {
        setCountryIso2(fromDraft);
        await preferencesStorage.setSignupCountryIso2(fromDraft);
      }
    })();
  }, [countryIso2Param]);

  // Account form has no digit fields; dismiss pad left open by prior OTP/phone screens.
  useFocusEffect(
    useCallback(() => {
      numberPad?.close();
    }, [numberPad]),
  );
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
        username: values.username.trim(),
        phone,
        password: values.password,
      });
      // Register has no referral field on the API — apply after the user signs in.
      await referralStorage.save(normalizeReferralCode(values.referralCode ?? ''));
      if (countryIso2.length === 2) {
        await preferencesStorage.setSignupCountryIso2(countryIso2);
      }
      await signupDraftStorage.save({
        phone,
        email: result.email,
        countryIso2: countryIso2.length === 2 ? countryIso2 : null,
        step: 'EMAIL_OTP',
      });
      router.replace({
        pathname: '/verify-email',
        params: {
          email: result.email,
          phone,
          ...(countryIso2.length === 2 ? { countryIso2 } : null),
        },
      });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'username', 'password']));
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
            onChangeText={(value) => field.onChange(value.replace(/\s+/g, ''))}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
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
            onChangeText={(value) => field.onChange(normalizeReferralCode(value))}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={REFERRAL_CODE_MAX}
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
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs }}>
        <AppText tone="secondary">Already have an account?</AppText>
        <TextLink label="Login" tone="info" onPress={() => router.replace('/login')} testID="go-login" />
      </View>
      <LegalAgreement prefix="By signing up you agree to our" testID="register-legal" />
    </AuthLayout>
  );
}
