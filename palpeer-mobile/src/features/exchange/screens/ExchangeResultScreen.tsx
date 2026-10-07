import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { MovementStatusHeader } from '@/features/wallets/components/MovementStatusHeader';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { FUNDING_POLL_MS } from '@/features/wallets/movementStatus';
import { useFinalStatusRefresh } from '@/features/wallets/useFinalStatusRefresh';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetExchangeQuery } from '@/services/api/exchangeApi';
import { useGetWalletsQuery } from '@/services/api/walletApi';
import type { ExchangeTransactionResponse } from '@/types/api/exchange';
import { formatDateTime } from '@/utils/datetime';

import { formatRateLine } from '../format';

/**
 * VERIFIED behaviour: execute posts the DEBIT and CREDIT in one database transaction, so a failed
 * exchange moves nothing. `INITIATED` is only seen mid-execution.
 */
function describe(exchange: ExchangeTransactionResponse, targetCode: string) {
  switch (exchange.status) {
    case 'SUCCESS':
      return {
        title: 'Exchange complete',
        message: `The money is in your ${targetCode} wallet.`,
      };
    case 'FAILED':
      return {
        title: 'Exchange failed',
        message: `${exchange.failureReason ? `${exchange.failureReason.replace(/\.$/, '')}. ` : ''}Nothing was exchanged.`,
      };
    case 'INITIATED':
      return { title: 'Exchange in progress', message: 'This usually takes a moment.' };
  }
}

export function ExchangeResultScreen() {
  const theme = useTheme();
  const { exchangeId } = useLocalSearchParams<{ exchangeId: string }>();
  const { format } = useMoneyFormat();
  const wallets = useGetWalletsQuery();
  const first = useGetExchangeQuery(exchangeId);
  const exchange = useGetExchangeQuery(exchangeId, {
    pollingInterval: first.data?.status === 'INITIATED' ? FUNDING_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  useFinalStatusRefresh(exchange.data?.sourceWalletId, exchange.data?.status);
  useFinalStatusRefresh(exchange.data?.targetWalletId, exchange.data?.status);

  const header = <StackHeader title="Exchange" />;

  if (exchange.error && !exchange.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(exchange.error)} onRetry={() => void exchange.refetch()} />
      </Screen>
    );
  }
  // Currency codes aren't in the exchange response; they come from the user's wallets.
  if (!exchange.data || !wallets.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={200} />
      </Screen>
    );
  }

  const data = exchange.data;
  const codeOf = (walletId: string) =>
    wallets.data?.find((wallet) => wallet.id === walletId)?.currencyCode ?? '';
  const sourceCode = codeOf(data.sourceWalletId);
  const targetCode = codeOf(data.targetWalletId);
  const { title, message } = describe(data, targetCode);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={exchange.isFetching && !exchange.isLoading}
          onRefresh={() => void exchange.refetch()}
          tintColor={theme.colors.primary}
        />
      }
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={`View ${targetCode} wallet`}
            variant="outline"
            onPress={() =>
              router.push({ pathname: '/wallet/[id]', params: { id: data.targetWalletId } })
            }
            testID="exchange-result-wallet"
          />
          <Button
            label="Done"
            onPress={() => router.dismissTo('/exchange')}
            testID="exchange-result-done"
          />
        </View>
      }
    >
      {header}
      <MovementStatusHeader
        status={data.status}
        amount={format(data.targetAmount, targetCode)}
        title={title}
        message={message}
      />
      {exchange.error ? (
        <FormAlert tone="warning" message="Couldn't refresh the status. Pull down to try again." />
      ) : null}
      <Card variant="outlined" padding="md">
        <ReviewRow
          label="You sent"
          value={format(data.sourceAmount, sourceCode)}
          testID="exchange-result-send"
        />
        <ReviewRow
          label="You received"
          value={format(data.targetAmount, targetCode)}
          testID="exchange-result-receive"
        />
        <ReviewRow
          label="Rate"
          value={formatRateLine(data.appliedRate, sourceCode, targetCode)}
          testID="exchange-result-rate"
        />
        <ReviewRow label="Date" value={formatDateTime(data.createdAt) ?? '—'} />
      </Card>
    </Screen>
  );
}
