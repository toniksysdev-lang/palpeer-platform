import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useNumberPadField, useOptionalNumberPad } from '@/components/ui/NumberPadContext';
import { useTheme } from '@/providers/ThemeProvider';

import { AuthLayout } from '../components/AuthLayout';
import { LegalAgreement } from '../components/LegalAgreement';
import {
  DEFAULT_SIGNUP_COUNTRY,
  SIGNUP_COUNTRIES,
  digitsOnly,
  toE164,
  type SignupCountry,
} from '../signupCountries';

const PHONE_MAX_DIGITS = 10;

export function EnterPhoneScreen() {
  const theme = useTheme();
  const [country, setCountry] = useState<SignupCountry>(DEFAULT_SIGNUP_COUNTRY);
  const [national, setNational] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const setDigits = useCallback((next: string) => {
    setNational(digitsOnly(next).slice(0, PHONE_MAX_DIGITS));
    setError(null);
  }, []);

  const { select, active } = useNumberPadField({
    value: national,
    onChange: setDigits,
    maxLength: PHONE_MAX_DIGITS,
    bottomLeft: '.',
    variant: 'phone',
    autoFocus: true,
  });
  const pad = useOptionalNumberPad();

  const continueSignup = () => {
    const local = digitsOnly(national);
    if (local.length < 7) {
      setError('Enter a valid phone number');
      return;
    }
    setError(null);
    // Hide the dialer before leaving so it does not flash on the next screen.
    pad?.close();
    const phone = toE164(country.dialCode, local);
    router.push({ pathname: '/verify-phone', params: { phone, signup: '1' } });
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
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Country code ${country.dialCode}`}
          testID="enter-phone-country"
          style={[
            styles.country,
            theme.shadows.card,
            {
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: theme.spacing.md,
              minHeight: 56,
              gap: theme.spacing.xs,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: 'transparent',
            },
          ]}
        >
          <AppText variant="h3">{country.flag}</AppText>
          <AppText variant="bodyStrong">{country.dialCode}</AppText>
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
            {national || 'Phone number'}
          </AppText>
        </Pressable>
      </View>

      <Button
        label="Continue"
        shape="pill"
        onPress={continueSignup}
        testID="enter-phone-continue"
      />

      <BottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Select country"
        testID="enter-phone-country-sheet"
      >
        <View style={{ gap: theme.spacing.xs, paddingBottom: theme.spacing.lg }}>
          {SIGNUP_COUNTRIES.map((item) => (
            <Pressable
              key={item.iso2}
              onPress={() => {
                setCountry(item);
                setPickerOpen(false);
                select();
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
                  item.iso2 === country.iso2 ? theme.colors.primarySoft : 'transparent',
              }}
            >
              <AppText variant="h3">{item.flag}</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{item.name}</AppText>
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
