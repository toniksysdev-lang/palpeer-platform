import { Gift } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { toAppError } from '@/services/api/errors';
import {
  useGetMyBonusSummaryQuery,
  useGetMyBonusesInfiniteQuery,
} from '@/services/api/promotionApi';
import { formatDateTime } from '@/utils/datetime';

import { bonusStatusLabel, bonusStatusTone, summarizeBonuses } from '../logic';

/** Referral bonuses credited to wallets; pending ones may await invitee trade or P2P fee apply. */
export function BonusesScreen() {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const bonuses = useGetMyBonusesInfiniteQuery();
  const summary = useGetMyBonusSummaryQuery();
  const header = <StackHeader title="My bonuses" />;
  const items = bonuses.data?.pages.flatMap((page) => page.content) ?? [];
  // Prefer the summary API (all pages). Fall back to loaded history when it fails or is empty.
  const apiSummary = Array.isArray(summary.data) ? summary.data : [];
  const summaryRows = apiSummary.length > 0 ? apiSummary : summarizeBonuses(items);

  if (!bonuses.data) {
    return (
      <Screen>
        {header}
        {bonuses.error ? (
          <ErrorState error={toAppError(bonuses.error)} onRetry={() => void bonuses.refetch()} />
        ) : (
          <Skeleton height={72} />
        )}
      </Screen>
    );
  }

  const refresh = () => {
    void bonuses.refetch();
    void summary.refetch();
  };

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={
            (bonuses.isFetching && !bonuses.isLoading && !bonuses.isFetchingNextPage) ||
            (summary.isFetching && !summary.isLoading)
          }
          onRefresh={refresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      <FormAlert
        tone="info"
        message="Unused is still pending. Used includes bonuses already credited to your wallet or applied to a P2P fee."
        testID="bonuses-pending-note"
      />

      {summaryRows.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }} testID="bonuses-summary">
          <AppText variant="h3">By wallet</AppText>
          {summaryRows.map((row) => (
            <Card
              key={row.currencyCode}
              variant="elevated"
              padding="md"
              testID={`bonus-stat-${row.currencyCode}`}
            >
              <AppText variant="overline" tone="muted">
                {row.currencyCode} wallet
              </AppText>
              <AppText variant="h2" testID={`bonus-stat-${row.currencyCode}-total`}>
                {format(row.totalAmount, row.currencyCode)}
              </AppText>
              <AppText variant="caption" tone="secondary" style={{ marginBottom: theme.spacing.sm }}>
                Total bonus
              </AppText>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText variant="caption" tone="muted">
                    Unused
                  </AppText>
                  <AppText variant="bodyStrong" testID={`bonus-stat-${row.currencyCode}-unused`}>
                    {format(row.unusedAmount, row.currencyCode)}
                  </AppText>
                </View>
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText variant="caption" tone="muted">
                    Used
                  </AppText>
                  <AppText variant="bodyStrong" testID={`bonus-stat-${row.currencyCode}-used`}>
                    {format(row.usedAmount, row.currencyCode)}
                  </AppText>
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No bonuses yet"
          message="Bonuses from referral promotions show here. Apply a friend's code under Invite friends."
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="h3">History</AppText>
          {items.map((bonus) => (
            <Card key={bonus.id} variant="outlined" padding="md" testID={`bonus-${bonus.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                  <AppText variant="bodyStrong" testID={`bonus-${bonus.id}-amount`}>
                    {format(bonus.amount, bonus.currencyCode)}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    {bonus.reason ?? 'Bonus'} · {formatDateTime(bonus.createdAt)}
                  </AppText>
                </View>
                <Badge
                  label={bonusStatusLabel(bonus.status)}
                  tone={bonusStatusTone(bonus.status)}
                />
              </View>
            </Card>
          ))}
          {bonuses.hasNextPage ? (
            <Button
              label="Load more"
              variant="ghost"
              onPress={() => void bonuses.fetchNextPage()}
              loading={bonuses.isFetchingNextPage}
              testID="bonuses-more"
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}
