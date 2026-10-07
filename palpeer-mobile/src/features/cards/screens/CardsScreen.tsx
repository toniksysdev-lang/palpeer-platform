import { router } from 'expo-router';
import { CreditCard, Plus } from 'lucide-react-native';
import { Pressable, RefreshControl, View } from 'react-native';

import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetCardsQuery } from '@/services/api/cardApi';
import { toAppError } from '@/services/api/errors';

import { CardVisual } from '../components/CardVisual';
import { cardStatusLabel, cardStatusTone, cardTitle } from '../logic';

export function CardsScreen() {
  const theme = useTheme();
  const cards = useGetCardsQuery();
  const header = (
    <AppText variant="h1" accessibilityRole="header">
      Cards
    </AppText>
  );
  const issue = () => router.push('/cards/create');

  if (!cards.data) {
    return (
      <Screen>
        {header}
        {cards.error ? (
          <ErrorState error={toAppError(cards.error)} onRetry={() => void cards.refetch()} />
        ) : (
          <>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </>
        )}
      </Screen>
    );
  }

  if (cards.data.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={CreditCard}
          title="No cards yet"
          message="Issue a virtual card to see it here."
          actionLabel="Issue a card"
          onAction={issue}
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={cards.isFetching && !cards.isLoading}
          onRefresh={() => void cards.refetch()}
          tintColor={theme.colors.primary}
        />
      }
      footer={
        <Button
          label="Issue a card"
          variant="outline"
          leftIcon={Plus}
          onPress={issue}
          testID="cards-issue"
        />
      }
    >
      {header}
      {cards.error ? (
        <FormAlert
          tone="warning"
          message="Couldn't refresh. Pull down to try again."
          testID="cards-stale"
        />
      ) : null}
      <View style={{ gap: theme.spacing.lg }}>
        {cards.data.map((card) => (
          <Pressable
            key={card.id}
            onPress={() => router.push({ pathname: '/cards/[id]', params: { id: card.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${cardTitle(card)} ending ${card.lastFour}, ${cardStatusLabel(card.status)}`}
            testID={`card-row-${card.id}`}
            style={{ gap: theme.spacing.sm }}
          >
            <CardVisual card={card} compact />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {cardTitle(card)}
              </AppText>
              <Badge label={cardStatusLabel(card.status)} tone={cardStatusTone(card.status)} />
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
