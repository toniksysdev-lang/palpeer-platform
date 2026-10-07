import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetWithdrawalQuery } from '@/services/api/walletApi';
import type { WithdrawalTransactionResponse } from '@/types/api/wallet';
import { formatDateTime } from '@/utils/datetime';

import { MovementStatusHeader } from '../components/MovementStatusHeader';
import { ReviewRow } from '../components/ReviewRow';
import { describeDestination } from '../destination';
import { pollingIntervalFor } from '../movementStatus';
import { useFinalStatusRefresh } from '../useFinalStatusRefresh';
import { useMoneyFormat } from '../useMoneyFormat';

/**
 * Copy per VERIFIED withdrawal behaviour: a HOLD moves the amount to pending on creation; FAILED
 * releases it back to available; REVERSED credits it back after a completed payout.
 */
function describe(withdrawal: WithdrawalTransactionResponse): { title: string; message: string } {
  switch (withdrawal.status) {
    case 'INITIATED':
    case 'PENDING':
    case 'PROCESSING':
      return {
        title: 'Withdrawal in progress',
        message: 'The amount is held in your pending balance until the transfer completes.',
      };
    case 'SUCCESS':
      return { title: 'Withdrawal complete', message: 'The money has been sent.' };
    case 'FAILED':
      return {
        title: 'Withdrawal failed',
        message: `${withdrawal.failureReason ? `${withdrawal.failureReason.replace(/\.$/, '')}. ` : ''}The held amount was returned to your available balance.`,
      };
    case 'REVERSED':
      return {
        title: 'Withdrawal reversed',
        message: 'The amount was returned to your wallet.',
      };
  }
}

export function WithdrawalStatusScreen() {
  const theme = useTheme();
  const { withdrawalId } = useLocalSearchParams<{ withdrawalId: string }>();
  const { format } = useMoneyFormat();
  const first = useGetWithdrawalQuery(withdrawalId);
  const withdrawal = useGetWithdrawalQuery(withdrawalId, {
    pollingInterval: pollingIntervalFor(first.data?.status, true),
    skipPollingIfUnfocused: true,
  });
  useFinalStatusRefresh(withdrawal.data?.walletId, withdrawal.data?.status);

  const header = <StackHeader title="Withdrawal" />;

  if (withdrawal.error && !withdrawal.data) {
    return (
      <Screen>
        {header}
        <ErrorState
          error={toAppError(withdrawal.error)}
          onRetry={() => void withdrawal.refetch()}
        />
      </Screen>
    );
  }
  if (!withdrawal.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={200} />
      </Screen>
    );
  }

  const data = withdrawal.data;
  const { title, message } = describe(data);
  const destination = describeDestination(data.currencyCode, data.destinationReference);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={withdrawal.isFetching && !withdrawal.isLoading}
          onRefresh={() => void withdrawal.refetch()}
          tintColor={theme.colors.primary}
        />
      }
      footer={
        <Button
          label="Back to wallet"
          variant="outline"
          onPress={() =>
            router.dismissTo({ pathname: '/wallet/[id]', params: { id: data.walletId } })
          }
          testID="withdrawal-back"
        />
      }
    >
      {header}
      <MovementStatusHeader
        status={data.status}
        amount={format(data.amount, data.currencyCode)}
        title={title}
        message={message}
      />
      {withdrawal.error ? (
        <FormAlert tone="warning" message="Couldn't refresh the status. Pull down to try again." />
      ) : null}
      <Card variant="outlined" padding="md">
        <ReviewRow label="From" value={`${data.currencyCode} wallet`} />
        {destination ? <ReviewRow label="To" value={destination} /> : null}
        <ReviewRow label="Requested" value={formatDateTime(data.createdAt) ?? '—'} />
        {data.providerReference ? (
          <ReviewRow label="Reference" value={data.providerReference} />
        ) : null}
      </Card>
    </Screen>
  );
}
