import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ReceiptText } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { baseApi } from '@/services/api/baseApi';
import { toAppError } from '@/services/api/errors';
import {
  useGetRecentTransactionsQuery,
  useGetWalletQuery,
  useGetWalletTransactionsInfiniteQuery,
} from '@/services/api/walletApi';
import { useAppDispatch } from '@/store';
import { formatClockTime } from '@/utils/datetime';

import { LedgerRow } from '../components/LedgerRow';
import { MovementRow } from '../components/MovementRow';
import { StaleDataNotice } from '../components/StaleDataNotice';
import { isInProgress } from '../movementStatus';
import { hasPaymentRail } from '../rails';
import { useMoneyFormat } from '../useMoneyFormat';

/** How far back in-progress fundings and withdrawals are looked up (feed limit is 1..100). */
const RECENT_LIMIT = 50;

export function WalletDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { format } = useMoneyFormat();
  const dispatch = useAppDispatch();
  const wallet = useGetWalletQuery(id);
  const ledger = useGetWalletTransactionsInfiniteQuery(id);
  const recent = useGetRecentTransactionsQuery(RECENT_LIMIT);

  const refresh = () => {
    // The wallet list (Wallets tab, exchange) caches this balance too; the tag refreshes both.
    dispatch(baseApi.util.invalidateTags([{ type: 'Wallet', id }]));
    void ledger.refetch();
    void recent.refetch();
  };

  if (wallet.error && !wallet.data) {
    return (
      <Screen>
        <StackHeader title="Wallet" />
        <ErrorState error={toAppError(wallet.error)} onRetry={() => void wallet.refetch()} />
      </Screen>
    );
  }

  if (!wallet.data) {
    return (
      <Screen>
        <StackHeader title="Wallet" />
        <Skeleton height={160} />
        <Skeleton height={64} />
      </Screen>
    );
  }

  const data = wallet.data;
  const code = data.currencyCode;
  const railAvailable = hasPaymentRail(code);
  const updatedAt = wallet.fulfilledTimeStamp
    ? formatClockTime(new Date(wallet.fulfilledTimeStamp).toISOString())
    : null;
  const inProgress = (recent.data ?? []).filter(
    (item) =>
      item.walletId === data.id &&
      (item.type === 'FUNDING' || item.type === 'WITHDRAWAL') &&
      isInProgress(item.status),
  );
  const entries = ledger.data?.pages.flatMap((page) => page.content) ?? [];

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={wallet.isFetching && !wallet.isLoading}
          onRefresh={refresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      <StackHeader title={`${code} wallet`} />

      <StaleDataNotice
        error={wallet.error}
        fulfilledTimeStamp={wallet.fulfilledTimeStamp}
        testID="wallet-stale"
      />

      <Card variant="elevated" padding="lg" testID="wallet-balances">
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            Available balance
          </AppText>
          <AppText variant="amount" testID="wallet-available">
            {format(data.availableBalance, code)}
          </AppText>
          <AppText tone="secondary" testID="wallet-pending">
            Pending {format(data.pendingBalance, code)}
          </AppText>
          {updatedAt ? (
            <AppText variant="caption" tone="muted">
              As of {updatedAt}
            </AppText>
          ) : null}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Fund"
            size="md"
            leftIcon={ArrowDownLeft}
            disabled={!railAvailable}
            onPress={() => router.push({ pathname: '/wallet/[id]/fund', params: { id: data.id } })}
            testID="wallet-fund"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Withdraw"
            size="md"
            variant="outline"
            leftIcon={ArrowUpRight}
            disabled={!railAvailable}
            onPress={() =>
              router.push({ pathname: '/wallet/[id]/withdraw', params: { id: data.id } })
            }
            testID="wallet-withdraw"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Exchange"
            size="md"
            variant="outline"
            leftIcon={ArrowLeftRight}
            onPress={() => router.navigate({ pathname: '/exchange', params: { from: data.id } })}
            testID="wallet-exchange"
          />
        </View>
      </View>
      {railAvailable ? null : (
        <FormAlert
          tone="info"
          message={`Funding and withdrawals aren't available for ${code} yet.`}
          testID="wallet-no-rail"
        />
      )}

      {inProgress.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }} testID="wallet-in-progress">
          <AppText variant="overline" tone="muted">
            In progress
          </AppText>
          {inProgress.map((item) => (
            <MovementRow
              key={item.id}
              item={item}
              onPress={() =>
                item.type === 'FUNDING'
                  ? router.push({
                      pathname: '/wallet/funding/[fundingId]',
                      params: { fundingId: item.id },
                    })
                  : router.push({
                      pathname: '/wallet/withdrawal/[withdrawalId]',
                      params: { withdrawalId: item.id },
                    })
              }
            />
          ))}
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="overline" tone="muted">
          Transactions
        </AppText>
        {ledger.error && entries.length === 0 ? (
          <ErrorState error={toAppError(ledger.error)} onRetry={() => void ledger.refetch()} />
        ) : !ledger.data ? (
          <Skeleton height={56} />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No transactions yet"
            message="Money in and out of this wallet will appear here."
          />
        ) : (
          <View testID="wallet-ledger">
            {entries.map((entry) => (
              <LedgerRow key={entry.id} entry={entry} />
            ))}
            {ledger.hasNextPage ? (
              <Button
                label="Load more"
                variant="ghost"
                size="md"
                loading={ledger.isFetchingNextPage}
                onPress={() => void ledger.fetchNextPage()}
                testID="wallet-ledger-more"
              />
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}
