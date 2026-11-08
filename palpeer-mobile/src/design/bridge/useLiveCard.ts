import { useCallback, useMemo } from 'react';
import { router } from 'expo-router';

import {
  canFreeze,
  canUnfreeze,
  cardErrorMessage,
  cardStatusLabel,
  cardTitle,
  cardTransactionTypeLabel,
  expiryLabel,
  isCardCredit,
  isTestCard,
  maskedNumber,
} from '@/features/cards/logic';
import { usePinPrompt } from '@/features/security/PinPromptProvider';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useToast } from '@/providers/ToastProvider';
import {
  useBlockCardMutation,
  useGetCardQuery,
  useGetCardTransactionsInfiniteQuery,
  useUnblockCardMutation,
} from '@/services/api/cardApi';
import { toAppError } from '@/services/api/errors';
import { useGetPinStatusQuery } from '@/services/api/securityApi';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';

export type CardDetailRow = { label: string; value: string };
export type CardTxnRow = {
  id: string;
  title: string;
  note: string;
  amountLabel: string;
  credit: boolean;
  statusLabel: string;
};

/** Live props for the design Card (detail + history) screen. */
export function useLiveCard(cardId?: string) {
  const id = cardId?.trim() || '';
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const toast = useToast();
  const { format } = useMoneyFormat();
  const { requestPin } = usePinPrompt();
  const pinStatus = useGetPinStatusQuery(undefined, { skip: !authenticated });
  const cardQ = useGetCardQuery(id, { skip: !authenticated || !id });
  const txQ = useGetCardTransactionsInfiniteQuery(id, { skip: !authenticated || !id });
  const [blockCard, blockState] = useBlockCardMutation();
  const [unblockCard, unblockState] = useUnblockCardMutation();

  const card = cardQ.data;
  const loading = !!id && !card && cardQ.isLoading;
  const error = cardQ.error
    ? cardErrorMessage(toAppError(cardQ.error))
    : !id
      ? 'Card not found.'
      : null;

  const detailRows: CardDetailRow[] = useMemo(() => {
    if (!card) return [];
    const rows: CardDetailRow[] = [
      { label: 'Number', value: maskedNumber(card.lastFour) },
      { label: 'Expires', value: expiryLabel(card) },
    ];
    if (card.cardholderName) rows.push({ label: 'Name on card', value: card.cardholderName });
    rows.push(
      { label: 'Currency', value: card.currencyCode },
      {
        label: 'Linked wallet',
        value: card.walletId ? `${card.currencyCode} wallet` : 'None',
      },
      { label: 'Issued', value: formatDateTime(card.createdAt) ?? '—' },
    );
    return rows;
  }, [card]);

  const transactions: CardTxnRow[] = useMemo(() => {
    const items = txQ.data?.pages.flatMap((page) => page.content) ?? [];
    return items.map((tx) => {
      const credit = isCardCredit(tx);
      const amount = format(tx.amount, tx.currencyCode);
      return {
        id: tx.id,
        title: tx.merchantName || cardTransactionTypeLabel(tx.entryType),
        note: `${cardTransactionTypeLabel(tx.entryType)} · ${formatDateTime(tx.occurredAt) ?? ''}${
          tx.failureReason ? ` · ${tx.failureReason}` : ''
        }`,
        amountLabel: credit ? `+${amount}` : amount,
        credit,
        statusLabel: tx.status,
      };
    });
  }, [format, txQ.data?.pages]);

  const onFreeze = useCallback(async () => {
    if (!card || !canFreeze(card)) return;
    try {
      await blockCard(card.id).unwrap();
      toast.show({ type: 'success', title: 'Card frozen' });
    } catch (raw) {
      toast.show({ type: 'error', title: cardErrorMessage(toAppError(raw)) });
    }
  }, [blockCard, card, toast]);

  const onUnfreeze = useCallback(async () => {
    if (!card || !canUnfreeze(card)) return;
    if (!pinStatus.data) {
      toast.show({ type: 'error', title: "We couldn't check your PIN status. Try again." });
      void pinStatus.refetch();
      return;
    }
    if (pinStatus.data.pinSet) {
      const confirmed = await requestPin({
        title: 'Unfreeze card',
        message: `Enter your PIN to unfreeze the card ending ${card.lastFour}.`,
      });
      if (!confirmed) return;
    }
    try {
      await unblockCard(card.id).unwrap();
      toast.show({ type: 'success', title: 'Card unfrozen' });
    } catch (raw) {
      toast.show({ type: 'error', title: cardErrorMessage(toAppError(raw)) });
    }
  }, [card, pinStatus, requestPin, toast, unblockCard]);

  const onLoadMore = useCallback(() => {
    if (txQ.hasNextPage && !txQ.isFetchingNextPage) {
      void txQ.fetchNextPage();
    }
  }, [txQ]);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/More');
  }, []);

  const onRetry = useCallback(() => {
    void cardQ.refetch();
    void txQ.refetch();
  }, [cardQ, txQ]);

  return {
    backend: true as const,
    loading,
    error,
    headline: card ? cardTitle(card) : 'My card',
    statusLabel: card ? cardStatusLabel(card.status) : '',
    faceLine: card ? `${card.brand} ···· ${card.lastFour}` : '',
    currencyLine: card ? card.currencyCode : '',
    detailRows,
    testNotice: card && isTestCard(card)
      ? "This is a test card from a placeholder issuer. It can't be used for real payments."
      : '',
    fundingNotice: 'Adding money to a card and moving money back to a wallet are not available yet.',
    canFreeze: card ? canFreeze(card) : false,
    canUnfreeze: card ? canUnfreeze(card) : false,
    freezeBusy: blockState.isLoading,
    unfreezeBusy: unblockState.isLoading,
    transactions,
    txEmpty: !txQ.isLoading && transactions.length === 0 && !txQ.error,
    txLoading: txQ.isLoading,
    txError: txQ.error && transactions.length === 0 ? toAppError(txQ.error).message : null,
    hasMore: !!txQ.hasNextPage,
    loadingMore: txQ.isFetchingNextPage,
    onFreeze,
    onUnfreeze,
    onLoadMore,
    onBack,
    onRetry,
  };
}
