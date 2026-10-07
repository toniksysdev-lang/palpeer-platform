import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useGetCurrenciesQuery } from '@/services/api/currencyApi';
import { toAppError } from '@/services/api/errors';
import { useCreateWalletMutation, useGetWalletsQuery } from '@/services/api/walletApi';

import { walletErrorMessage } from '../errors';

/** Currencies come from `GET /currencies`; ones the user already holds are hidden (R-W-1). */
export function CreateWalletScreen() {
  const theme = useTheme();
  const toast = useToast();
  const currencies = useGetCurrenciesQuery();
  const wallets = useGetWalletsQuery();
  const [createWallet, createState] = useCreateWalletMutation();
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const submit = async () => {
    if (!selected) return;
    setError(null);
    const result = await createWallet({ currencyCode: selected });
    if ('error' in result) {
      const appError = toAppError(result.error);
      if (appError.code === 'WALLET_EXISTS') void wallets.refetch();
      setError(walletErrorMessage(appError));
      return;
    }
    toast.show({ type: 'success', title: `${result.data.currencyCode} wallet created` });
    router.replace({ pathname: '/wallet/[id]', params: { id: result.data.id } });
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
          disabled={!selected}
          loading={createState.isLoading}
          loadingLabel="Creating…"
          testID="create-wallet-submit"
        />
      }
    >
      {header}
      <AppText tone="secondary">Choose the currency for your new wallet.</AppText>
      <FormAlert message={error} testID="create-wallet-error" />
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
