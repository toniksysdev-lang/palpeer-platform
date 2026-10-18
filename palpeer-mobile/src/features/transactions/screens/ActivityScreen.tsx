import { router } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextLink } from '@/components/ui/TextLink';
import { PickerField, PickerSheet } from '@/features/exchange/components/PickerSheet';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import {
  useGetTransactionHistoryInfiniteQuery,
  useGetTransactionSummaryQuery,
} from '@/services/api/transactionApi';
import { ActivitySummaryCard } from '../components/ActivitySummaryCard';
import { TransactionRow } from '../components/TransactionRow';
import {
  ALL_TIME_FROM,
  groupByDay,
  type Period,
  PERIOD_OPTIONS,
  periodFrom,
  TYPE_OPTIONS,
  type TypeFilter,
  uniqueItems,
} from '../logic';
import { openTransaction } from '../navigation';

function Loading() {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }} testID="activity-loading">
      <Skeleton height={80} />
      <Skeleton height={80} />
      <Skeleton height={80} />
    </View>
  );
}

/** Funding, withdrawals and exchanges from the backend feed, with its type and date filters. */
export function ActivityScreen() {
  const theme = useTheme();
  const now = useNow();
  const [type, setType] = useState<TypeFilter>('ALL');
  const [period, setPeriod] = useState<Period>('ALL');
  // Fixed when the period is chosen, so the query (and its cache entry) stays the same.
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [picker, setPicker] = useState<'type' | 'period' | null>(null);

  const history = useGetTransactionHistoryInfiniteQuery({
    type: type === 'ALL' ? undefined : type,
    from,
  });
  const summary = useGetTransactionSummaryQuery({ from: from ?? ALL_TIME_FROM });

  const choosePeriod = (next: Period) => {
    setPeriod(next);
    setFrom(periodFrom(next, Date.now()));
  };
  const clearFilters = () => {
    setType('ALL');
    choosePeriod('ALL');
  };
  const refresh = () => {
    void history.refetch();
    void summary.refetch();
  };

  const filtering = type !== 'ALL' || period !== 'ALL';
  const items = uniqueItems(history.data?.pages);
  const typeTitle = TYPE_OPTIONS.find((option) => option.key === type)?.title ?? '';
  const periodTitle = PERIOD_OPTIONS.find((option) => option.key === period)?.title ?? '';

  let body;
  if (history.error && !history.data) {
    body = <ErrorState error={toAppError(history.error)} onRetry={() => void history.refetch()} />;
  } else if (!history.data) {
    body = <Loading />;
  } else if (items.length === 0) {
    body = filtering ? (
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }} testID="activity-no-matches">
        <AppText tone="secondary" align="center">
          No transactions match your filters.
        </AppText>
        <Button
          label="Clear filters"
          variant="ghost"
          fullWidth={false}
          onPress={clearFilters}
          testID="activity-clear-filters"
        />
      </View>
    ) : (
      <EmptyState
        icon={ReceiptText}
        title="No activity yet"
        message="Funding, withdrawals and exchanges will appear here."
        actionLabel="Go to wallets"
        onAction={() => router.navigate('/wallets')}
      />
    );
  } else {
    body = (
      <View style={{ gap: theme.spacing.lg }} testID="activity-list">
        {groupByDay(items, now).map((group) => (
          <View key={group.key} style={{ gap: theme.spacing.sm }}>
            <AppText variant="overline" tone="muted" accessibilityRole="header">
              {group.label}
            </AppText>
            {group.items.map((item) => (
              <TransactionRow
                key={`${item.type}-${item.id}`}
                item={item}
                timeOnly
                onPress={() => openTransaction(item)}
              />
            ))}
          </View>
        ))}
        {history.hasNextPage ? (
          <Button
            label="Load more"
            variant="ghost"
            size="md"
            loading={history.isFetchingNextPage}
            onPress={() => void history.fetchNextPage()}
            testID="activity-more"
          />
        ) : null}
      </View>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={history.isFetching && !history.isLoading && !history.isFetchingNextPage}
          onRefresh={refresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      <StackHeader title="Activity" />

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <PickerField
            label="Type"
            value={typeTitle}
            onPress={() => setPicker('type')}
            testID="activity-filter-type"
          />
        </View>
        <View style={{ flex: 1 }}>
          <PickerField
            label="Period"
            value={periodTitle}
            onPress={() => setPicker('period')}
            testID="activity-filter-period"
          />
        </View>
      </View>

      {summary.data ? (
        <ActivitySummaryCard summary={summary.data} periodTitle={periodTitle} />
      ) : summary.isLoading ? (
        <Skeleton height={150} />
      ) : null}

      {history.error && history.data ? (
        <FormAlert
          tone="warning"
          message="Couldn't refresh. Pull down to try again."
          testID="activity-stale"
        />
      ) : null}

      {body}

      <View style={{ alignItems: 'center', gap: theme.spacing.xxs }}>
        <TextLink label="Open P2P marketplace history" onPress={() => router.push('/p2p/history')} />
      </View>

      <PickerSheet
        visible={picker === 'type'}
        title="Type"
        options={TYPE_OPTIONS}
        selectedKey={type}
        onSelect={(key) => setType(key as TypeFilter)}
        onClose={() => setPicker(null)}
        testID="activity-type-picker"
      />
      <PickerSheet
        visible={picker === 'period'}
        title="Period"
        options={PERIOD_OPTIONS}
        selectedKey={period}
        onSelect={(key) => choosePeriod(key as Period)}
        onClose={() => setPicker(null)}
        testID="activity-period-picker"
      />
    </Screen>
  );
}
