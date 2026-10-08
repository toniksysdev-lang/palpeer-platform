import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { FormAlert } from '@/components/feedback/FormAlert';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextLink } from '@/components/ui/TextLink';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useGetCurrenciesQuery } from '@/services/api/currencyApi';
import { toAppError } from '@/services/api/errors';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import { useCreateWalletMutation, useGetWalletsQuery } from '@/services/api/walletApi';

import { walletErrorMessage } from '../errors';

/** Currencies come from `GET /currencies`; ones the user already holds are hidden (R-W-1). */
export function CreateWalletScreen() {
  const theme = useTheme();
  const toast = useToast();
  const currencies = useGetCurrenciesQuery();
  const wallets = useGetWalletsQuery();
  const pinStatus = useGetPinStatusQuery();
  const { requestPin } = usePinPrompt();
  const [createWallet, createState] = useCreateWalletMutation();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const header = <StackHeader title="New wallet" />;
  const loadError = currencies.error ?? wallets.error;

  if (loadError && !(currencies.data && wallets.data)) {
    return (
      <Screen>
        {header}
        <ErrorState
          error={toAppError(loadError)}
          onRetry={() => {
            void currencies.refetch();
            void wallets.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!currencies.data || !wallets.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={56} />
        <Skeleton height={56} />
      </Screen>
    );
  }

  const held = new Set(wallets.data.map((wallet) => wallet.currencyCode));
  const available = currencies.data.filter((currency) => !held.has(currency.code));
  const pinReady = Boolean(pinStatus.data?.pinSet);
  const pinLoading = pinStatus.isLoading || pinStatus.isFetching;

  const submit = async () => {
    if (!selected || confirming) return;
    setError(null);

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

    setConfirming(true);
    try {
      const confirmed = await requestPin({
        title: 'Confirm wallet creation',
        message: `Enter your 4-digit PIN to create a ${selected} wallet.`,
      });
      if (!confirmed) return;

      const result = await createWallet({ currencyCode: selected });
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
    return (
      <Screen>
        {header}
        <EmptyState
          title="You have every wallet"
          message="There's already a wallet for each available currency."
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <Button
          label={selected ? `Create ${selected} wallet` : 'Choose a currency'}
          onPress={() => void submit()}
          disabled={!selected || confirming || pinLoading}
          loading={confirming || createState.isLoading}
          loadingLabel="Creating…"
          testID="create-wallet-submit"
        />
      }
    >
      {header}
      <AppText tone="secondary">Choose the currency for your new wallet.</AppText>
      <FormAlert message={error} testID="create-wallet-error" />
      {!pinReady && !pinLoading ? (
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
      <View style={{ gap: theme.spacing.sm }} accessibilityRole="radiogroup">
        {available.map((currency) => {
          const active = currency.code === selected;
          return (
            <Pressable
              key={currency.code}
              onPress={() => setSelected(currency.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${currency.code} (${currency.symbol})`}
              testID={`create-wallet-option-${currency.code}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                padding: theme.spacing.lg,
                borderRadius: theme.radius.md,
                borderWidth: active ? 2 : 1,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
              }}
            >
              <AppText variant="h3" style={{ width: 56 }}>
                {currency.code}
              </AppText>
              <AppText tone="secondary" style={{ flex: 1 }}>
                {currency.symbol}
              </AppText>
              {active ? <Icon icon={Check} color={theme.colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
