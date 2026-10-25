import { skipToken } from '@reduxjs/toolkit/query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ReviewRow } from '@/features/wallets/components/ReviewRow';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { useOpenChatRoomMutation } from '@/services/api/chatApi';
import { toAppError } from '@/services/api/errors';
import {
  useDeleteOrderMutation,
  useGetOrderQuery,
  useGetRequestQuery,
} from '@/services/api/p2pApi';
import type { P2PStatus } from '@/types/api/p2p';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';

import { FlippableRateLine } from '../components/FlippableRateLine';
import { NoSettlementNotice } from '../components/NoSettlementNotice';
import { requestActionErrorMessage } from '../errors';
import { canDeleteOrder, canMessageOrder, orderRole } from '../logic';

function statusMessage(status: P2PStatus | string): string {
  switch (status) {
    case 'ACCEPTED':
      return 'This order was matched. Wallet settlement should complete momentarily.';
    case 'COMPLETED':
      return 'Trade settled. Base currency moved to the buyer and quote currency to the seller.';
    case 'CANCELLED':
      return 'This order was cancelled. Any sell hold was returned to the seller.';
    default:
      return '';
  }
}

export function OrderDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAppSelector((state) => state.session.userId);
  const { format } = useMoneyFormat();
  const order = useGetOrderQuery(id);
  // The order has no currency codes; they come from its request.
  const request = useGetRequestQuery(order.data?.requestId ?? skipToken);
  const [openRoom, chatState] = useOpenChatRoomMutation();
  const [remove, removeState] = useDeleteOrderMutation();
  const [chatError, setChatError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const header = (
    <StackHeader
      title="P2P order"
      onBack={() =>
        router.canGoBack()
          ? router.back()
          : router.replace({ pathname: '/p2p/history', params: { tab: 'orders' } })
      }
    />
  );

  const failed = (order.error && !order.data) || (request.error && !request.data);
  if (failed) {
    const retry = () => {
      void order.refetch();
      if (order.data) void request.refetch();
    };
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(order.error ?? request.error)} onRetry={retry} />
      </Screen>
    );
  }
  if (!order.data || !request.data) {
    return (
      <Screen>
        {header}
        <Skeleton height={240} />
      </Screen>
    );
  }

  const data = order.data;
  const base = request.data.baseCurrencyCode;
  const quote = request.data.quoteCurrencyCode;
  const role = orderRole(data, userId);
  const message = statusMessage(data.status);
  const deletable = canDeleteOrder(data, userId);
  const messagingEnabled = canMessageOrder(data, userId);

  const openChat = async () => {
    if (!messagingEnabled) return;
    setChatError(null);
    const result = await openRoom({ p2pOrderId: data.id });
    if ('error' in result) {
      setChatError(toAppError(result.error).message);
      return;
    }
    router.push({ pathname: '/chat/[roomId]', params: { roomId: result.data.id } });
  };

  const runDelete = async () => {
    setActionError(null);
    const result = await remove(data.id);
    setConfirmDelete(false);
    if ('error' in result) {
      setActionError(requestActionErrorMessage(toAppError(result.error)));
      return;
    }
    router.replace({ pathname: '/p2p/history', params: { tab: 'orders' } });
  };

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={order.isFetching && !order.isLoading}
          onRefresh={() => {
            void order.refetch();
            void request.refetch();
          }}
          tintColor={theme.colors.primary}
        />
      }
      footer={
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Message"
            onPress={() => void openChat()}
            loading={chatState.isLoading}
            disabled={!messagingEnabled}
            testID="p2p-order-chat"
          />
          {!messagingEnabled ? (
            <AppText variant="caption" tone="secondary" testID="p2p-order-chat-closed">
              Messaging is closed for completed orders.
            </AppText>
          ) : null}
          <Button
            label="View request"
            variant="outline"
            onPress={() =>
              router.push({ pathname: '/p2p/request/[id]', params: { id: data.requestId } })
            }
            testID="p2p-order-request"
          />
          {deletable ? (
            <Button
              label="Delete from history"
              variant="danger"
              onPress={() => setConfirmDelete(true)}
              loading={removeState.isLoading}
              testID="p2p-delete-order"
            />
          ) : null}
        </View>
      }
    >
      {header}
      <FormAlert message={chatError} testID="p2p-order-chat-error" />
      <FormAlert message={actionError} testID="p2p-order-action-error" />
      <View style={{ gap: theme.spacing.xs }}>
        <StatusBadge status={data.status} testID="p2p-order-status" />
        <AppText variant="h2">
          {base}/{quote}
        </AppText>
        <AppText tone="secondary" testID="p2p-order-role">
          {role === 'acceptor' ? 'You accepted this request' : 'Your request was accepted'}
        </AppText>
      </View>
      {message ? <AppText testID="p2p-order-message">{message}</AppText> : null}
      {order.error ? (
        <FormAlert tone="warning" message="Couldn't refresh the order. Pull down to try again." />
      ) : null}
      <Card variant="outlined" padding="md">
        <ReviewRow label="Amount" value={format(data.amount, base)} testID="p2p-order-amount" />
        <View style={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.sm }}>
          <AppText tone="secondary">Rate</AppText>
          <FlippableRateLine
            rate={data.rate}
            base={base}
            quote={quote}
            variant="bodyStrong"
            tone="primary"
            full
            maxDecimals={12}
            testID="p2p-order-rate"
          />
        </View>
        <ReviewRow label="Created" value={formatDateTime(data.createdAt) ?? '—'} />
      </Card>
      <NoSettlementNotice />
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete from history?"
        message="This cancelled order will be removed from your P2P history. The other party can still see it until they delete it too."
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        loading={removeState.isLoading}
        onConfirm={() => void runDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}
