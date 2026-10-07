import { skipToken } from '@reduxjs/toolkit/query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
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
import { useGetOrderQuery, useGetRequestQuery } from '@/services/api/p2pApi';
import type { P2PStatus } from '@/types/api/p2p';
import { useAppSelector } from '@/store';
import { formatDateTime } from '@/utils/datetime';

import { NoSettlementNotice } from '../components/NoSettlementNotice';
import { orderRole, p2pRateLine } from '../logic';

/** Customers can't move an order past ACCEPTED; COMPLETED and CANCELLED are set by Palpeer (R-P-4). */
function statusMessage(status: P2PStatus | string): string {
  switch (status) {
    case 'ACCEPTED':
      return 'The order is open between you and the other person. There are no further steps in the app yet.';
    case 'COMPLETED':
      return 'Palpeer marked this order as completed.';
    case 'CANCELLED':
      return 'Palpeer cancelled this order.';
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
  const [chatError, setChatError] = useState<string | null>(null);

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

  const openChat = async () => {
    setChatError(null);
    const result = await openRoom(data.id);
    if ('error' in result) {
      setChatError(toAppError(result.error).message);
      return;
    }
    router.push({ pathname: '/chat/[roomId]', params: { roomId: result.data.id } });
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
            testID="p2p-order-chat"
          />
          <Button
            label="View request"
            variant="outline"
            onPress={() =>
              router.push({ pathname: '/p2p/request/[id]', params: { id: data.requestId } })
            }
            testID="p2p-order-request"
          />
        </View>
      }
    >
      {header}
      <FormAlert message={chatError} testID="p2p-order-chat-error" />
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
        <ReviewRow
          label="Rate"
          value={p2pRateLine(data.rate, base, quote)}
          testID="p2p-order-rate"
        />
        <ReviewRow label="Created" value={formatDateTime(data.createdAt) ?? '—'} />
      </Card>
      <NoSettlementNotice />
    </Screen>
  );
}
