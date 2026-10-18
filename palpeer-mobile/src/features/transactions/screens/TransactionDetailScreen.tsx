import { skipToken } from '@reduxjs/toolkit/query';
import { router, useLocalSearchParams } from 'expo-router';
import { Circle, CircleCheck, SearchX } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatRateLine } from '@/features/exchange/format';
import { MovementStatusHeader } from '@/features/wallets/components/MovementStatusHeader';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { isInProgress } from '@/features/wallets/movementStatus';
import { useFinalStatusRefresh } from '@/features/wallets/useFinalStatusRefresh';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetTransactionQuery } from '@/services/api/transactionApi';
import type { TransactionItemResponse } from '@/types/api/transaction';
import { formatDateTime } from '@/utils/datetime';
import { humanizeStatus } from '@/utils/status';

import {
  describeTransaction,
  isTransactionType,
  recordedSteps,
  transactionPollMs,
  typeLabel,
} from '../logic';

function Step({ label, detail, done }: { label: string; detail?: string | null; done: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', gap: theme.spacing.md, paddingVertical: theme.spacing.xs }}
    >
      <Icon
        icon={done ? CircleCheck : Circle}
        color={done ? theme.colors.success : theme.colors.textMuted}
      />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {detail ? (
          <AppText variant="caption" tone="secondary">
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Requested, the ledger steps recorded so far, then the latest status (R-T-4). */
function Timeline({ item }: { item: TransactionItemResponse }) {
  const theme = useTheme();
  const open = isInProgress(item.status);
  return (
    <Card variant="outlined" padding="md" testID="transaction-timeline">
      <AppText variant="overline" tone="muted" style={{ marginBottom: theme.spacing.xs }}>
        Progress
      </AppText>
      <Step label="Requested" detail={formatDateTime(item.createdAt)} done />
      {recordedSteps(item).map((step) => (
        <Step key={step} label={step} done />
      ))}
      <Step
        label={open ? 'Waiting for the next update' : humanizeStatus(item.status)}
        detail={open ? null : formatDateTime(item.updatedAt)}
        done={!open}
      />
    </Card>
  );
}

function detailsLink(item: TransactionItemResponse) {
  switch (item.type) {
    case 'FUNDING':
      return {
        label: 'Payment details',
        go: () =>
          router.push({ pathname: '/wallet/funding/[fundingId]', params: { fundingId: item.id } }),
      };
    case 'WITHDRAWAL':
      return {
        label: 'Withdrawal details',
        go: () =>
          router.push({
            pathname: '/wallet/withdrawal/[withdrawalId]',
            params: { withdrawalId: item.id },
          }),
      };
    case 'EXCHANGE':
    case 'TRANSFER':
      return null;
    case 'P2P':
      return {
        label: 'P2P order details',
        go: () => router.push({ pathname: '/p2p/order/[id]', params: { id: item.id } }),
      };
  }
}

export function TransactionDetailScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const arg =
    isTransactionType(params.type) && params.id ? { type: params.type, id: params.id } : null;
  const { format } = useMoneyFormat();
  const first = useGetTransactionQuery(arg ?? skipToken);
  const transaction = useGetTransactionQuery(arg ?? skipToken, {
    pollingInterval: transactionPollMs(first.data),
    skipPollingIfUnfocused: true,
  });
  const data = transaction.data;
  useFinalStatusRefresh(data?.walletId ?? undefined, data?.status);
  useFinalStatusRefresh(data?.secondaryWalletId ?? undefined, data?.status);

  const header = <StackHeader title={arg ? typeLabel(arg.type) : 'Transaction'} />;

  if (!arg) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={SearchX}
          title="Transaction not found"
          message="This link doesn't point to a transaction."
        />
      </Screen>
    );
  }
  if (transaction.error && !data) {
    return (
      <Screen>
        {header}
        <ErrorState
          error={toAppError(transaction.error)}
          onRetry={() => void transaction.refetch()}
        />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        {header}
        <Skeleton height={200} />
        <Skeleton height={120} />
      </Screen>
    );
  }

  const { title, message } = describeTransaction(data);
  const paired = data.type === 'EXCHANGE' || data.type === 'P2P';
  const link = detailsLink(data);
  const headline =
    paired && data.secondaryAmount && data.secondaryCurrencyCode
      ? `${format(data.amount, data.currencyCode)} → ${format(data.secondaryAmount, data.secondaryCurrencyCode)}`
      : format(data.amount, data.currencyCode);

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={transaction.isFetching && !transaction.isLoading}
          onRefresh={() => void transaction.refetch()}
          tintColor={theme.colors.primary}
        />
      }
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          {link ? (
            <Button
              label={link.label}
              variant="outline"
              onPress={link.go}
              testID="transaction-details-link"
            />
          ) : null}
          {data.walletId ? (
            <Button
              label={`View ${data.currencyCode} wallet`}
              variant={link ? 'ghost' : 'outline'}
              onPress={() =>
                router.push({ pathname: '/wallet/[id]', params: { id: data.walletId! } })
              }
              testID="transaction-wallet"
            />
          ) : null}
        </View>
      }
    >
      {header}
      <MovementStatusHeader
        status={data.status}
        amount={headline}
        title={title}
        message={message}
      />
      {transaction.error ? (
        <FormAlert tone="warning" message="Couldn't refresh the status. Pull down to try again." />
      ) : null}

      <Card variant="outlined" padding="md" testID="transaction-summary">
        {paired ? (
          <>
            <ReviewRow
              label={data.type === 'P2P' ? 'Base amount' : 'You sent'}
              value={format(data.amount, data.currencyCode)}
              testID="transaction-sent"
            />
            {data.secondaryAmount && data.secondaryCurrencyCode ? (
              <ReviewRow
                label={data.type === 'P2P' ? 'Quote amount' : 'You received'}
                value={format(data.secondaryAmount, data.secondaryCurrencyCode)}
                testID="transaction-received"
              />
            ) : null}
            {data.appliedRate && data.secondaryCurrencyCode ? (
              <ReviewRow
                label="Rate"
                value={formatRateLine(
                  data.appliedRate,
                  data.currencyCode,
                  data.secondaryCurrencyCode,
                )}
                testID="transaction-rate"
              />
            ) : null}
          </>
        ) : (
          <>
            <ReviewRow
              label="Amount"
              value={format(data.amount, data.currencyCode)}
              testID="transaction-amount"
            />
            <ReviewRow label="Wallet" value={`${data.currencyCode} wallet`} />
          </>
        )}
        <ReviewRow label="Status" value={humanizeStatus(data.status)} testID="transaction-status" />
        {data.failureReason ? (
          <ReviewRow label="Reason" value={data.failureReason} testID="transaction-reason" />
        ) : null}
        <ReviewRow label="Date" value={formatDateTime(data.createdAt) ?? '—'} />
        <ReviewRow label="Reference" value={data.id} testID="transaction-reference" />
      </Card>

      <Timeline item={data} />
    </Screen>
  );
}
