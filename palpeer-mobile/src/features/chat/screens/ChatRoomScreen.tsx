import { skipToken } from '@reduxjs/toolkit/query';
import { useLocalSearchParams } from 'expo-router';
import { MessageCircle, Send } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useTheme } from '@/providers/ThemeProvider';
import { newIdempotencyKey } from '@/services/api/client';
import {
  applyReadReceipt,
  insertChatMessage,
  useGetChatMessagesInfiniteQuery,
  useGetChatRoomQuery,
  useMarkChatReadMutation,
  useSendChatMessageMutation,
} from '@/services/api/chatApi';
import { toAppError } from '@/services/api/errors';
import { useGetNegotiationQuery } from '@/services/api/negotiationApi';
import { useGetMyOrdersQuery, useGetRequestQuery } from '@/services/api/p2pApi';
import { useRealtimeStatus, useRoomRealtime } from '@/services/websocket/realtime';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  messageConfirmed,
  messageFailed,
  messageQueued,
  messageRetrying,
  type OutboxMessage,
} from '@/store/slices/chatOutboxSlice';
import type { ChatMessageResponse, ChatReadReceipt, ChatRoomResponse } from '@/types/api/chat';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { MessageBubble } from '../components/MessageBubble';
import {
  buildChatItems,
  CHAT_MESSAGE_MAX,
  chatErrorMessage,
  connectionNotice,
  isRetryableReadError,
  NEGOTIATION_PREFILLS,
  negotiationAmountMessage,
  negotiationPairLabel,
  orderPairLabel,
  seenMessageId,
  unreadIncoming,
  type ChatItem,
} from '../logic';

const NO_OUTBOX: OutboxMessage[] = [];
const READ_RETRY_MS = 5_000;

export function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const room = useGetChatRoomQuery(roomId ?? skipToken);
  const orders = useGetMyOrdersQuery();
  const order = orders.data?.find((item) => item.id === room.data?.p2pOrderId);
  const negotiation = useGetNegotiationQuery(room.data?.negotiationId ?? skipToken);
  const request = useGetRequestQuery(negotiation.data?.p2pRequestId ?? skipToken);
  const base = request.data?.baseCurrencyCode;
  const quote = request.data?.quoteCurrencyCode;
  const title = room.data?.negotiationId
    ? negotiationPairLabel(base, quote)
    : room.data
      ? orderPairLabel(order)
      : 'Chat';
  const header = <StackHeader title={title} />;

  if (room.error && !room.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={toAppError(room.error)} onRetry={() => void room.refetch()} />
      </Screen>
    );
  }
  if (!room.data || !roomId) {
    return (
      <Screen>
        {header}
        <Skeleton height={64} />
        <Skeleton height={64} />
      </Screen>
    );
  }
  return (
    <Conversation
      roomId={roomId}
      room={room.data}
      header={header}
      currencyCode={base ?? 'CAD'}
    />
  );
}

