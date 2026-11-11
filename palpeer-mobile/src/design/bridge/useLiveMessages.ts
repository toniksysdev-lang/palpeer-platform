import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { unreadIncoming } from '@/features/chat/logic';
import { badgeLabel, isUnread, messagesMenuCount } from '@/features/notifications/logic';
import { useOpenNotification } from '@/features/notifications/useOpenNotification';
import {
  useGetChatMessagesInfiniteQuery,
  useGetChatRoomsQuery,
  useGetChatUnreadCountQuery,
  useMarkChatReadMutation,
  useSendChatMessageMutation,
} from '@/services/api/chatApi';
import { newIdempotencyKey } from '@/services/api/client';
import { toAppError } from '@/services/api/errors';
import {
  useAcceptNegotiationMutation,
  useCounterOfferMutation,
  useGetMyNegotiationsQuery,
  useRejectNegotiationMutation,
} from '@/services/api/negotiationApi';
import {
  ALERTS_POLL_MS,
  useGetNotificationsInfiniteQuery,
  useGetUnreadCountQuery,
} from '@/services/api/notificationApi';
import { useGetMyOrdersQuery } from '@/services/api/p2pApi';
import { notificationTarget } from '@/services/navigation/deepLinks';
import { useAppSelector } from '@/store';
import type { NegotiationResponse } from '@/types/api/negotiation';
import type { NotificationResponse } from '@/types/api/notification';
import { toMoney } from '@/utils/money';

import { verifyDesignPin } from './verifyPin';

type OkErr = { ok: true } | { ok: false; error: string };

const RATE_STEP = 5;

function midRate(a: number, b: number): number {
  return Math.round((a + b) / 2 / RATE_STEP) * RATE_STEP;
}

function clock(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-CA', { hour: 'numeric', minute: '2-digit' });
}

function alertActionLabel(n: NotificationResponse): string | null {
  const type = n.referenceType?.toUpperCase();
  if (type === 'NEGOTIATION') return 'Open price talk';
  if (type === 'P2P_REQUEST') return 'See offer';
  if (type === 'P2P_ORDER' || type === 'EXCHANGE') return 'See change';
  if (type === 'FUNDING' || type === 'WITHDRAWAL' || type === 'TRANSFER') return 'See details';
  if (notificationTarget(n)) return 'Open';
  return 'See details';
}

function pendingOffer(neg: NegotiationResponse) {
  return [...neg.offers].reverse().find((o) => o.status === 'PENDING') ?? null;
}

function lastMyRate(neg: NegotiationResponse, userId: string | null): number | null {
  const mine = [...neg.offers].reverse().find((o) => o.offeredBy === userId);
  return mine ? Number.parseFloat(mine.rate) || null : null;
}

