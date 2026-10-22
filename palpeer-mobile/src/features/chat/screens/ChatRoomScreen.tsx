import { skipToken } from '@reduxjs/toolkit/query';
import { router, useLocalSearchParams } from 'expo-router';
import { MessageCircle, Send } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { StackHeader } from '@/components/layout/StackHeader';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { FormAlert } from '@/components/feedback/FormAlert';
import { ConfirmDialog } from '@/components/ui/AppModal';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { PickerField, PickerSheet } from '@/features/exchange/components/PickerSheet';
import { OfferTermsForm } from '@/features/negotiation/components/OfferTermsForm';
import {
  currentOffer,
  isMyTurn,
  negotiationErrorMessage,
  offerAuthor,
} from '@/features/negotiation/logic';
import { useNegotiationRealtime } from '@/features/negotiation/useNegotiationRealtime';
import { FlippableRateLine } from '@/features/p2p/components/FlippableRateLine';
import { effectiveStatus, p2pRateLine, viewerIsP2PBuyer } from '@/features/p2p/logic';
import { useMoneyFormat } from '@/features/wallets/useMoneyFormat';
import { useNow } from '@/hooks/useNow';
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
import {
  useAcceptNegotiationMutation,
  useCounterOfferMutation,
  useGetNegotiationQuery,
} from '@/services/api/negotiationApi';
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
import type { NegotiationResponse } from '@/types/api/negotiation';
import type { P2PRequestResponse } from '@/types/api/p2p';
import { isPositiveMoney, toMoney } from '@/utils/money';

import { useChatReceiveSound } from '../useChatReceiveSound';

import { MessageBubble } from '../components/MessageBubble';
import {
  buildChatItems,
  CHAT_MESSAGE_MAX,
  chatErrorMessage,
  connectionNotice,
  isRetryableReadError,
  negotiationAcceptBothMessage,
  negotiationAcceptFieldMessage,
  negotiationPairLabel,
  negotiationPrefillsFor,
  orderPairLabel,
  prefillUsesAmount,
  prefillUsesRate,
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
  useNegotiationRealtime();
  const base = request.data?.baseCurrencyCode;
  const quote = request.data?.quoteCurrencyCode;
  const title = room.data?.negotiationId
    ? negotiationPairLabel(base, quote)
    : room.data
      ? orderPairLabel(order)
      : 'Chat';
  // Order rooms close when the trade is COMPLETED. Negotiation rooms close for both
  // participants as soon as the offer is accepted (or cancelled) — including the buyer
  // still on this page after the seller accepts.
  const negotiationEnded =
    negotiation.data?.status === 'ACCEPTED' || negotiation.data?.status === 'CANCELLED';
  const orderCompleted =
    Boolean(room.data?.p2pOrderId) && order?.status === 'COMPLETED';
  const messagingClosed = orderCompleted || negotiationEnded;
  const messagingClosedMessage = negotiationEnded
    ? negotiation.data?.status === 'ACCEPTED'
      ? 'This offer was accepted. Messaging is closed on this negotiation.'
      : 'This negotiation has ended. Messaging is closed.'
    : 'Messaging is closed for this completed order.';
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
      messagingClosed={messagingClosed}
      messagingClosedMessage={messagingClosedMessage}
      negotiation={negotiation.data}
      request={request.data}
    />
  );
}

