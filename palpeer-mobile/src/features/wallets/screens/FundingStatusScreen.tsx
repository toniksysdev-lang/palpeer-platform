import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetFundingQuery } from '@/services/api/walletApi';
import type { FundingTransactionResponse } from '@/types/api/wallet';
import { formatDateTime } from '@/utils/datetime';

import { MovementStatusHeader } from '../components/MovementStatusHeader';
import { ReviewRow } from '../components/ReviewRow';
import { pollingIntervalFor } from '../movementStatus';
import { useFinalStatusRefresh } from '../useFinalStatusRefresh';
import { useMoneyFormat } from '../useMoneyFormat';

/** Status copy per VERIFIED `MoneyMovementStatus`. Success is only claimed on `SUCCESS` (R-G-4). */
function describe(funding: FundingTransactionResponse): { title: string; message: string } {
  switch (funding.status) {
    case 'INITIATED':
      return funding.providerName
        ? { title: 'Funding requested', message: 'Waiting for the payment provider.' }
        : {
            title: `Funding isn't available for ${funding.currencyCode} yet`,
            message:
              'No payment method is active for this currency right now, so this request can’t be completed. Nothing has been added to your wallet.',
          };
    case 'PENDING':
      return funding.providerName === 'APAYLO' && funding.currencyCode === 'CAD'
        ? {
            title: 'Waiting for Instant Interac',
            message:
              'Interac, Instant deposit via Interac — check your email or banking app to accept the deposit request.',
          }
        : {
            title: 'Waiting for your payment',
            message:
              'Follow the instructions below. Your balance updates once the payment arrives.',
          };
    case 'PROCESSING':
      return { title: 'Processing your payment', message: 'This usually takes a few moments.' };
    case 'SUCCESS':
      return { title: 'Funds added', message: 'The amount is now in your available balance.' };
    case 'FAILED':
      return {
        title: 'Funding failed',
        message: funding.failureReason ?? 'The payment wasn’t completed. Nothing was added.',
      };
    case 'REVERSED':
      return {
        title: 'Funding reversed',
        message: 'This funding was reversed and the amount was taken back out of your wallet.',
      };
  }
}

export function FundingStatusScreen() {
  const theme = useTheme();
  const { fundingId } = useLocalSearchParams<{ fundingId: string }>();
  const { format } = useMoneyFormat();
  const first = useGetFundingQuery(fundingId);
  const funding = useGetFundingQuery(fundingId, {
    pollingInterval: pollingIntervalFor(first.data?.status, !!first.data?.providerName),
    skipPollingIfUnfocused: true,
  });
  useFinalStatusRefresh(funding.data?.walletId, funding.data?.status);

  const header = <StackHeader title="Funding" />;

  if (funding.error && !funding.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(funding.error)} onRetry={() => void funding.refetch()} />
      </Screen>
    );
  }
  if (!funding.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={200} />
      </Screen>
    );
  }

  const data = funding.data;
  const { title, message } = describe(data);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={funding.isFetching && !funding.isLoading}
          onRefresh={() => void funding.refetch()}
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
          testID="funding-back"
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
      {funding.error ? (
        <FormAlert tone="warning" message="Couldn't refresh the status. Pull down to try again." />
      ) : null}
      {data.fundingInstructions && data.status === 'PENDING' ? (
        <Card variant="outlined" padding="md" testID="funding-instructions">
          <AppText variant="overline" tone="muted">
            Payment instructions
          </AppText>
          <AppText selectable style={{ marginTop: theme.spacing.xs }}>
            {data.fundingInstructions}
          </AppText>
        </Card>
      ) : null}
      <Card variant="outlined" padding="md">
        <ReviewRow label="Wallet" value={`${data.currencyCode} wallet`} />
        <ReviewRow label="Requested" value={formatDateTime(data.createdAt) ?? '—'} />
        {data.providerReference ? (
          <ReviewRow label="Reference" value={data.providerReference} />
        ) : null}
      </Card>
    </Screen>
  );
}