function Conversation({
  roomId,
  room: roomData,
  header,
  currencyCode,
}: {
  roomId: string;
  room: ChatRoomResponse;
  header: React.ReactNode;
  currencyCode: string;
}) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const { precision, format } = useMoneyFormat();
  const userId = useAppSelector((state) => state.session.userId);
  const isOnline = useAppSelector((state) => state.network.isOnline);
  const outbox = useAppSelector((state) => state.chatOutbox[roomId] ?? NO_OUTBOX);
  const status = useRealtimeStatus();
  const room = useGetChatRoomQuery(roomId);
  const history = useGetChatMessagesInfiniteQuery(roomId);
  const [send] = useSendChatMessageMutation();
  const [markRead] = useMarkChatReadMutation();
  const [draft, setDraft] = useState('');
  const [amountDraft, setAmountDraft] = useState('');
  const negotiationMode = Boolean(roomData.negotiationId);
  const amountPrecision = precision(currencyCode) ?? 2;

  const { refetch } = history;
  const { refetch: refetchRoom } = room;
  const onMessage = useCallback(
    (message: ChatMessageResponse) => {
      if (message.roomId !== roomId) return;
      dispatch(insertChatMessage(roomId, message));
      if (message.clientMessageId) {
        dispatch(messageConfirmed({ roomId, clientMessageId: message.clientMessageId }));
      }
    },
    [dispatch, roomId],
  );
  const onReceipt = useCallback(
    (receipt: ChatReadReceipt) => dispatch(applyReadReceipt(receipt)),
    [dispatch],
  );
  const [readRetry, setReadRetry] = useState(0);
  const onConnected = useCallback(() => {
    void refetch();
    void refetchRoom();
    setReadRetry((n) => n + 1);
  }, [refetch, refetchRoom]);
  useRoomRealtime(roomId, { onMessage, onReceipt, onConnected });

  const unread = unreadIncoming(history.data?.pages, room.data, userId);
  const reported = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!unread || isOnline === false || reported.current === unread.id) return;
    const messageId = unread.id;
    reported.current = messageId;
    void markRead({ roomId, messageId }).then((result) => {
      if (!('error' in result) || !isRetryableReadError(toAppError(result.error))) return;
      if (reported.current === messageId) reported.current = null;
      setTimeout(() => {
        if (mounted.current) setReadRetry((n) => n + 1);
      }, READ_RETRY_MS);
    });
  }, [unread, isOnline, readRetry, markRead, roomId]);
  const seenId = seenMessageId(history.data?.pages, room.data, userId);

  const deliver = async (clientMessageId: string, content: string) => {
    const result = await send({ roomId, message: { content, clientMessageId } });
    if ('error' in result) {
      dispatch(
        messageFailed({
          roomId,
          clientMessageId,
          error: chatErrorMessage(toAppError(result.error)),
        }),
      );
      return;
    }
    dispatch(insertChatMessage(roomId, result.data));
    dispatch(messageConfirmed({ roomId, clientMessageId }));
  };

  const enqueue = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const clientMessageId = newIdempotencyKey();
    dispatch(
      messageQueued({
        roomId,
        message: {
          clientMessageId,
          content: trimmed,
          queuedAt: new Date().toISOString(),
          status: 'sending',
          error: null,
        },
      }),
    );
    void deliver(clientMessageId, trimmed);
  };

  const submitFreeText = () => {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    enqueue(content);
  };

  const submitAmount = () => {
    if (!isPositiveMoney(amountDraft)) return;
    const money = toMoney(amountDraft);
    setAmountDraft('');
    enqueue(negotiationAmountMessage(format(money, currencyCode)));
  };

  const retry = (item: OutboxMessage) => {
    dispatch(messageRetrying({ roomId, clientMessageId: item.clientMessageId }));
    void deliver(item.clientMessageId, item.content);
  };

  const items = useMemo(
    () => buildChatItems(history.data?.pages, outbox, userId),
    [history.data?.pages, outbox, userId],
  );
  const notice = connectionNotice(status, isOnline);

  const renderItem = ({ item }: { item: ChatItem }) =>
    item.kind === 'message' ? (
      <MessageBubble
        content={item.message.content}
        mine={item.mine}
        createdAt={item.message.createdAt}
        seen={item.message.id === seenId}
        testID={`chat-message-${item.message.id}`}
      />
    ) : (
      <MessageBubble
        content={item.item.content}
        mine
        createdAt={item.item.queuedAt}
        state={item.item.status}
        error={item.item.error}
        onRetry={() => retry(item.item)}
        testID={`chat-outbox-${item.item.clientMessageId}`}
      />
    );

  let body;
  if (history.error && !history.data) {
    body = <ErrorState error={toAppError(history.error)} onRetry={() => void history.refetch()} />;
  } else if (!history.data) {
    body = (
      <View style={{ gap: theme.spacing.md }} testID="chat-loading">
        <Skeleton height={48} />
        <Skeleton height={48} />
      </View>
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={MessageCircle}
        title="No messages yet"
        message={
          negotiationMode
            ? 'Use a suggested message or send an amount to start negotiating.'
            : 'Say hello and agree on the details of your order.'
        }
      />
    );
  } else {
    body = (
      <FlatList
        testID="chat-messages"
        style={{ flex: 1 }}
        inverted
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
        }}
        refreshing={history.isFetching && !history.isFetchingNextPage && !history.isLoading}
        onRefresh={() => void history.refetch()}
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <ActivityIndicator color={theme.colors.primary} testID="chat-loading-older" />
          ) : null
        }
      />
    );
  }

  const canSendFreeText = draft.trim().length > 0;
  const canSendAmount = isPositiveMoney(amountDraft);

  const negotiationFooter = (
    <View style={{ gap: theme.spacing.sm }} testID="chat-negotiation-composer">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm }}
        keyboardShouldPersistTaps="handled"
      >
        {NEGOTIATION_PREFILLS.map((text) => (
          <Pressable
            key={text}
            onPress={() => enqueue(text)}
            accessibilityRole="button"
            accessibilityLabel={text}
            testID={`chat-prefill-${text.slice(0, 12)}`}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              backgroundColor: theme.colors.surface,
              maxWidth: 260,
            }}
          >
            <AppText variant="caption" numberOfLines={2}>
              {text}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AmountInput
            label="Amount"
            value={amountDraft}
            onChangeText={setAmountDraft}
            precision={amountPrecision}
            currencyCode={currencyCode}
            placeholder="0.00"
            testID="chat-amount-input"
          />
        </View>
        <IconButton
          icon={Send}
          accessibilityLabel="Send amount"
          onPress={submitAmount}
          disabled={!canSendAmount}
          testID="chat-send"
        />
      </View>
      <AppText variant="caption" tone="secondary">
        You can only enter an amount in {currencyCode}. Suggested messages send as-is.
      </AppText>
    </View>
  );

  const freeTextFooter = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: theme.spacing.sm,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        paddingLeft: theme.spacing.md,
      }}
    >
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Message"
        placeholderTextColor={theme.colors.textMuted}
        multiline
        maxLength={CHAT_MESSAGE_MAX}
        accessibilityLabel="Message"
        maxFontSizeMultiplier={1.6}
        style={{
          ...theme.typography.body,
          flex: 1,
          maxHeight: 120,
          paddingVertical: theme.spacing.md,
          color: theme.colors.textPrimary,
        }}
        testID="chat-input"
      />
      <IconButton
        icon={Send}
        accessibilityLabel="Send message"
        onPress={submitFreeText}
        disabled={!canSendFreeText}
        testID="chat-send"
      />
    </View>
  );

  return (
    <Screen keyboardAware edges={['top', 'bottom']} footer={negotiationMode ? negotiationFooter : freeTextFooter}>
      {header}
      <FormAlert tone="info" message={notice} testID="chat-connection" />
      {history.error && history.data ? (
        <FormAlert tone="warning" message="Couldn't load new messages. Pull down to try again." />
      ) : null}
      {body}
    </Screen>
  );
}
