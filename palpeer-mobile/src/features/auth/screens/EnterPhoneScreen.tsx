import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CountryFlag } from '@/components/brand/CountryFlag';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useNumberPadField, useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { useTheme } from '@/providers/ThemeProvider';
import {
  useGetRegistrationCountriesQuery,
  useRequestPhoneOtpMutation,
} from '@/services/api/authApi';
import { toAppError } from '@/services/api/errors';
import { preferencesStorage } from '@/services/storage/preferencesStorage';

import { AuthLayout } from '../components/AuthLayout';
import { LegalAgreement } from '../components/LegalAgreement';
import { authErrorMessage } from '../errors';
import {
  DEFAULT_SIGNUP_COUNTRY,
  SIGNUP_COUNTRIES,
  WORLD_COUNTRIES,
  digitsOnly,
  formatNationalPhone,
  toE164,
  type SignupCountry,
} from '../signupCountries';

const PHONE_MAX_DIGITS = 10;

/** Phone signup step — sends SMS OTP via the configured SMS provider, then opens verify. */
export function EnterPhoneScreen() {
  const theme = useTheme();
  const countriesQuery = useGetRegistrationCountriesQuery();
  const [requestPhoneOtp, requestState] = useRequestPhoneOtpMutation();
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

  const setDigits = useCallback((next: string) => {
    setNational(digitsOnly(next).slice(0, PHONE_MAX_DIGITS));
    setError(null);
  }, []);

  const { select, active } = useNumberPadField({
    value: national,
    onChange: setDigits,
    maxLength: PHONE_MAX_DIGITS,
    bottomLeft: '*',
    variant: 'phone',
    autoFocus: false,
  });
  const pad = useOptionalNumberPad();

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
      await requestPhoneOtp({ phone }).unwrap();
      // Seed Complete profile Country with the corridor chosen for SMS verification.
      await preferencesStorage.setSignupCountryIso2(activeCountry.iso2);
      router.push({
        pathname: '/verify-phone',
        params: { phone, signup: '1', countryIso2: activeCountry.iso2 },
      });
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

      <View style={[styles.row, { gap: theme.spacing.sm }]}>
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
          onPress={select}
          accessibilityRole="button"
          accessibilityLabel="Phone number"
          accessibilityState={{ selected: active }}
          testID="enter-phone-number"
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
          <AppText
            tone={national ? 'primary' : 'muted'}
            style={{ fontSize: theme.typography.body.fontSize }}
          >
            {national ? formatNationalPhone(national, activeCountry.iso2) : 'Phone number'}
          </AppText>
        </Pressable>
      </View>

      <Button
        label="Continue"
        shape="pill"
        onPress={() => void continueSignup()}
        loading={requestState.isLoading}
        loadingLabel="Sending code…"
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
