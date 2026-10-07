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
import { useGetMyBonusesInfiniteQuery } from '@/services/api/promotionApi';
import { formatDateTime } from '@/utils/datetime';

import { bonusStatusLabel, bonusStatusTone } from '../logic';

/** Bonuses aren't credited to wallets yet, so pending ones are never shown as spendable (R-RF-2). */
export function BonusesScreen() {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const bonuses = useGetMyBonusesInfiniteQuery();
  const header = <StackHeader title="My bonuses" />;
  const items = bonuses.data?.pages.flatMap((page) => page.content) ?? [];

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

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={bonuses.isFetching && !bonuses.isLoading && !bonuses.isFetchingNextPage}
          onRefresh={() => void bonuses.refetch()}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      <FormAlert
        tone="info"
        message="Pending bonuses haven't been added to your wallet and can't be spent yet."
        testID="bonuses-pending-note"
      />
      {items.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No bonuses yet"
          message="Bonuses from referral promotions show here."
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
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
