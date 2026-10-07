import { router, useLocalSearchParams } from 'expo-router';
import { Snowflake, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextLink } from '@/components/ui/TextLink';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { useTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  useBlockCardMutation,
  useGetCardQuery,
  useGetCardTransactionsInfiniteQuery,
  useUnblockCardMutation,
} from '@/services/api/cardApi';
import { toAppError } from '@/services/api/errors';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import type { CardResponse } from '@/types/api/card';
import { formatDateTime } from '@/utils/datetime';

import { CardTransactionRow } from '../components/CardTransactionRow';
import { CardVisual } from '../components/CardVisual';
import {
  canFreeze,
  canUnfreeze,
  cardErrorMessage,
  cardStatusLabel,
  cardStatusTone,
  cardTitle,
  expiryLabel,
  isTestCard,
  maskedNumber,
} from '../logic';

export function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const card = useGetCardQuery(id);
  const transactions = useGetCardTransactionsInfiniteQuery(id);
  const header = <StackHeader title="Card" />;

  if (!card.data) {
    return (
      <Screen>
        {header}
        {card.error ? (
          <ErrorState
            error={{ ...toAppError(card.error), message: cardErrorMessage(toAppError(card.error)) }}
            onRetry={() => void card.refetch()}
          />
        ) : (
          <>
            <Skeleton height={190} />
            <Skeleton height={56} />
          </>
        )}
      </Screen>
    );
  }

  const items = transactions.data?.pages.flatMap((page) => page.content) ?? [];
  const walletId = card.data.walletId;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={card.isFetching && !card.isLoading}
          onRefresh={() => {
            void card.refetch();
            void transactions.refetch();
          }}
          tintColor={theme.colors.primary}
        />
      }
    >
      {header}
      <CardVisual card={card.data} />
      <FreezeControls card={card.data} />

      <Card variant="outlined" padding="md">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText variant="h3" style={{ flex: 1 }}>
            {cardTitle(card.data)}
          </AppText>
          <Badge
            label={cardStatusLabel(card.data.status)}
            tone={cardStatusTone(card.data.status)}
            testID="card-status"
          />
        </View>
        <ReviewRow label="Number" value={maskedNumber(card.data.lastFour)} />
        <ReviewRow label="Expires" value={expiryLabel(card.data)} />
        {card.data.cardholderName ? (
          <ReviewRow label="Name on card" value={card.data.cardholderName} />
        ) : null}
        <ReviewRow label="Currency" value={card.data.currencyCode} />
        <ReviewRow
          label="Linked wallet"
          value={card.data.walletId ? `${card.data.currencyCode} wallet` : 'None'}
          testID="card-linked-wallet"
        />
        <ReviewRow label="Issued" value={formatDateTime(card.data.createdAt) ?? '—'} />
        {walletId ? (
          <TextLink
            label="Open linked wallet"
            onPress={() => router.push({ pathname: '/wallet/[id]', params: { id: walletId } })}
          />
        ) : null}
      </Card>

      {isTestCard(card.data) ? (
        <FormAlert
          tone="info"
          message="This is a test card from a placeholder issuer. It can't be used for real payments."
          testID="card-test-notice"
        />
      ) : null}
      <FormAlert
        tone="info"
        message="Adding money to a card and moving money back to a wallet aren't available yet."
        testID="card-funding-unavailable"
      />

      <AppText variant="h3">Transactions</AppText>
      {transactions.error && items.length === 0 ? (
        <ErrorState
          error={toAppError(transactions.error)}
          onRetry={() => void transactions.refetch()}
        />
      ) : transactions.isLoading ? (
        <Skeleton height={64} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No card transactions yet"
          message="Payments made with this card show here."
        />
      ) : (
        <View style={{ gap: theme.spacing.sm }} testID="card-transactions">
          {items.map((item) => (
            <CardTransactionRow key={item.id} transaction={item} />
          ))}
          {transactions.hasNextPage ? (
            <Button
              label="Load more"
              variant="ghost"
              onPress={() => void transactions.fetchNextPage()}
              loading={transactions.isFetchingNextPage}
              testID="card-transactions-more"
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/** Freeze needs only a confirmation; unfreezing re-enables spending, so it also asks for the PIN. */
function FreezeControls({ card }: { card: CardResponse }) {
  const toast = useToast();
  const pinStatus = useGetPinStatusQuery();
  const { requestPin } = usePinPrompt();
  const [blockCard, blockState] = useBlockCardMutation();
  const [unblockCard, unblockState] = useUnblockCardMutation();
  const [dialog, setDialog] = useState<'freeze' | 'unfreeze' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canFreeze(card) && !canUnfreeze(card)) return null;

  const freeze = async () => {
    setError(null);
    const result = await blockCard(card.id);
    setDialog(null);
    if ('error' in result) {
      setError(cardErrorMessage(toAppError(result.error)));
      return;
    }
    toast.show({ type: 'success', title: 'Card frozen' });
  };

  const unfreeze = async () => {
    setError(null);
    if (!pinStatus.data) {
      setDialog(null);
      setError("We couldn't check your PIN status. Try again.");
      void pinStatus.refetch();
      return;
    }
    if (pinStatus.data.pinSet) {
      setDialog(null);
      const confirmed = await requestPin({
        title: 'Unfreeze card',
        message: `Enter your PIN to unfreeze the card ending ${card.lastFour}.`,
      });
      if (!confirmed) return;
    }
    const result = await unblockCard(card.id);
    setDialog(null);
    if ('error' in result) {
      setError(cardErrorMessage(toAppError(result.error)));
      return;
    }
    toast.show({ type: 'success', title: 'Card unfrozen' });
  };

  return (
    <View style={{ gap: 8 }}>
      <FormAlert message={error} testID="card-action-error" />
      {canFreeze(card) ? (
        <Button
          label="Freeze card"
          variant="outline"
          leftIcon={Snowflake}
          onPress={() => setDialog('freeze')}
          testID="card-freeze"
        />
      ) : (
        <Button
          label="Unfreeze card"
          leftIcon={Sun}
          onPress={() => setDialog('unfreeze')}
          loading={unblockState.isLoading}
          testID="card-unfreeze"
        />
      )}
      <ConfirmDialog
        visible={dialog === 'freeze'}
        title="Freeze this card?"
        message="The card stays frozen until you unfreeze it. You can do that at any time."
        confirmLabel="Freeze card"
        destructive
        loading={blockState.isLoading}
        onConfirm={() => void freeze()}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'unfreeze'}
        title="Unfreeze this card?"
        message="The card will be active again."
        confirmLabel="Unfreeze card"
        loading={unblockState.isLoading}
        onConfirm={() => void unfreeze()}
        onCancel={() => setDialog(null)}
      />
    </View>
  );
}
