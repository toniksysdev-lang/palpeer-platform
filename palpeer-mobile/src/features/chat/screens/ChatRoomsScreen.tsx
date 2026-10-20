import { router } from 'expo-router';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { badgeLabel } from '@/features/notifications/logic';
import { useTheme } from '@/providers/ThemeProvider';
import { useGetChatRoomsQuery, useGetChatUnreadCountQuery } from '@/services/api/chatApi';
import { toAppError } from '@/services/api/errors';
import { useGetMyOrdersQuery } from '@/services/api/p2pApi';
import { palette } from '@/theme/colors';
import { formatDateTime } from '@/utils/datetime';

import { orderPairLabel } from '../logic';

/** One conversation per P2P order or negotiation, with per-room unread badges. */
export function ChatRoomsScreen() {
  const theme = useTheme();
  const rooms = useGetChatRoomsQuery();
  const unread = useGetChatUnreadCountQuery();
  const orders = useGetMyOrdersQuery();

  let body;
  if (rooms.error && !rooms.data) {
    body = <ErrorState error={toAppError(rooms.error)} onRetry={() => void rooms.refetch()} />;
  } else if (!rooms.data) {
    body = (
      <View style={{ gap: theme.spacing.md }} testID="chat-rooms-loading">
        <Skeleton height={72} />
        <Skeleton height={72} />
      </View>
    );
  } else if (rooms.data.length === 0) {
    body = (
      <EmptyState
        icon={MessageCircle}
        title="No conversations yet"
        message="Open a P2P negotiation or order and tap Message to talk to the other person."
      />
    );
  } else {
    body = rooms.data.map((room) => {
      const order = orders.data?.find((item) => item.id === room.p2pOrderId);
      const title = room.negotiationId
        ? 'Negotiation chat'
        : orderPairLabel(order);
      const unreadText = badgeLabel(room.unreadCount);
      return (
        <Card
          key={room.id}
          variant="outlined"
          padding="md"
          onPress={() => router.push({ pathname: '/chat/[roomId]', params: { roomId: room.id } })}
          accessibilityLabel={
            unreadText
              ? `Conversation about ${title}, ${room.unreadCount} unread`
              : `Conversation about ${title}`
          }
          testID={`chat-room-${room.id}`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon icon={MessageCircle} color={theme.colors.primary} />
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <AppText variant="bodyStrong">{title}</AppText>
              <AppText variant="caption" tone="muted">
                Started {formatDateTime(room.createdAt) ?? ''}
              </AppText>
            </View>
            {unreadText ? (
              <View
                testID={`chat-room-unread-${room.id}`}
                style={{
                  minWidth: 18,
                  minHeight: 18,
                  paddingHorizontal: 5,
                  borderRadius: 9,
                  backgroundColor: theme.colors.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AppText
                  variant="caption"
                  maxFontSizeMultiplier={1.3}
                  style={{ color: palette.neutral0, fontSize: 11, lineHeight: 14 }}
                >
                  {unreadText}
                </AppText>
              </View>
            ) : null}
            {order ? <StatusBadge status={order.status} /> : null}
            <Icon icon={ChevronRight} color={theme.colors.textMuted} />
          </View>
        </Card>
      );
    });
  }

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={rooms.isFetching && !rooms.isLoading}
          onRefresh={() => {
            void rooms.refetch();
            void unread.refetch();
            void orders.refetch();
          }}
          tintColor={theme.colors.primary}
        />
      }
    >
      <AppText variant="h1" accessibilityRole="header">
        Messages
      </AppText>
      {rooms.error && rooms.data ? (
        <FormAlert tone="warning" message="Couldn't refresh. Pull down to try again." />
      ) : null}
      <View style={{ gap: theme.spacing.md }}>{body}</View>
    </Screen>
  );
}
