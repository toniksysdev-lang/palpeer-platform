import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CountryFlag } from '@/components/brand/CountryFlag';
import { FormAlert } from '@/components/feedback/FormAlert';
import { useFocusAnchor } from '@/components/layout/FocusScroll';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useNumberPadField, useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { numberFieldTextInputProps, suppressSystemKeyboard } from '@/components/ui/numberFieldInput';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  useGetRegistrationCountriesQuery,
  useGetSignupStatusMutation,
  useRequestPhoneOtpMutation,
  useResendSignupEmailOtpMutation,
} from '@/services/api/authApi';
import { toAppError } from '@/services/api/errors';
import { preferencesStorage } from '@/services/storage/preferencesStorage';
import { signupDraftStorage } from '@/services/storage/signupDraftStorage';
import type { SignupStatusResponse } from '@/types/api/auth';

import { AuthLayout } from '../components/AuthLayout';
import { LegalAgreement } from '../components/LegalAgreement';
import { authErrorMessage } from '../errors';
import {
  DEFAULT_SIGNUP_COUNTRY,
  SIGNUP_COUNTRIES,
  WORLD_COUNTRIES,
  digitsOnly,
  formatNationalPhone,
  normalizeNationalPhoneInput,
  toE164,
  type SignupCountry,
} from '../signupCountries';

const PHONE_MAX_DIGITS = 10;

