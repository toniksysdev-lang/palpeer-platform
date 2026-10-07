import { router } from 'expo-router';
import { History, MessageCircle, Plus, Search, Store } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { PickerField, PickerSheet } from '@/features/exchange/components/PickerSheet';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useGetOpenRequestsQuery } from '@/services/api/p2pApi';
import { useAppSelector } from '@/store';

import { RequestCard } from '../components/RequestCard';
import {
  activeFilterCount,
  currenciesIn,
  DEFAULT_FILTERS,
  filterRequests,
  SORT_OPTIONS,
  type MarketplaceFilters,
  type SideFilter,
} from '../logic';

const ANY_CURRENCY = '__ANY__';

const SIDE_OPTIONS: readonly { value: SideFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'BUY', label: 'Buy' },
  { value: 'SELL', label: 'Sell' },
];

/** Open requests from every user. Filters and sorting run on the device (P-4). */
export function MarketplaceScreen() {
  const theme = useTheme();
  const now = useNow();
  const userId = useAppSelector((state) => state.session.userId);
  const requests = useGetOpenRequestsQuery();
  const [filters, setFilters] = useState<MarketplaceFilters>(DEFAULT_FILTERS);
  const [picker, setPicker] = useState<'currency' | 'sort' | null>(null);

  const list = requests.data;
  const visible = useMemo(() => (list ? filterRequests(list, filters) : []), [list, filters]);
  const currencies = useMemo(() => (list ? currenciesIn(list) : []), [list]);
  const update = (changes: Partial<MarketplaceFilters>) =>
    setFilters((current) => ({ ...current, ...changes }));
  const filtering = activeFilterCount(filters) > 0 || filters.search.trim() !== '';

  const createRequest = () => router.push('/p2p/create');

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      <AppText variant="h1" accessibilityRole="header" style={{ flex: 1 }}>
        P2P
      </AppText>
      <IconButton
        icon={MessageCircle}
        accessibilityLabel="Messages"
        onPress={() => router.push('/chat')}
        testID="p2p-messages"
      />
      <IconButton
        icon={History}
        accessibilityLabel="My requests, offers and orders"
        onPress={() => router.push('/p2p/history')}
        testID="p2p-history"
      />
      <IconButton
        icon={Plus}
        variant="filled"
        accessibilityLabel="Create a request"
        onPress={createRequest}
        testID="p2p-create"
      />
    </View>
  );

  let body;
  if (requests.error && !list) {
    body = (
      <ErrorState error={toAppError(requests.error)} onRetry={() => void requests.refetch()} />
    );
  } else if (!list) {
    body = (
      <View style={{ gap: theme.spacing.md }} testID="p2p-loading">
        <Skeleton height={120} />
        <Skeleton height={120} />
      </View>
    );
  } else if (list.length === 0) {
    body = (
      <EmptyState
        icon={Store}
        title="No open requests"
        message="Be the first to post a request to buy or sell a currency."
        actionLabel="Create request"
        onAction={createRequest}
      />
    );
  } else {
    body = (
      <View style={{ gap: theme.spacing.md }}>
        {requests.error ? (
          <FormAlert
            tone="warning"
            message="Couldn't refresh. Pull down to try again."
            testID="p2p-stale"
          />
        ) : null}
        {visible.length === 0 ? (
          <View style={{ alignItems: 'center', gap: theme.spacing.sm }} testID="p2p-no-matches">
            <AppText tone="secondary" align="center">
              No requests match your filters.
            </AppText>
            <Button
              label="Clear filters"
              variant="ghost"
              fullWidth={false}
              onPress={() => setFilters(DEFAULT_FILTERS)}
              testID="p2p-clear-filters"
            />
          </View>
        ) : (
          visible.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              own={request.userId === userId}
              now={now}
              onPress={() =>
                router.push({ pathname: '/p2p/request/[id]', params: { id: request.id } })
              }
            />
          ))
        )}
      </View>
    );
  }

  const sortTitle = SORT_OPTIONS.find((option) => option.key === filters.sort)?.title ?? '';

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={requests.isFetching && !requests.isLoading}
          onRefresh={() => void requests.refetch()}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      {list && list.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Input
            label="Search"
            placeholder="Currency code or note"
            value={filters.search}
            onChangeText={(search) => update({ search })}
            autoCapitalize="characters"
            autoCorrect={false}
            left={<Icon icon={Search} color={theme.colors.textMuted} />}
            testID="p2p-search"
          />
          <SegmentedControl
            options={SIDE_OPTIONS}
            value={filters.side}
            onChange={(side) => update({ side })}
            accessibilityLabel="Request side"
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <PickerField
                label="Currency"
                value={filters.currency ?? 'Any'}
                onPress={() => setPicker('currency')}
                testID="p2p-filter-currency"
              />
            </View>
            <View style={{ flex: 1 }}>
              <PickerField
                label="Sort"
                value={sortTitle}
                onPress={() => setPicker('sort')}
                testID="p2p-filter-sort"
              />
            </View>
          </View>
          {filtering ? (
            <AppText variant="caption" tone="secondary" testID="p2p-result-count">
              {visible.length} of {list.length} requests
            </AppText>
          ) : null}
        </View>
      ) : null}
      {body}

      <PickerSheet
        visible={picker === 'currency'}
        title="Currency"
        options={[
          { key: ANY_CURRENCY, title: 'Any currency' },
          ...currencies.map((code) => ({ key: code, title: code })),
        ]}
        selectedKey={filters.currency ?? ANY_CURRENCY}
        onSelect={(key) => update({ currency: key === ANY_CURRENCY ? null : key })}
        onClose={() => setPicker(null)}
        testID="p2p-currency-picker"
      />
      <PickerSheet
        visible={picker === 'sort'}
        title="Sort by"
        options={SORT_OPTIONS}
        selectedKey={filters.sort}
        onSelect={(key) => update({ sort: key as MarketplaceFilters['sort'] })}
        onClose={() => setPicker(null)}
        testID="p2p-sort-picker"
      />
    </Screen>
  );
}
