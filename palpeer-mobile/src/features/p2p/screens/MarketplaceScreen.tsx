import { router } from 'expo-router';
import { Plus, Search, Store } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppModal } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { PickerField, PickerSheet } from '@/features/exchange/components/PickerSheet';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useNow } from '@/hooks/useNow';
import { useT } from '@/i18n/useT';
import { useToast } from '@/providers/ToastProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import { useCancelRequestMutation, useGetOpenRequestsQuery } from '@/services/api/p2pApi';
import { useAppSelector } from '@/store';


import {
  PalpeerRatePopup,
  type PalpeerRateOfferSummary,
} from '../components/PalpeerRatePopup';
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
  const toast = useToast();
  const t = useT();
  const now = useNow();
  const { requestPin } = usePinPrompt();
  const userId = useAppSelector((state) => state.session.userId);
  const requests = useGetOpenRequestsQuery();
  const [cancelRequest] = useCancelRequestMutation();
  const [filters, setFilters] = useState<MarketplaceFilters>(DEFAULT_FILTERS);
  const [picker, setPicker] = useState<'currency' | 'sort' | null>(null);
  const [seenRateOffers, setSeenRateOffers] = useState(() => new Set<string>());
  const [doneOffer, setDoneOffer] = useState<PalpeerRateOfferSummary | null>(null);

  const list = requests.data;
  const visible = useMemo(() => (list ? filterRequests(list, filters) : []), [list, filters]);
  const currencies = useMemo(() => (list ? currenciesIn(list) : []), [list]);
  const update = (changes: Partial<MarketplaceFilters>) =>
    setFilters((current) => ({ ...current, ...changes }));
  const filtering = activeFilterCount(filters) > 0 || filters.search.trim() !== '';

  /** Seller's own open offer within 30 minutes of expiry → Palpeer rate popup. */
  const rateOffer = useMemo((): PalpeerRateOfferSummary | null => {
    if (!list || !userId) return null;
    const mine = list.find(
      (row) =>
        row.userId === userId &&
        row.status === 'OPEN' &&
        row.side === 'SELL' &&
        !!row.expiresAt,
    );
    if (!mine?.expiresAt) return null;
    const sellerRate = Number(mine.rate);
    const amountLeft = Number(mine.amount);
    if (!Number.isFinite(sellerRate) || !Number.isFinite(amountLeft)) return null;
    // Prototype uses a slightly better admin rate than the seller's posted rate.
    const palpeerRate = Math.max(sellerRate * 1.02, sellerRate + 1);
    return {
      id: mine.id,
      sellerRate,
      palpeerRate,
      amountLeft,
      sourceCurrency: mine.baseCurrencyCode,
      targetCurrency: mine.quoteCurrencyCode,
      expiresAt: mine.expiresAt,
    };
  }, [list, userId, now]);

  const createRequest = () => router.push('/p2p/create');

  const acceptPalpeerRate = async (offer: PalpeerRateOfferSummary): Promise<boolean> => {
    const confirmed = await requestPin({
      title: t('palpeerRate.pinTitle'),
      message: t('palpeerRate.pinMessage'),
    });
    if (!confirmed) return false;

    const result = await cancelRequest(offer.id);
    if ('error' in result) {
      toast.show({ type: 'error', title: t('palpeerRate.failed') });
      return false;
    }

    setDoneOffer(offer);
    return true;
  };

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      <AppText variant="h1" accessibilityRole="header" style={{ flex: 1 }}>
        {t('p2p.choosePerson')}
      </AppText>
      <IconButton
        icon={Plus}
        accessibilityLabel="Make my offer"
        onPress={createRequest}
        variant="filled"
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
        title="No open offers"
        message="Be the first to post an offer to buy or sell a currency."
        actionLabel="Make my offer"
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
      <PalpeerRatePopup
        offer={rateOffer}
        seenOfferIds={seenRateOffers}
        onSeen={(id) => setSeenRateOffers((current) => new Set(current).add(id))}
        onAccept={acceptPalpeerRate}
      />
      <AppModal
        visible={!!doneOffer}
        onClose={() => setDoneOffer(null)}
        title={t('palpeerRate.doneTitle')}
        testID="palpeer-rate-done"
      >
        <AppText tone="secondary">
          {t('palpeerRate.doneBody', {
            amount: doneOffer
              ? `${doneOffer.sourceCurrency}${doneOffer.amountLeft.toLocaleString()}`
              : '',
          })}
        </AppText>
        <Button
          label={t('palpeerRate.changeNow')}
          onPress={() => {
            setDoneOffer(null);
            router.push('/exchange');
          }}
          testID="palpeer-rate-change-now"
        />
      </AppModal>
    </Screen>
  );
}