/** Phone signup step — resumes incomplete registration or sends a fresh SMS OTP. */
export function EnterPhoneScreen() {
  const theme = useTheme();
  const toast = useToast();
  const countriesQuery = useGetRegistrationCountriesQuery();
  const [getSignupStatus, statusState] = useGetSignupStatusMutation();
  const [requestPhoneOtp, requestState] = useRequestPhoneOtpMutation();
  const [resendSignupEmailOtp, resendEmailState] = useResendSignupEmailOtpMutation();
  const [country, setCountry] = useState<SignupCountry>(DEFAULT_SIGNUP_COUNTRY);
  const [national, setNational] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const allowedCountries = useMemo(() => {
    const enabled = new Set((countriesQuery.data ?? []).map((c) => c.toUpperCase()));
    if (enabled.size === 0) {
      return SIGNUP_COUNTRIES;
    }
    const filtered = WORLD_COUNTRIES.filter((c) => enabled.has(c.iso2));
    return filtered.length > 0 ? filtered : SIGNUP_COUNTRIES;
  }, [countriesQuery.data]);

  const activeCountry = useMemo(() => {
    const match = allowedCountries.find((c) => c.iso2 === country.iso2);
    return match ?? allowedCountries[0] ?? DEFAULT_SIGNUP_COUNTRY;
  }, [allowedCountries, country.iso2]);

  const phoneInputRef = useRef<TextInput>(null);

  const setDigits = useCallback(
    (next: string) => {
      setNational(
        normalizeNationalPhoneInput(next, activeCountry.dialCode, PHONE_MAX_DIGITS),
      );
      setError(null);
    },
    [activeCountry.dialCode],
  );

  const { select, active } = useNumberPadField({
    value: national,
    onChange: setDigits,
    maxLength: PHONE_MAX_DIGITS,
    bottomLeft: '*',
    variant: 'phone',
    autoFocus: false,
  });
  const pad = useOptionalNumberPad();
  const { ref: phoneAnchorRef, reveal: revealPhone } = useFocusAnchor();

  const focusPhoneField = () => {
    phoneInputRef.current?.focus();
    suppressSystemKeyboard();
    select();
    revealPhone();
  };

  const busy =
    statusState.isLoading || requestState.isLoading || resendEmailState.isLoading;

  const seedCountry = async () => {
    await preferencesStorage.setSignupCountryIso2(activeCountry.iso2);
  };

  const startFreshPhoneOtp = async (phone: string) => {
    await seedCountry();
    await requestPhoneOtp({ phone }).unwrap();
    await signupDraftStorage.save({
      phone,
      countryIso2: activeCountry.iso2,
      step: 'PHONE_OTP',
    });
    router.push({
      pathname: '/verify-phone',
      params: { phone, signup: '1', countryIso2: activeCountry.iso2 },
    });
  };

  const resumeFromStatus = async (status: SignupStatusResponse, phone: string) => {
    switch (status.nextStep) {
      case 'PHONE_OTP_REQUIRED': {
        await startFreshPhoneOtp(phone);
        return;
      }
      case 'REGISTER_REQUIRED': {
        await seedCountry();
        await signupDraftStorage.save({
          phone,
          countryIso2: activeCountry.iso2,
          step: 'REGISTER',
        });
        toast.show({ type: 'info', title: 'Continue creating your account' });
        router.push({
          pathname: '/register',
          params: { phone, countryIso2: activeCountry.iso2 },
        });
        return;
      }
      case 'EMAIL_OTP_REQUIRED': {
        await seedCountry();
        if (!status.email) {
          setError('We found your account, but email verification could not be resumed.');
          return;
        }
        try {
          await resendSignupEmailOtp({ phone }).unwrap();
        } catch {
          // Still open verify — user can tap Resend on that screen.
        }
        await signupDraftStorage.save({
          phone,
          email: status.email,
          maskedEmail: status.maskedEmail,
          countryIso2: activeCountry.iso2,
          step: 'EMAIL_OTP',
        });
        toast.show({
          type: 'info',
          title: status.maskedEmail
            ? `Continue verifying ${status.maskedEmail}`
            : 'Continue email verification',
        });
        router.push({
          pathname: '/verify-email',
          params: { email: status.email, phone, resume: '1' },
        });
        return;
      }
      case 'LOGIN_READY': {
        await seedCountry();
        await signupDraftStorage.save({
          phone,
          email: status.email,
          maskedEmail: status.maskedEmail,
          countryIso2: activeCountry.iso2,
          step: 'LOGIN',
        });
        toast.show({
          type: 'info',
          title: status.hasLoggedIn ? 'Account already exists — sign in' : 'Sign in to finish',
        });
        router.push({
          pathname: '/login',
          params: {
            email: status.email ?? phone,
            notice: status.hasLoggedIn ? 'exists' : 'verified',
          },
        });
        return;
      }
      case 'BLOCKED':
        setError('This account has been disabled. Please contact support.');
        return;
      default:
        setError('Could not continue with this phone number. Try again.');
    }
  };

  const continueSignup = async () => {
    const local = digitsOnly(national);
    if (local.length < 7) {
      setError('Enter a valid phone number');
      return;
    }
    setError(null);
    pad?.close();
    const phone = toE164(activeCountry.dialCode, local);
    try {
      let status: SignupStatusResponse;
      try {
        status = await getSignupStatus({ phone }).unwrap();
      } catch (statusError) {
        // Live APIs without the signup/status permit (or older builds) return empty 403 —
        // still send the SMS OTP so registration is not blocked.
        const err = toAppError(statusError);
        if (
          err.kind === 'forbidden' ||
          err.kind === 'unauthorized' ||
          err.kind === 'notFound' ||
          err.status === 403 ||
          err.status === 404
        ) {
          await startFreshPhoneOtp(phone);
          return;
        }
        throw statusError;
      }
      await resumeFromStatus(status, phone);
    } catch (raw) {
      setError(authErrorMessage(toAppError(raw)));
    }
  };

  const fieldBorder = error
    ? theme.colors.danger
    : active
      ? theme.colors.primary
      : 'transparent';

  return (
    <AuthLayout
      title="Enter Phone number"
      subtitle="We'll send you a verification code"
      centered
      header={<View style={{ height: theme.spacing.xxxl }} />}
      footer={<LegalAgreement />}
    >
      <FormAlert message={error} testID="enter-phone-error" />

      <View
        ref={phoneAnchorRef}
        collapsable={false}
        style={[styles.row, { gap: theme.spacing.sm }]}
      >
        <Pressable
          onPress={() => {
            pad?.close();
            setPickerOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Country ${activeCountry.name} ${activeCountry.dialCode}`}
          testID="enter-phone-country"
          style={[
            styles.country,
            theme.shadows.card,
            {
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: theme.spacing.md,
              minHeight: 56,
              gap: theme.spacing.sm,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: 'transparent',
            },
          ]}
        >
          <CountryFlag
            iso2={activeCountry.iso2}
            emoji={activeCountry.flag}
            size={32}
            style={{ backgroundColor: theme.colors.surfaceMuted }}
          />
          <AppText variant="bodyStrong">{activeCountry.dialCode}</AppText>
          <Icon icon={ChevronDown} size="sm" color={theme.colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={focusPhoneField}
          accessibilityRole="none"
          style={[
            styles.phone,
            theme.shadows.card,
            {
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: theme.spacing.md,
              minHeight: 56,
              justifyContent: 'center',
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: fieldBorder,
            },
          ]}
        >
          <TextInput
            ref={phoneInputRef}
            value={national ? formatNationalPhone(national, activeCountry.iso2) : ''}
            onChangeText={setDigits}
            onFocus={() => {
              suppressSystemKeyboard();
              select();
              revealPhone();
            }}
            placeholder="Phone number"
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.primary}
            textContentType="telephoneNumber"
            autoComplete="tel"
            importantForAutofill="yes"
            accessibilityLabel="Phone number"
            accessibilityState={{ selected: active }}
            testID="enter-phone-number"
            style={[
              theme.typography.body,
              {
                color: theme.colors.textPrimary,
                paddingVertical: 0,
                margin: 0,
                minHeight: 24,
              },
            ]}
            maxFontSizeMultiplier={1.6}
            {...numberFieldTextInputProps}
          />
        </Pressable>
      </View>

      <Button
        label="Continue"
        shape="pill"
        onPress={() => void continueSignup()}
        loading={busy}
        loadingLabel="Checking…"
        testID="enter-phone-continue"
      />

      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Select country"
        testID="enter-phone-country-sheet"
      >
        <View style={{ gap: theme.spacing.xs, paddingBottom: theme.spacing.lg }}>
          {allowedCountries.map((item) => (
            <Pressable
              key={item.iso2}
              onPress={() => {
                setCountry(item);
                setPickerOpen(false);
              }}
              accessibilityRole="button"
              testID={`enter-phone-country-${item.iso2}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.sm,
                borderRadius: theme.radius.md,
                backgroundColor:
                  item.iso2 === activeCountry.iso2 ? theme.colors.primarySoft : 'transparent',
              }}
            >
              <CountryFlag
                iso2={item.iso2}
                emoji={item.flag}
                size={40}
                style={{ backgroundColor: theme.colors.surfaceMuted }}
              />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{item.name}</AppText>
                <AppText variant="caption" tone="muted">
                  {item.iso2}
                </AppText>
              </View>
              <AppText tone="secondary">{item.dialCode}</AppText>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  country: { flexDirection: 'row', alignItems: 'center' },
  phone: { flex: 1 },
});
