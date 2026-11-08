import { useRouter } from 'expo-router';
import { Gift, Users } from 'lucide-react-native';
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
  useGetMyLoyaltyPointsBalanceQuery,
  useGetMyLoyaltyPointsLedgerInfiniteQuery,
} from '@/services/api/promotionApi';
import { formatDateTime } from '@/utils/datetime';

import {
  emptyPointsBalance,
  formatPoints,
  pointsEntryLabel,
  pointsEntryTone,
} from '../logic';

/**
 * Loyalty points ledger — CAD referral bonuses as points (100 pts = CA$1).
 * Admin sets the CAD bonus on REFERRAL promotions; this screen shows the ledger.
 */
export function PointsLedgerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { format } = useMoneyFormat();
  const balanceQ = useGetMyLoyaltyPointsBalanceQuery();
  const ledgerQ = useGetMyLoyaltyPointsLedgerInfiniteQuery();
  const header = <StackHeader title="My points" />;
  const balance = balanceQ.data ?? emptyPointsBalance();
  const entries = ledgerQ.data?.pages.flatMap((page) => page.content) ?? [];

  if (!ledgerQ.data && !ledgerQ.error) {
    return (
      <Screen>
        {header}
        {balanceQ.isLoading || ledgerQ.isLoading ? <Skeleton height={120} /> : null}
      </Screen>
    );
  }

  if (ledgerQ.error && entries.length === 0) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(ledgerQ.error)} onRetry={() => void ledgerQ.refetch()} />
      </Screen>
    );
  }

  const refresh = () => {
    void balanceQ.refetch();
    void ledgerQ.refetch();
  };

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={
            (ledgerQ.isFetching && !ledgerQ.isLoading && !ledgerQ.isFetchingNextPage) ||
            (balanceQ.isFetching && !balanceQ.isLoading)
          }
          onRefresh={refresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      <FormAlert
        tone="info"
        message={`${balance.pointsPerCad} points = ${format('1', balance.currencyCode)}. Earn points when friends join with your invite code. Use them to cut your P2P fee.`}
        testID="points-rule-note"
      />

      <Card variant="elevated" padding="md" testID="points-balance">
        <AppText variant="overline" tone="muted">
          Available
        </AppText>
        <AppText variant="h2" testID="points-balance-points">
          {formatPoints(balance.balancePoints)}
        </AppText>
        <AppText variant="body" tone="secondary" testID="points-balance-cad">
          Worth {format(balance.balanceCad, balance.currencyCode)}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            gap: theme.spacing.md,
            marginTop: theme.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="caption" tone="muted">
              Earned
            </AppText>
            <AppText variant="bodyStrong" testID="points-earned">
              {formatPoints(balance.earnedPoints)}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <AppText variant="caption" tone="muted">
              Used
            </AppText>
            <AppText variant="bodyStrong" testID="points-used">
              {formatPoints(balance.usedPoints)}
            </AppText>
          </View>
        </View>
      </Card>

      <Button
        label="Invite friends to earn more"
        variant="secondary"
        leftIcon={Users}
        onPress={() => router.push('/referrals')}
        testID="points-invite"
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No points yet"
          message="Share your invite code. When a friend joins and passes ID check, you earn points set by Palpeer."
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }} testID="points-ledger">
          <AppText variant="h3">Ledger</AppText>
          {entries.map((entry) => {
            const sign = entry.entryType === 'EARNED' ? '+' : '−';
            return (
              <Card key={entry.id} variant="outlined" padding="md" testID={`points-row-${entry.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                    <AppText variant="bodyStrong" testID={`points-row-${entry.id}-points`}>
                      {sign}
                      {formatPoints(entry.points)}
                    </AppText>
                    <AppText variant="caption" tone="secondary">
                      {entry.reason ?? 'Referral points'} · {formatDateTime(entry.createdAt)}
                    </AppText>
                    <AppText variant="caption" tone="muted">
                      {format(entry.cadAmount, entry.currencyCode)}
                    </AppText>
                  </View>
                  <Badge label={pointsEntryLabel(entry)} tone={pointsEntryTone(entry)} />
                </View>
              </Card>
            );
          })}
          {ledgerQ.hasNextPage ? (
            <Button
              label="Load more"
              variant="ghost"
              onPress={() => void ledgerQ.fetchNextPage()}
              loading={ledgerQ.isFetchingNextPage}
              testID="points-ledger-more"
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}
