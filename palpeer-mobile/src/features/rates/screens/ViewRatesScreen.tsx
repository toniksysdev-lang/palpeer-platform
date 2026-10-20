import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatRateValue } from '@/features/exchange/format';
import { ExpiryCountdown } from '@/features/p2p/components/ExpiryCountdown';
import { FlippableRateLine } from '@/features/p2p/components/FlippableRateLine';
import { useTheme } from '@/providers/ThemeProvider';
import {
  useGetPublicInstantRatesQuery,
  useGetPublicP2PRatesQuery,
} from '@/services/api/currencyApi';
import { toAppError, publicApiErrorMessage, type AppError } from '@/services/api/errors';
import type { PublicInstantRateResponse, PublicP2PRateResponse } from '@/types/api/exchange';
import { formatDateTime } from '@/utils/datetime';
import { formatMoney } from '@/utils/money';

type RatesTab = 'p2p' | 'instant';

const TABS: readonly { value: RatesTab; label: string }[] = [
  { value: 'p2p', label: 'Live P2P Rate' },
  { value: 'instant', label: 'InstantEX Rate' },
];

function PublicErrorState({ error, onRetry }: { error: AppError; onRetry?: () => void }) {
  return (
    <ErrorState
      error={{ ...error, message: publicApiErrorMessage(error) }}
      onRetry={onRetry}
    />
  );
}

/**
 * Public rates board (no sign-in). Live P2P = open marketplace requests;
 * InstantEX = admin-published swap rates.
 */
export function ViewRatesScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<RatesTab>('p2p');
  const p2p = useGetPublicP2PRatesQuery();
  const instant = useGetPublicInstantRatesQuery();

  const refreshing =
    tab === 'p2p'
      ? p2p.isFetching && !p2p.isLoading
      : instant.isFetching && !instant.isLoading;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void p2p.refetch();
            void instant.refetch();
          }}
          tintColor={theme.colors.primary}
        />
      }
    >
      <StackHeader title="View rates" />
      <AppText tone="secondary">
        Browse live P2P offers and InstantEX rates without signing in. Sign in to trade.
      </AppText>
      <SegmentedControl
        options={TABS}
        value={tab}
        onChange={setTab}
        accessibilityLabel="Rate source"
      />
      {tab === 'p2p' ? <LiveP2PRatesPanel query={p2p} /> : <InstantExRatesPanel query={instant} />}
    </Screen>
  );
}

function LiveP2PRatesPanel({
  query,
}: {
  query: ReturnType<typeof useGetPublicP2PRatesQuery>;
}) {
  const theme = useTheme();
  if (query.error && !query.data) {
    return <PublicErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />;
  }
  if (!query.data) {
    return (
      <View style={{ gap: theme.spacing.md }} testID="view-rates-p2p-loading">
        <Skeleton height={100} />
        <Skeleton height={100} />
      </View>
    );
  }
  if (query.data.length === 0) {
    return (
      <EmptyState
        title="No live P2P rates"
        message="Open P2P offers will appear here when users post them."
      />
    );
  }
  return (
    <View style={{ gap: theme.spacing.sm }} testID="view-rates-p2p-list">
      {query.data.map((row: PublicP2PRateResponse) => (
        <PublicP2PRateCard key={row.id} row={row} />
      ))}
    </View>
  );
}

function InstantExRatesPanel({
  query,
}: {
  query: ReturnType<typeof useGetPublicInstantRatesQuery>;
}) {
  const theme = useTheme();
  if (query.error && !query.data) {
    return <PublicErrorState error={toAppError(query.error)} onRetry={() => void query.refetch()} />;
  }
  if (!query.data) {
    return (
      <View style={{ gap: theme.spacing.md }} testID="view-rates-instant-loading">
        <Skeleton height={100} />
        <Skeleton height={100} />
      </View>
    );
  }
  if (query.data.length === 0) {
    return (
      <EmptyState
        title="No InstantEX rates"
        message="Admin-published swap rates will appear here once they're set."
      />
    );
  }
  return (
    <View style={{ gap: theme.spacing.sm }} testID="view-rates-instant-list">
      {query.data.map((row: PublicInstantRateResponse) => (
        <InstantRateCard key={row.id} row={row} />
      ))}
    </View>
  );
}

function PublicP2PRateCard({ row }: { row: PublicP2PRateResponse }) {
  const theme = useTheme();
  const amount = formatMoney(row.amount, { currencyCode: row.baseCurrencyCode });
  return (
    <Card variant="outlined" padding="md" testID={`view-rates-p2p-${row.id}`}>
      <View style={{ gap: theme.spacing.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText variant="bodyStrong" style={{ flexShrink: 1 }}>
            {row.baseCurrencyCode}/{row.quoteCurrencyCode}
          </AppText>
          <Badge label={row.side === 'BUY' ? 'Buy' : 'Sell'} tone="info" />
        </View>
        <AppText variant="h3">{amount}</AppText>
        <FlippableRateLine
          rate={row.rate}
          base={row.baseCurrencyCode}
          quote={row.quoteCurrencyCode}
          testID={`view-rates-p2p-rate-${row.id}`}
        />
        {row.expiresAt ? (
          <ExpiryCountdown
            expiresAt={row.expiresAt}
            testID={`view-rates-p2p-expires-${row.id}`}
          />
        ) : null}
        <AppText variant="caption" tone="muted">
          Posted {formatDateTime(row.createdAt) ?? '—'}
        </AppText>
      </View>
    </Card>
  );
}

function InstantRateCard({ row }: { row: PublicInstantRateResponse }) {
  const theme = useTheme();
  // Admin buy/sell is the platform rail: user Buy = platform Sell, user Sell = platform Buy.
  const userBuyRate = row.sellRate;
  const userSellRate = row.buyRate;
  return (
    <Card variant="outlined" padding="md" testID={`view-rates-instant-${row.id}`}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="bodyStrong">
          {row.baseCurrencyCode}/{row.quoteCurrencyCode}
        </AppText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="caption" tone="muted">
              Buy
            </AppText>
            <AppText variant="h3" testID={`view-rates-instant-buy-${row.id}`}>
              {formatRateValue(userBuyRate)}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="caption" tone="muted">
              Sell
            </AppText>
            <AppText variant="h3" testID={`view-rates-instant-sell-${row.id}`}>
              {formatRateValue(userSellRate)}
            </AppText>
          </View>
        </View>
      </View>
    </Card>
  );
}
