import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Fingerprint, Lock, Mail } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { checkDeviceTrust } from '@/features/security/biometricUnlock';
import { useSecretCommand } from '@/hooks/useSecretCommand';
import { useSensitiveScreen } from '@/hooks/useSensitiveScreen';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useGetSignupStatusMutation, useResendSignupEmailOtpMutation } from '@/services/api/authApi';
import { toAppError } from '@/services/api/errors';
import { accountCommands } from '@/services/auth/accountCommands';
import { sessionManager } from '@/services/auth/session';
import {
  authenticateWithBiometrics,
  getBiometricCapability,
} from '@/services/biometrics/biometrics';
import { secureStorage } from '@/services/storage/secureStorage';
import { useAppDispatch, useAppSelector } from '@/store';
import { appUnlocked, biometricChanged } from '@/store/slices/appLockSlice';
import {
  expiredNoticeDismissed,
  sessionStarted,
  type SignOutReason,
} from '@/store/slices/sessionSlice';

import { AuthLayout } from '../components/AuthLayout';
import { GoogleSignInSection } from '../components/GoogleSignInSection';
import { applyServerErrors, authErrorMessage } from '../errors';
import { loginSchema, type LoginForm } from '../schemas';

const NOTICES: Record<string, string> = {
  verified: 'Your account is ready. Sign in to continue.',
  exists: 'An account already exists for this phone. Sign in to continue.',
  reset: 'Your password was reset. Sign in with your new password.',
};

const SIGN_OUT_NOTICES: Record<SignOutReason, string> = {
  passwordChanged:
    'Your password was changed and you were signed out everywhere. Sign in with your new password.',
  allSessionsEnded: 'You were signed out on all devices.',
  sessionEnded:
    'This session ended — your account may have been signed in on another device. Sign in to continue.',
};

export function LoginScreen() {
  useSensitiveScreen();
  const theme = useTheme();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const expiredNotice = useAppSelector((state) => state.session.expiredNotice);
  const signOutReason = useAppSelector((state) => state.session.signOutReason);
  const [login] = useSecretCommand(accountCommands.login);
  const [getSignupStatus] = useGetSignupStatusMutation();
  const [resendSignupEmailOtp] = useResendSignupEmailOtpMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: typeof params.email === 'string' ? params.email : '', password: '' },
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      const [stored, biometricUserId, capability] = await Promise.all([
        secureStorage.loadSession(),
        secureStorage.getBiometricUserId(),
        getBiometricCapability(),
      ]);
      if (!active) return;
      const eligible =
        !!stored &&
        biometricUserId === stored.userId &&
        capability.status === 'available';
      if (!eligible) {
        setBiometricLabel(null);
        return;
      }
      setBiometricLabel(capability.label);
      if (stored.email && !(typeof params.email === 'string' && params.email)) {
        setValue('email', stored.email);
      }
    })();
    return () => {
      active = false;
    };
  }, [params.email, setValue]);

  const loginWithBiometrics = useCallback(async () => {
    if (!biometricLabel || biometricBusy) return;
    setBiometricBusy(true);
    setFormError(null);
    const result = await authenticateWithBiometrics(`Sign in to PALPEER with ${biometricLabel}`);
    if (result !== 'success') {
      setBiometricBusy(false);
      if (result === 'lockout') {
        setFormError('Biometrics are locked after too many attempts. Sign in with your password.');
      } else if (result === 'unavailable') {
        setFormError(`${biometricLabel} isn't available right now. Sign in with your password.`);
      } else if (result === 'failed') {
        setFormError("We couldn't confirm it's you. Try again or sign in with your password.");
      }
      return;
    }

    const trust = await checkDeviceTrust();
    if (trust === 'revoked') {
      await secureStorage.setBiometricUserId(null);
      await secureStorage.clearSession();
      setBiometricLabel(null);
      setBiometricBusy(false);
      toast.show({
        type: 'warning',
        title: 'Biometric unlock was turned off for this device',
        message: 'Sign in with your password to continue.',
      });
      return;
    }

    const stored = await secureStorage.loadSession();
    const outcome = await sessionManager.restore();
    if (outcome !== 'authenticated' || !stored) {
      setBiometricBusy(false);
      setFormError('Your saved session expired. Sign in with your password.');
      setBiometricLabel(null);
      return;
    }

    dispatch(sessionStarted({ userId: stored.userId, email: stored.email }));
    dispatch(biometricChanged(true));
    dispatch(appUnlocked());
    setBiometricBusy(false);
  }, [biometricBusy, biometricLabel, dispatch, toast]);

  const continueEmailVerification = async (identifier: string) => {
    const looksLikeEmail = identifier.includes('@');
    let email = looksLikeEmail ? identifier.toLowerCase() : '';
    let phone = looksLikeEmail ? '' : identifier;

    if (!looksLikeEmail) {
      try {
        const status = await getSignupStatus({ phone: identifier }).unwrap();
        if (status.email) email = status.email;
        phone = status.phone || identifier;
        try {
          await resendSignupEmailOtp({ phone }).unwrap();
        } catch {
          // Verify screen still lets them resend.
        }
      } catch (raw) {
        setFormError(authErrorMessage(toAppError(raw)));
        return;
      }
    }

    if (!email) {
      setFormError('Verify your email before signing in. Use the email you registered with.');
      return;
    }

    toast.show({
      type: 'info',
      title: 'Verify your email to continue',
      message: 'Enter the code we sent, then sign in again.',
    });
    router.push({
      pathname: '/verify-email',
      params: {
        email,
        ...(phone ? { phone } : null),
        resume: '1',
      },
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const identifier = values.email.trim();
    try {
      const tokens = await login({ email: identifier, password: values.password });
      const sessionEmail = identifier.includes('@') ? identifier.toLowerCase() : null;
      await sessionManager.start(tokens, sessionEmail);
    } catch (error) {
      const appError = toAppError(error);
      if (appError.code === 'EMAIL_NOT_VERIFIED') {
        await continueEmailVerification(identifier);
        return;
      }
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
          <PalpeerLogo width={180} />
        </View>
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
        disabled={biometricBusy}
        testID="login-submit"
      />
      {biometricLabel ? (
        <Button
          label={`Login with ${biometricLabel}`}
          leftIcon={Fingerprint}
          variant="primaryOutline"
          shape="pill"
          onPress={() => void loginWithBiometrics()}
          loading={biometricBusy}
          loadingLabel="Checking…"
          disabled={isSubmitting}
          testID="login-biometric"
        />
      ) : null}
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
      <TextLink
        label="Need help?"
        align="center"
        tone="info"
        onPress={() => router.push('/support')}
        testID="go-support"
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  signUp: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
