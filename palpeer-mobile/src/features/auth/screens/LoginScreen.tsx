import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Lock, Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInput } from 'react-native';

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
import { sessionManager } from '@/services/auth/session';
import { useAppDispatch, useAppSelector } from '@/store';
import { expiredNoticeDismissed, type SignOutReason } from '@/store/slices/sessionSlice';

import { AuthLayout } from '../components/AuthLayout';
import { GoogleSignInSection } from '../components/GoogleSignInSection';
import { applyServerErrors } from '../errors';
import { loginSchema, type LoginForm } from '../schemas';

const NOTICES: Record<string, string> = {
  verified: 'Your account is ready. Sign in to continue.',
  reset: 'Your password was reset. Sign in with your new password.',
};

const SIGN_OUT_NOTICES: Record<SignOutReason, string> = {
  passwordChanged:
    'Your password was changed and you were signed out everywhere. Sign in with your new password.',
  allSessionsEnded: 'You were signed out on all devices.',
  sessionEnded: 'This session was ended. Sign in to continue.',
};

export function LoginScreen() {
  useSensitiveScreen();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const expiredNotice = useAppSelector((state) => state.session.expiredNotice);
  const signOutReason = useAppSelector((state) => state.session.signOutReason);
  const [login] = useSecretCommand(accountCommands.login);
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: typeof params.email === 'string' ? params.email : '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const identifier = values.email.trim();
    try {
      const tokens = await login({ email: identifier, password: values.password });
      const sessionEmail = identifier.includes('@') ? identifier.toLowerCase() : null;
      await sessionManager.start(tokens, sessionEmail);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'password']));
    }
  });

  const notice =
    typeof params.notice === 'string' && NOTICES[params.notice]
      ? NOTICES[params.notice]
      : signOutReason
        ? SIGN_OUT_NOTICES[signOutReason]
        : null;

  return (
    <AuthLayout
      title="Login to your account"
      centered
      header={
        <View style={{ alignItems: 'center', marginBottom: theme.spacing.md }}>
          <PalpeerLogo width={150} />
        </View>
      }
      footer={
        <TextLink
          label="Need help?"
          align="center"
          tone="info"
          onPress={() => router.push('/support')}
          testID="go-support"
        />
      }
    >
      {expiredNotice ? (
        <FormAlert tone="warning" message="Your session has expired. Please sign in again." />
      ) : null}
      {notice ? <FormAlert tone="success" message={notice} /> : null}
      <FormAlert message={formError} testID="login-error" />

      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <Input
            label="Email or phone"
            placeholder="Email or phone number"
            appearance="elevated"
            value={field.value}
            onChangeText={(text) => {
              field.onChange(text);
              if (expiredNotice) dispatch(expiredNoticeDismissed());
            }}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            left={<Icon icon={Mail} size="md" color={theme.colors.textMuted} />}
            testID="login-email"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordInput
            ref={passwordRef}
            label="Password"
            placeholder="Password"
            appearance="elevated"
            left={<Icon icon={Lock} size="md" color={theme.colors.textMuted} />}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            testID="login-password"
          />
        )}
      />
      <TextLink
        label="Forgot Password?"
        align="right"
        tone="info"
        onPress={() => router.push('/forgot-password')}
        testID="go-forgot-password"
      />
      <Button
        label="Login"
        loadingLabel="Signing in…"
        shape="pill"
        onPress={onSubmit}
        loading={isSubmitting}
        testID="login-submit"
      />
      <GoogleSignInSection />
      <View style={styles.signUp}>
        <AppText>Don&apos;t have an account? </AppText>
        <TextLink
          label="Sign up"
          tone="info"
          onPress={() => router.push('/enter-phone')}
          testID="go-register"
        />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  signUp: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