function Conversation({
  roomId,
  room: roomData,
  header,
  messagingClosed,
  messagingClosedMessage,
  negotiation,
  request,
}: {
  roomId: string;
  room: ChatRoomResponse;
  header: React.ReactNode;
  messagingClosed: boolean;
  messagingClosedMessage: string;
  negotiation?: NegotiationResponse;
  request?: P2PRequestResponse;
}) {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.session.userId);
  const isOnline = useAppSelector((state) => state.network.isOnline);
  const outbox = useAppSelector((state) => state.chatOutbox[roomId] ?? NO_OUTBOX);
  const status = useRealtimeStatus();
  const room = useGetChatRoomQuery(roomId);
  const history = useGetChatMessagesInfiniteQuery(roomId);
  const [send] = useSendChatMessageMutation();
  const [markRead] = useMarkChatReadMutation();
  const [draft, setDraft] = useState('');
  const negotiationMode = Boolean(roomData.negotiationId);
  const playReceiveSound = useChatReceiveSound();

  const { refetch } = history;
  const { refetch: refetchRoom } = room;
  const onMessage = useCallback(
    (message: ChatMessageResponse) => {
      if (message.roomId !== roomId) return;
      dispatch(insertChatMessage(roomId, message));
      if (message.clientMessageId) {
        dispatch(messageConfirmed({ roomId, clientMessageId: message.clientMessageId }));
      }
      // Room topic broadcasts to both sides; only chime for the other participant.
      if (userId && message.senderId !== userId) {
        playReceiveSound();
      }
    },
    [dispatch, playReceiveSound, roomId, userId],
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
    if (messagingClosed) return;
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
    if (messagingClosed) return;
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    enqueue(content);
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
  const listRef = useRef<FlatList<ChatItem>>(null);
  const prevCount = useRef(0);

  useEffect(() => {
    if (items.length > prevCount.current) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
    prevCount.current = items.length;
  }, [items.length]);

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
            ? 'Propose an amount and rate, or pick a suggested message to send.'
            : 'Say hello and agree on the details of your order.'
        }
      />
    );
  } else {
    body = (
      <FlatList
        ref={listRef}
        testID="chat-messages"
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (prevCount.current <= 2) listRef.current?.scrollToEnd({ animated: false });
        }}
        refreshing={history.isFetching && !history.isFetchingNextPage && !history.isLoading}
        onRefresh={() => void history.refetch()}
        ListHeaderComponent={
          history.hasNextPage ? (
            <View style={{ paddingVertical: theme.spacing.sm }}>
              {history.isFetchingNextPage ? (
                <ActivityIndicator color={theme.colors.primary} testID="chat-loading-older" />
              ) : (
                <Button
                  label="Load older messages"
                  variant="ghost"
                  onPress={() => void history.fetchNextPage()}
                  testID="chat-load-older"
                />
              )}
            </View>
          ) : null
        }
      />
    );
  }

  const canSendFreeText = !messagingClosed && draft.trim().length > 0;

  const closedFooter = (
    <FormAlert tone="info" message={messagingClosedMessage} testID="chat-messaging-closed" />
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
        opacity: messagingClosed ? 0.6 : 1,
      }}
    >
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Message"
        placeholderTextColor={theme.colors.textMuted}
        multiline
        maxLength={CHAT_MESSAGE_MAX}
        editable={!messagingClosed}
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

  const footer = messagingClosed
    ? closedFooter
    : negotiationMode && negotiation && request
      ? (
          <NegotiationComposer
            negotiation={negotiation}
            request={request}
            userId={userId}
            enqueue={enqueue}
          />
        )
      : freeTextFooter;

  return (
    <Screen keyboardAware edges={['top', 'bottom']} footer={footer}>
      {header}
      <FormAlert tone="info" message={notice} testID="chat-connection" />
      {history.error && history.data ? (
        <FormAlert tone="warning" message="Couldn't load new messages. Pull down to try again." />
      ) : null}
      {body}
    </Screen>
  );
}

