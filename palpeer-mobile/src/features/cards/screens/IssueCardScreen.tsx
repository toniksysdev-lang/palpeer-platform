import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useIssueCardMutation } from '@/services/api/cardApi';
import { useGetCurrenciesQuery } from '@/services/api/currencyApi';
import { toAppError } from '@/services/api/errors';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import type { IssueCardRequest } from '@/types/api/card';

import { CARDHOLDER_NAME_MAX, cardErrorMessage } from '../logic';

/**
 * Currency from `GET /currencies`; the card can optionally be linked to the user's wallet in the
 * same currency (R-CD-3). There's no preview or fee endpoint, so neither is shown (CD-2).
 */
export function IssueCardScreen() {
  const theme = useTheme();
  const toast = useToast();
  const currencies = useGetCurrenciesQuery();
  const wallets = useGetWalletsQuery();
  const [issueCard, issueState] = useIssueCardMutation();
  const [currency, setCurrency] = useState<string | null>(null);
  const [linkWallet, setLinkWallet] = useState(false);
  const [holder, setHolder] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const header = <StackHeader title="Issue a card" />;
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

  const wallet = currency ? wallets.data.find((item) => item.currencyCode === currency) : undefined;
  const name = holder.trim();
  const nameError =
    name.length > CARDHOLDER_NAME_MAX ? `Use at most ${CARDHOLDER_NAME_MAX} characters.` : null;
  const linked = Boolean(wallet && linkWallet);

  const choose = (code: string) => {
    setCurrency(code);
    setLinkWallet(false);
    setError(null);
  };

  const issue = async () => {
    if (!currency) return;
    const request: IssueCardRequest = { currencyCode: currency };
    if (linked && wallet) request.walletId = wallet.id;
    if (name) request.cardholderName = name;
    setError(null);
    const result = await issueCard(request);
    setConfirming(false);
    if ('error' in result) {
      setError(cardErrorMessage(toAppError(result.error)));
      return;
    }
    toast.show({ type: 'success', title: `${result.data.currencyCode} card issued` });
    router.replace({ pathname: '/cards/[id]', params: { id: result.data.id } });
  };

  return (
    <Screen
      scroll
      keyboardAware
      footer={
        <Button
          label={currency ? `Issue ${currency} card` : 'Choose a currency'}
          onPress={() => setConfirming(true)}
          disabled={!currency || Boolean(nameError)}
          testID="issue-card-submit"
        />
      }
    >
      {header}
      <AppText tone="secondary">Choose the card currency.</AppText>
      <FormAlert message={error} testID="issue-card-error" />
      <View style={{ gap: theme.spacing.sm }} accessibilityRole="radiogroup">
        {currencies.data.map((item) => {
          const active = item.code === currency;
          return (
            <Pressable
              key={item.code}
              onPress={() => choose(item.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.code} (${item.symbol})`}
              testID={`issue-card-currency-${item.code}`}
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
                {item.code}
              </AppText>
              <AppText tone="secondary" style={{ flex: 1 }}>
                {item.symbol}
              </AppText>
              {active ? <Icon icon={Check} color={theme.colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
      {wallet ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}
          testID="issue-card-link"
        >
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="bodyStrong">Link to my {wallet.currencyCode} wallet</AppText>
            <AppText variant="caption" tone="secondary">
              Optional. Only a wallet in the same currency can be linked.
            </AppText>
          </View>
          <Switch
            value={linkWallet}
            onValueChange={setLinkWallet}
            accessibilityLabel={`Link to my ${wallet.currencyCode} wallet`}
            trackColor={{ true: theme.colors.primary, false: theme.colors.borderStrong }}
            testID="issue-card-link-switch"
          />
        </View>
      ) : null}
      <Input
        label="Name on card (optional)"
        value={holder}
        onChangeText={setHolder}
        autoCapitalize="words"
        autoComplete="name"
        maxLength={CARDHOLDER_NAME_MAX}
        error={nameError}
        testID="issue-card-holder"
      />
      <ConfirmDialog
        visible={confirming}
        title="Issue this card?"
        message={
          currency
            ? `A virtual ${currency} card will be issued${linked ? ` and linked to your ${currency} wallet` : ''}.`
            : ''
        }
        confirmLabel="Issue card"
        loading={issueState.isLoading}
        onConfirm={() => void issue()}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
