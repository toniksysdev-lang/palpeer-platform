import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CountryFlag } from '@/components/brand/CountryFlag';
import { FormAlert } from '@/components/feedback/FormAlert';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextLink } from '@/components/ui/TextLink';
import { useEnsureProfile } from '@/features/profile/useEnsureProfile';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useGetRegistrationCountriesQuery } from '@/services/api/authApi';
import { useGetCurrenciesQuery } from '@/services/api/currencyApi';
import { toAppError } from '@/services/api/errors';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import { useCreateWalletMutation, useGetWalletsQuery } from '@/services/api/walletApi';

import { walletErrorMessage } from '../errors';
import { remainingRegistrationWalletOptions } from '../registrationCurrencies';

/**
 * Currencies from `GET /currencies`, limited to those for admin-enabled registration countries,
 * then hiding ones the user already holds (R-W-1).
 */
export function CreateWalletScreen() {
  const theme = useTheme();
  const toast = useToast();
  const currencies = useGetCurrenciesQuery();
  const wallets = useGetWalletsQuery();
  const registrationCountries = useGetRegistrationCountriesQuery();
  const { profile, loading: profileLoading, error: profileError, retry: retryProfile } =
    useEnsureProfile();
  const pinStatus = useGetPinStatusQuery();
  const { requestPin } = usePinPrompt();
  const [createWallet, createState] = useCreateWalletMutation();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const header = <StackHeader title="New wallet" />;
  const loadError =
    currencies.error ?? wallets.error ?? registrationCountries.error ?? profileError;

  if (loadError && !(currencies.data && wallets.data && registrationCountries.data && profile)) {
    return (
      <Screen>
        {header}
        <ErrorState
          error={toAppError(loadError)}
          onRetry={() => {
            void currencies.refetch();
            void wallets.refetch();
            void registrationCountries.refetch();
            retryProfile();
          }}
        />
      </Screen>
    );
  }

  if (!currencies.data || !wallets.data || !registrationCountries.data || profileLoading || !profile) {
    return (
      <Screen>
        {header}
        <Skeleton height={56} />
        <Skeleton height={56} />
      </Screen>
    );
  }

  const available = remainingRegistrationWalletOptions({
    registrationIso2: registrationCountries.data,
    platformCurrencyCodes: currencies.data.map((currency) => currency.code),
    heldCurrencyCodes: wallets.data.map((wallet) => wallet.currencyCode),
  });
  const selectedOption = available.find((option) => option.countryIso2 === selectedCountry) ?? null;
  const symbolFor = (code: string) =>
    currencies.data.find((currency) => currency.code.toUpperCase() === code.toUpperCase())
      ?.symbol ?? code;
  const profileComplete = Boolean(profile.complete);
  const pinReady = Boolean(pinStatus.data?.pinSet);
  const pinLoading = pinStatus.isLoading || pinStatus.isFetching;

  const goCompleteProfile = () => {
    router.push('/profile/personal');
  };

  const submit = async () => {
    if (!selectedOption || confirming || !selectedOption.creatable) return;
    setError(null);

    if (!profile.complete) {
      setError('Complete your profile before creating a wallet.');
      goCompleteProfile();
      return;
    }

    if (pinLoading) {
      setError('Checking your PIN status…');
      void pinStatus.refetch();
      return;
    }

    if (!pinStatus.data) {
      setError("We couldn't check your PIN status. Try again.");
      void pinStatus.refetch();
      return;
    }

    if (!pinStatus.data.pinSet) {
      setError('Set up a transaction PIN, then create your wallet.');
      router.push({
        pathname: '/security/pin/set',
        params: { required: '1', returnTo: '/wallet/create' },
      });
      return;
    }

    const confirmed = await requestPin({
      title: 'Confirm wallet creation',
      message: `Enter your 4-digit PIN to create a ${selectedOption.currencyCode} wallet for ${selectedOption.countryName}.`,
    });
    if (!confirmed) return;

    setConfirming(true);
    try {
      const result = await createWallet({ currencyCode: selectedOption.currencyCode });
      if ('error' in result) {
        const appError = toAppError(result.error);
        if (appError.code === 'WALLET_EXISTS') void wallets.refetch();
        setError(walletErrorMessage(appError));
        return;
      }
      toast.show({ type: 'success', title: `${result.data.currencyCode} wallet created` });
      router.replace({ pathname: '/wallet/[id]', params: { id: result.data.id } });
    } finally {
      setConfirming(false);
    }
  };

  if (available.length === 0) {
    const anyCorridor = remainingRegistrationWalletOptions({
      registrationIso2: registrationCountries.data,
      platformCurrencyCodes: currencies.data.map((currency) => currency.code),
      heldCurrencyCodes: [],
    }).length;
    return (
      <Screen>
        {header}
        <EmptyState
          title={anyCorridor ? 'You have every wallet' : 'No countries available'}
          message={
            anyCorridor
              ? "There's already a wallet for each enabled registration country."
              : 'No countries are currently enabled for registration.'
          }
        />
      </Screen>
    );
  }

  const selectedCreatable = Boolean(selectedOption?.creatable);

  return (
    <Screen
      scroll
      footer={
        <Button
          label={
            selectedOption
              ? selectedCreatable
                ? `Create ${selectedOption.currencyCode} wallet`
                : `${selectedOption.currencyCode} not available yet`
              : 'Choose a country'
          }
          onPress={() => void submit()}
          disabled={
            !selectedOption
            || !selectedCreatable
            || confirming
            || pinLoading
            || !profileComplete
          }
          loading={confirming || createState.isLoading}
          loadingLabel="Creating…"
          testID="create-wallet-submit"
        />
      }
    >
      {header}
      <FormAlert message={error} testID="create-wallet-error" />
      {!profileComplete ? (
        <View style={{ gap: theme.spacing.xs }}>
          <FormAlert
            tone="info"
            message="Complete your profile before creating a wallet."
            testID="create-wallet-profile-incomplete"
          />
          <TextLink
            label="Complete your profile"
            onPress={goCompleteProfile}
            testID="create-wallet-complete-profile"
          />
        </View>
      ) : null}
      {profileComplete && !pinReady && !pinLoading ? (
        <View style={{ gap: theme.spacing.xs }}>
          <FormAlert
            tone="info"
            message="Creating a wallet always requires your transaction PIN."
            testID="create-wallet-no-pin"
          />
          <TextLink
            label="Set up a PIN"
            onPress={() =>
              router.push({
                pathname: '/security/pin/set',
                params: { required: '1', returnTo: '/wallet/create' },
              })
            }
          />
        </View>
      ) : null}
      <View style={{ gap: theme.spacing.sm }} accessibilityRole="radiogroup" testID="create-wallet-countries">
        {available.map((option) => {
          const active = option.countryIso2 === selectedCountry;
          const symbol = symbolFor(option.currencyCode);
          const disabled = !option.creatable;
          return (
            <Pressable
              key={option.countryIso2}
              onPress={() => {
                if (disabled) return;
                setSelectedCountry(option.countryIso2);
              }}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={
                disabled
                  ? `${option.countryName}, ${option.currencyCode} not available yet`
                  : `${option.countryName}, ${option.currencyCode} (${symbol})`
              }
              testID={`create-wallet-option-${option.countryIso2}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                padding: theme.spacing.lg,
                borderRadius: theme.radius.md,
                borderWidth: active ? 2 : 1,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <CountryFlag iso2={option.countryIso2} emoji={option.flagEmoji} size={32} />
              <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                <AppText variant="bodyStrong">{option.countryName}</AppText>
                <AppText variant="caption" tone="secondary">
                  {disabled
                    ? `${option.currencyCode} · not available yet`
                    : `${option.currencyCode} · ${symbol}`}
                </AppText>
              </View>
              {active ? <Icon icon={Check} color={theme.colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