function NegotiationComposer({
  negotiation,
  request,
  userId,
  enqueue,
}: {
  negotiation: NegotiationResponse;
  request: P2PRequestResponse;
  userId: string | null;
  enqueue: (content: string) => void;
}) {
  const theme = useTheme();
  const now = useNow();
  const { format } = useMoneyFormat();
  const [counter, counterState] = useCounterOfferMutation();
  const [accept, acceptState] = useAcceptNegotiationMutation();
  const offer = currentOffer(negotiation);
  const myTurn = isMyTurn(negotiation, userId);
  const requestOpen = effectiveStatus(request, now) === 'OPEN';
  const base = request.baseCurrencyCode;
  const quote = request.quoteCurrencyCode;
  const [amountDraft, setAmountDraft] = useState(() => (offer ? toMoney(offer.amount) : ''));
  const [rateDraft, setRateDraft] = useState(() => (offer ? toMoney(offer.rate) : ''));
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAccept, setConfirmAccept] = useState(false);
  const [seededOfferId, setSeededOfferId] = useState<string | null>(null);
  const [prefillKey, setPrefillKey] = useState<string | null>(null);
  const [prefillOpen, setPrefillOpen] = useState(false);

  if (offer && offer.id !== seededOfferId) {
    setSeededOfferId(offer.id);
    setAmountDraft(toMoney(offer.amount));
    setRateDraft(toMoney(offer.rate));
  }

  const open = negotiation.status === 'OPEN';
  const canAct = open && myTurn && requestOpen;
  const ownRequest = userId != null && request.userId === userId;
  const isSeller = !viewerIsP2PBuyer(request.side, ownRequest);
  const availablePrefills = negotiationPrefillsFor({ isSeller, canAct });
  const prefillOptions = availablePrefills.map((item) => ({
    key: item.id,
    title: item.label,
  }));
  const selectedPrefill = availablePrefills.find((item) => item.id === prefillKey) ?? null;
  const amountEditable =
    canAct || (selectedPrefill != null && prefillUsesAmount(selectedPrefill.fields));
  const rateEditable =
    canAct || (selectedPrefill != null && prefillUsesRate(selectedPrefill.fields));
  const canSendPrefill = (() => {
    if (!selectedPrefill) return false;
    if (selectedPrefill.action === 'accept_amount') {
      return canAct && !!offer && isPositiveMoney(rateDraft);
    }
    if (selectedPrefill.action === 'accept_rate') {
      return canAct && !!offer && isPositiveMoney(amountDraft);
    }
    if (selectedPrefill.action === 'accept_both') {
      return canAct && !!offer;
    }
    return (
      (!prefillUsesAmount(selectedPrefill.fields) || isPositiveMoney(amountDraft)) &&
      (!prefillUsesRate(selectedPrefill.fields) || isPositiveMoney(rateDraft))
    );
  })();
  const prefillBusy = counterState.isLoading || acceptState.isLoading;

  const postCounter = async (amount: string, rate: string, chatLine: string) => {
    setActionError(null);
    const result = await counter({
      id: negotiation.id,
      offer: { amount: toMoney(amount), rate: toMoney(rate) },
    });
    if ('error' in result) {
      setActionError(negotiationErrorMessage(toAppError(result.error)));
      return false;
    }
    enqueue(chatLine);
    return true;
  };

  const acceptAmountOnly = async () => {
    if (!canAct || !offer || !isPositiveMoney(rateDraft)) return false;
    return postCounter(
      offer.amount,
      rateDraft,
      negotiationAcceptFieldMessage('amount', format(offer.amount, base)),
    );
  };

  const acceptRateOnly = async () => {
    if (!canAct || !offer || !isPositiveMoney(amountDraft)) return false;
    return postCounter(
      amountDraft,
      offer.rate,
      negotiationAcceptFieldMessage('rate', p2pRateLine(offer.rate, base, quote)),
    );
  };

  const acceptFull = async () => {
    setActionError(null);
    const result = await accept({ id: negotiation.id, p2pRequestId: negotiation.p2pRequestId });
    setConfirmAccept(false);
    setPrefillKey(null);
    if ('error' in result) {
      setActionError(negotiationErrorMessage(toAppError(result.error)));
      return;
    }
    enqueue(negotiationAcceptBothMessage());
    const orderId = result.data.p2pOrderId;
    if (orderId) {
      router.replace({ pathname: '/p2p/order/[id]', params: { id: orderId } });
    }
  };

  const sendPrefill = async () => {
    if (!selectedPrefill || !canSendPrefill) return;
    if (selectedPrefill.action === 'accept_both') {
      setConfirmAccept(true);
      return;
    }
    if (selectedPrefill.action === 'accept_amount') {
      const ok = await acceptAmountOnly();
      if (ok) setPrefillKey(null);
      return;
    }
    if (selectedPrefill.action === 'accept_rate') {
      const ok = await acceptRateOnly();
      if (ok) setPrefillKey(null);
      return;
    }
    const amountLabel = isPositiveMoney(amountDraft) ? format(toMoney(amountDraft), base) : undefined;
    const rateLabel = isPositiveMoney(rateDraft)
      ? p2pRateLine(toMoney(rateDraft), base, quote)
      : undefined;
    enqueue(
      selectedPrefill.build({
        amount: prefillUsesAmount(selectedPrefill.fields) ? amountLabel : undefined,
        rateLine: prefillUsesRate(selectedPrefill.fields) ? rateLabel : undefined,
      }),
    );
    setPrefillKey(null);
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={{ maxHeight: 420 }}
      contentContainerStyle={{ gap: theme.spacing.sm }}
      testID="chat-negotiation-composer"
    >
      {offer ? (
        <Card variant="muted" padding="md" testID="chat-negotiation-current">
          <AppText variant="caption" tone="secondary">
            {offerAuthor(offer, userId)} ·{' '}
            {negotiation.status === 'OPEN' ? 'pending' : negotiation.status}
          </AppText>
          <AppText variant="bodyStrong">{format(offer.amount, base)}</AppText>
          <FlippableRateLine rate={offer.rate} base={base} quote={quote} />
        </Card>
      ) : null}

      <FormAlert message={actionError} testID="chat-negotiation-error" />

      {open && !requestOpen ? (
        <FormAlert
          tone="warning"
          message="The request is no longer open, so this offer can't be accepted."
        />
      ) : null}

      {open && !canAct ? (
        <FormAlert
          tone="info"
          message="Waiting for their reply. You can still send a suggested message."
          testID="chat-negotiation-waiting"
        />
      ) : negotiation.status === 'ACCEPTED' ? (
        <FormAlert tone="success" message="Offer accepted. Open the order to continue." />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <PickerField
            label="Suggested message"
            value={selectedPrefill?.label ?? ''}
            placeholder="Choose a message"
            onPress={() => setPrefillOpen(true)}
            testID="chat-prefill-picker"
          />
        </View>
        <Button
          label={selectedPrefill?.action ? 'Confirm' : 'Send'}
          leftIcon={Send}
          onPress={() => void sendPrefill()}
          loading={prefillBusy}
          disabled={!canSendPrefill || prefillBusy}
          fullWidth={false}
          testID="chat-send-prefill"
        />
      </View>

      {selectedPrefill?.action === 'accept_amount' ? (
        <AppText variant="caption" tone="secondary" testID="chat-prefill-edit-hint">
          Keeps their amount. Edit your rate below, then confirm.
        </AppText>
      ) : selectedPrefill?.action === 'accept_rate' ? (
        <AppText variant="caption" tone="secondary" testID="chat-prefill-edit-hint">
          Keeps their rate. Edit your amount below, then confirm.
        </AppText>
      ) : selectedPrefill?.action === 'accept_both' ? (
        <AppText variant="caption" tone="secondary" testID="chat-prefill-edit-hint">
          Accepts both terms and creates the order.
        </AppText>
      ) : selectedPrefill && selectedPrefill.fields !== 'none' && !canAct ? (
        <AppText variant="caption" tone="secondary" testID="chat-prefill-edit-hint">
          {selectedPrefill.fields === 'both'
            ? 'Edit amount and rate below, then send.'
            : selectedPrefill.fields === 'amount'
              ? 'Edit the amount below, then send.'
              : 'Edit the rate below, then send.'}
        </AppText>
      ) : null}

      <OfferTermsForm
        base={base}
        quote={quote}
        amount={amountDraft}
        rate={rateDraft}
        onAmountChange={setAmountDraft}
        onRateChange={setRateDraft}
        amountEditable={amountEditable}
        rateEditable={rateEditable}
        testID="chat"
      />

      <AppText variant="caption" tone="secondary">
        Only amount and rate are negotiated here. Choose “I Accept amount” or “I Accept rate” to keep
        that term and counter on the other; “I Accept the amount and the rate” completes the deal.
      </AppText>

      {prefillOpen ? (
        <PickerSheet
          visible={prefillOpen}
          title="Suggested message"
          options={prefillOptions}
          selectedKey={prefillKey}
          onSelect={(key) => {
            setPrefillKey(key || null);
            setPrefillOpen(false);
          }}
          onClose={() => setPrefillOpen(false)}
          testID="chat-prefill-sheet"
        />
      ) : null}

      <ConfirmDialog
        visible={confirmAccept}
        title="Accept this offer?"
        message={
          offer
            ? `You agree to ${format(offer.amount, base)} at ${p2pRateLine(offer.rate, base, quote)}. This creates an order.`
            : ''
        }
        confirmLabel="I Accept the amount and the rate"
        loading={acceptState.isLoading}
        onConfirm={() => void acceptFull()}
        onCancel={() => setConfirmAccept(false)}
      />
    </ScrollView>
  );
}
