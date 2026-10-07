import { router } from 'expo-router';
import { Megaphone } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
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
import { useGetActivePromotionsQuery } from '@/services/api/promotionApi';

import { promotionPeriod, promotionTypeLabel } from '../logic';

/** Active promotions for everyone; there's no eligibility check in the backend (PR-1). */
export function PromotionsScreen() {
  const theme = useTheme();
  const { format } = useMoneyFormat();
  const promotions = useGetActivePromotionsQuery();
  const header = <StackHeader title="Promotions" />;

  if (!promotions.data) {
    return (
      <Screen>
        {header}
        {promotions.error ? (
          <ErrorState
            error={toAppError(promotions.error)}
            onRetry={() => void promotions.refetch()}
          />
        ) : (
          <Skeleton height={96} />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={promotions.isFetching && !promotions.isLoading}
          onRefresh={() => void promotions.refetch()}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      {promotions.data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No promotions right now"
          message="Check back later for new offers."
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {promotions.data.map((promotion) => {
            const period = promotionPeriod(promotion);
            return (
              <Card
                key={promotion.id}
                variant="outlined"
                padding="lg"
                testID={`promotion-${promotion.id}`}
              >
                <View style={{ gap: theme.spacing.sm }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
                  >
                    <AppText variant="h3" style={{ flex: 1 }}>
                      {promotion.title}
                    </AppText>
                    <Badge label={promotionTypeLabel(promotion.promotionType)} tone="info" />
                  </View>
                  {promotion.description ? (
                    <AppText tone="secondary">{promotion.description}</AppText>
                  ) : null}
                  {promotion.bonusAmount && promotion.bonusCurrencyCode ? (
                    <AppText variant="bodyStrong" testID={`promotion-${promotion.id}-bonus`}>
                      Bonus: {format(promotion.bonusAmount, promotion.bonusCurrencyCode)}
                    </AppText>
                  ) : null}
                  {period ? (
                    <AppText variant="caption" tone="muted">
                      {period}
                    </AppText>
                  ) : null}
                  {promotion.promotionType === 'REFERRAL' ? (
                    <Button
                      label="Invite friends"
                      variant="outline"
                      onPress={() => router.push('/referrals')}
                      testID={`promotion-${promotion.id}-invite`}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