/** Live Messages: Price talks (chat + negotiation actions) and Alerts (open + mark read). */
export function useLiveMessages() {
  const openNotification = useOpenNotification();
  const authenticated = useAppSelector((s) => s.session.status === 'authenticated');
  const notifications = useGetNotificationsInfiniteQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const notifUnread = useGetUnreadCountQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const chatUnread = useGetChatUnreadCountQuery(undefined, {
    skip: !authenticated,
    pollingInterval: authenticated ? ALERTS_POLL_MS : 0,
    skipPollingIfUnfocused: true,
  });
  const roomsQ = useGetChatRoomsQuery(undefined, { skip: !authenticated });
  const negotiationsQ = useGetMyNegotiationsQuery(undefined, { skip: !authenticated });
  const ordersQ = useGetMyOrdersQuery(undefined, { skip: !authenticated });
  const userId = useAppSelector((s) => s.session.userId);

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeNegotiationId, setActiveNegotiationId] = useState<string | null>(null);

  const messagesQ = useGetChatMessagesInfiniteQuery(activeRoomId ?? skipToken);
  const [sendMessage] = useSendChatMessageMutation();
  const [markRead] = useMarkChatReadMutation();
  const [acceptNegotiation] = useAcceptNegotiationMutation();
  const [counterOffer] = useCounterOfferMutation();
  const [rejectNegotiation] = useRejectNegotiationMutation();

  const pages = notifications.data?.pages ?? [];
  const liveAlerts = useMemo(() => {
    const items = pages.flatMap((p) => p.content ?? []);
    return items.map((n) => {
      const time = clock(n.createdAt);
      const fresh = isUnread(n);
      return {
        id: n.id,
        title: n.title,
        text: n.body,
        time: fresh ? `New. ${time}` : time,
        fresh,
        referenceType: n.referenceType,
        referenceId: n.referenceId,
        actionLabel: alertActionLabel(n),
        raw: n,
      };
    });
  }, [pages]);

  const negotiationsById = useMemo(() => {
    const map = new Map<string, NegotiationResponse>();
    for (const n of negotiationsQ.data ?? []) map.set(n.id, n);
    return map;
  }, [negotiationsQ.data]);

  const liveChats = useMemo(() => {
    return (roomsQ.data ?? []).map((room) => {
      const neg = room.negotiationId ? negotiationsById.get(room.negotiationId) : undefined;
      const order = ordersQ.data?.find((o) => o.id === room.p2pOrderId);
      const pending = neg ? pendingOffer(neg) : null;
      const rate = pending ? Number.parseFloat(pending.rate) || 0 : 0;
      const amount = pending ? Number.parseFloat(pending.amount) || 0 : 0;
      const theirTurn = !!(pending && pending.offeredBy !== userId && neg?.status === 'OPEN');
      const waiting = !!(pending && pending.offeredBy === userId && neg?.status === 'OPEN');

      let title = 'Chat';
      let text = 'Open conversation';
      if (neg) {
        title = theirTurn
          ? `A person said ₦${Math.round(rate)}`
          : waiting
            ? `Waiting · ₦${Math.round(rate)}`
            : neg.status === 'ACCEPTED'
              ? 'Price agreed'
              : 'Price talk';
        text =
          room.unreadCount > 0
            ? `${room.unreadCount} new message${room.unreadCount === 1 ? '' : 's'}`
            : amount > 0
              ? `About CA$${amount.toLocaleString('en-CA')}`
              : 'Talk about the price';
      } else if (order) {
        title = 'Order chat';
        text =
          room.unreadCount > 0
            ? `${room.unreadCount} new message${room.unreadCount === 1 ? '' : 's'}`
            : `${order.baseCurrencyCode ?? 'CAD'} ↔ ${order.quoteCurrencyCode ?? 'NGN'}`;
      } else if (room.unreadCount > 0) {
        text = `${room.unreadCount} new message${room.unreadCount === 1 ? '' : 's'}`;
      }

      return {
        id: room.id,
        title,
        text,
        time: clock(room.createdAt),
        unread: room.unreadCount,
        negotiationId: room.negotiationId,
        p2pOrderId: room.p2pOrderId,
        needsAnswer: theirTurn,
      };
    });
  }, [negotiationsById, ordersQ.data, roomsQ.data, userId]);

  const activeNegotiation = useMemo(() => {
    if (!activeNegotiationId) return null;
    return negotiationsById.get(activeNegotiationId) ?? null;
  }, [activeNegotiationId, negotiationsById]);

  const talk = useMemo(() => {
    const neg = activeNegotiation;
    if (!neg) return null;
    const pending = pendingOffer(neg);
    const theirRate = pending && pending.offeredBy !== userId ? Number.parseFloat(pending.rate) || 0 : 0;
    const myRate = lastMyRate(neg, userId) ?? theirRate;
    const amount = pending ? Number.parseFloat(pending.amount) || 0 : 0;
    const rate = theirRate || myRate;
    const nextPrice = midRate(myRate || rate, theirRate || rate);
    const canAnswer = neg.status === 'OPEN' && !!pending && pending.offeredBy !== userId;
    const waiting = neg.status === 'OPEN' && !!pending && pending.offeredBy === userId;
    const done = neg.status === 'ACCEPTED';
    const closed = neg.status === 'CANCELLED';
    const bubbles = neg.offers.map((o) => ({
      id: o.id,
      me: o.offeredBy === userId,
      rate: Number.parseFloat(o.rate) || 0,
      text: `CA$1 = ₦${Math.round(Number.parseFloat(o.rate) || 0)}`,
      who: o.offeredBy === userId ? 'My price' : "The other person's price",
    }));
    const buyerGets = Math.max(0, amount - 2);
    const iGet = amount * rate - 2 * rate;
    const dealText =
      amount > 0 && rate > 0
        ? `At ₦${Math.round(rate)}: the buyer gets CA$${buyerGets.toLocaleString('en-CA')}, you get ₦${Math.round(iGet).toLocaleString('en-CA')} after the CA$2 flat fee`
        : 'Talk about the price until you agree.';
    let statusText = '';
    let statusColor = '#A84C08';
    if (waiting) statusText = 'Waiting for the other person to answer';
    if (done) {
      statusText = `Done! Money is moving at ₦${Math.round(rate)}.`;
      statusColor = '#0B6E4F';
    }
    if (closed) {
      statusText =
        neg.closedReason === 'REJECTED'
          ? 'You said no. The offer stays open for others.'
          : 'This price talk ended.';
      statusColor = '#B3231A';
    }
    return {
      negotiationId: neg.id,
      requestId: neg.p2pRequestId,
      amount,
      rate: Math.round(rate),
      nextPrice: Math.round(nextPrice),
      canAnswer,
      waiting,
      done,
      closed,
      dealText,
      statusText,
      statusColor,
      bubbles,
      showStatus: waiting || done || closed,
    };
  }, [activeNegotiation, userId]);

  const liveMessages = useMemo(() => {
    if (!activeRoomId) return [];
    const rows = (messagesQ.data?.pages ?? []).flatMap((p) => p.content ?? []);
    return [...rows].reverse().map((m) => ({
      id: m.id,
      me: m.senderId === userId,
      text: m.content,
      time: clock(m.createdAt),
    }));
  }, [activeRoomId, messagesQ.data, userId]);

  // Mark the newest unread incoming message once history has loaded.
  useEffect(() => {
    if (!activeRoomId || !messagesQ.data) return;
    const room = roomsQ.data?.find((r) => r.id === activeRoomId);
    const newest = unreadIncoming(messagesQ.data.pages, room, userId);
    if (!newest) return;
    void markRead({ roomId: activeRoomId, messageId: newest.id });
  }, [activeRoomId, markRead, messagesQ.data, roomsQ.data, userId]);

  const openChat = useCallback(async (roomId: string): Promise<OkErr> => {
    setActiveNegotiationId(null);
    setActiveRoomId(roomId);
    return { ok: true };
  }, []);

  const openPriceTalk = useCallback(
    async (roomId: string): Promise<OkErr> => {
      const room = roomsQ.data?.find((r) => r.id === roomId);
      if (room?.negotiationId) {
        setActiveRoomId(null);
        setActiveNegotiationId(room.negotiationId);
        return { ok: true };
      }
      return openChat(roomId);
    },
    [openChat, roomsQ.data],
  );

  const closeChat = useCallback(() => setActiveRoomId(null), []);
  const closeTalk = useCallback(() => setActiveNegotiationId(null), []);

  const openMessagesChatFromTalk = useCallback(async (): Promise<OkErr> => {
    const negId = activeNegotiationId;
    if (!negId) return { ok: false, error: 'No price talk open.' };
    const room = roomsQ.data?.find((r) => r.negotiationId === negId);
    if (!room) return { ok: false, error: 'No chat room for this talk yet.' };
    setActiveNegotiationId(null);
    setActiveRoomId(room.id);
    return { ok: true };
  }, [activeNegotiationId, roomsQ.data]);

  const onSendChat = useCallback(
    async (text: string): Promise<OkErr> => {
      if (!activeRoomId) return { ok: false, error: 'No chat open.' };
      const content = text.trim();
      if (!content) return { ok: false, error: 'Type a message.' };
      try {
        await sendMessage({
          roomId: activeRoomId,
          message: { content, clientMessageId: newIdempotencyKey() },
        }).unwrap();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: toAppError(error).message ?? 'Could not send.' };
      }
    },
    [activeRoomId, sendMessage],
  );

  const openAlert = useCallback(
    (alertId: string) => {
      const row = liveAlerts.find((a) => a.id === alertId);
      if (!row?.raw) return;
      openNotification(row.raw);
    },
    [liveAlerts, openNotification],
  );

  const confirmPin = useCallback(async (pin: string): Promise<boolean> => verifyDesignPin(pin), []);

  const onAcceptTalk = useCallback(async (): Promise<OkErr> => {
    const neg = activeNegotiation;
    if (!neg || neg.status !== 'OPEN') return { ok: false, error: 'Nothing to accept.' };
    try {
      await acceptNegotiation({ id: neg.id, p2pRequestId: neg.p2pRequestId }).unwrap();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toAppError(error).message ?? 'Could not accept price.' };
    }
  }, [acceptNegotiation, activeNegotiation]);

  const onCounterTalk = useCallback(async (): Promise<OkErr> => {
    const neg = activeNegotiation;
    const t = talk;
    if (!neg || !t || !t.canAnswer) return { ok: false, error: 'Nothing to offer.' };
    const pending = pendingOffer(neg);
    const amount = pending?.amount ?? toMoney(String(t.amount || 0));
    try {
      await counterOffer({
        id: neg.id,
        offer: { amount, rate: toMoney(String(t.nextPrice)) },
      }).unwrap();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toAppError(error).message ?? 'Could not send price.' };
    }
  }, [activeNegotiation, counterOffer, talk]);

  const onRejectTalk = useCallback(async (): Promise<OkErr> => {
    const neg = activeNegotiation;
    if (!neg || neg.status !== 'OPEN') return { ok: false, error: 'Nothing to decline.' };
    try {
      await rejectNegotiation(neg.id).unwrap();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toAppError(error).message ?? 'Could not say no.' };
    }
  }, [activeNegotiation, rejectNegotiation]);

  const onLoadMoreAlerts = useCallback(() => {
    if (notifications.hasNextPage && !notifications.isFetchingNextPage) {
      void notifications.fetchNextPage();
    }
  }, [notifications]);

  const onRefresh = useCallback(() => {
    void notifications.refetch();
    void notifUnread.refetch();
    void chatUnread.refetch();
    void roomsQ.refetch();
    void negotiationsQ.refetch();
  }, [chatUnread, negotiationsQ, notifUnread, notifications, roomsQ]);

  const alertsUnread = notifUnread.data ?? 0;
  const unreadCount = messagesMenuCount(alertsUnread, chatUnread.data);

  return {
    backend: true as const,
    liveAlerts,
    liveChats,
    liveMessages,
    talk,
    activeRoomId,
    activeNegotiationId,
    messagesLoading: notifications.isLoading || roomsQ.isLoading,
    alertsLoadingMore: notifications.isFetchingNextPage,
    alertsHasMore: !!notifications.hasNextPage,
    alertsUnread,
    unreadCount,
    msgBadge: badgeLabel(unreadCount) ?? '',
    openChat,
    openPriceTalk,
    closeChat,
    closeTalk,
    openMessagesChatFromTalk,
    onSendChat,
    openAlert,
    confirmPin,
    onAcceptTalk,
    onCounterTalk,
    onRejectTalk,
    onLoadMoreAlerts,
    onRefresh,
  };
}
