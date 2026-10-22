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

import { FundingPaymentDetailsCard } from '../components/FundingPaymentDetailsCard';
import { MovementStatusHeader } from '../components/MovementStatusHeader';
import { ReviewRow } from '../components/ReviewRow';
import { pollingIntervalFor } from '../movementStatus';
import { useFinalStatusRefresh } from '../useFinalStatusRefresh';
import { useMoneyFormat } from '../useMoneyFormat';

const IN_PROGRESS = new Set(['INITIATED', 'PENDING', 'PROCESSING']);

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
      if (funding.providerName === 'APAYLO' && funding.currencyCode === 'CAD') {
        return {
          title: 'Waiting for Instant Interac',
          message:
            'Send Interac e-Transfer from your banking app to Palpeer’s account using the instructions below. We do not email you a request to accept.',
        };
      }
      if (funding.providerName === 'KUDA' || funding.paymentDetails) {
        return {
          title: 'Transfer to your virtual account',
          message:
            'Use the account details below in your banking app. Your balance updates once the transfer is confirmed.',
        };
      }
      return {
        title: 'Waiting for your payment',
        message: 'Follow the instructions below. Your balance updates once the payment arrives.',
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
  const awaitingPayment = IN_PROGRESS.has(data.status);
  const showPaymentDetails = awaitingPayment && !!data.paymentDetails;
  // Structured card is primary; keep plain instructions only when we have no paymentDetails.
  const showInstructions =
    awaitingPayment && !!data.fundingInstructions && !showPaymentDetails;

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
      {showPaymentDetails && data.paymentDetails ? (
        <FundingPaymentDetailsCard details={data.paymentDetails} />
      ) : null}
      {showInstructions ? (
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
