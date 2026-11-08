import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo, useState } from 'react';

import { badgeLabel } from '@/features/notifications/logic';
import {
  useGetChatMessagesInfiniteQuery,
  useGetChatRoomsQuery,
  useMarkChatReadMutation,
  useSendChatMessageMutation,
} from '@/services/api/chatApi';
import { newIdempotencyKey } from '@/services/api/client';
import { toAppError } from '@/services/api/errors';
import {
  useGetNotificationsInfiniteQuery,
  useGetUnreadCountQuery,
} from '@/services/api/notificationApi';
import { useAppSelector } from '@/store';

type OkErr = { ok: true } | { ok: false; error: string };

export function useLiveMessages() {
  const notifications = useGetNotificationsInfiniteQuery();
  const notifUnread = useGetUnreadCountQuery();
  const roomsQ = useGetChatRoomsQuery();
  const userId = useAppSelector((s) => s.session.userId);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const messagesQ = useGetChatMessagesInfiniteQuery(activeRoomId ?? skipToken);
  const [sendMessage] = useSendChatMessageMutation();
  const [markRead] = useMarkChatReadMutation();

  const pages = notifications.data?.pages ?? [];
  const liveAlerts = useMemo(() => {
    const items = pages.flatMap((p) => p.content ?? []);
    return items.map((n) => {
      const time = n.createdAt
        ? new Date(n.createdAt).toLocaleString('en-CA', {
            hour: 'numeric',
            minute: '2-digit',
          })
        : '';
      const fresh = n.status === 'PENDING' || n.status === 'SENT';
      return {
        id: n.id,
        title: n.title,
        text: n.body,
        time: fresh ? `New. ${time}` : time,
        fresh,
      };
    });
  }, [pages]);

  const liveChats = useMemo(() => {
    return (roomsQ.data ?? []).map((room) => {
      const time = room.createdAt
        ? new Date(room.createdAt).toLocaleString('en-CA', {
            hour: 'numeric',
            minute: '2-digit',
          })
        : '';
      const title = room.negotiationId
        ? 'Price talk'
        : room.p2pOrderId
          ? 'Order chat'
          : 'Chat';
      return {
        id: room.id,
        title,
        text:
          room.unreadCount > 0
            ? `${room.unreadCount} new message${room.unreadCount === 1 ? '' : 's'}`
            : 'Open conversation',
        time,
        unread: room.unreadCount,
        negotiationId: room.negotiationId,
        p2pOrderId: room.p2pOrderId,
      };
    });
  }, [roomsQ.data]);

  const liveMessages = useMemo(() => {
    if (!activeRoomId) return [];
    const rows = (messagesQ.data?.pages ?? []).flatMap((p) => p.content ?? []);
    // Newest-first pages → reverse for chronological chat bubbles.
    return [...rows].reverse().map((m) => ({
      id: m.id,
      me: m.senderId === userId,
      text: m.content,
      time: new Date(m.createdAt).toLocaleString('en-CA', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    }));
  }, [activeRoomId, messagesQ.data, userId]);

  const openChat = useCallback(
    async (roomId: string): Promise<OkErr> => {
      setActiveRoomId(roomId);
      try {
        const first = messagesQ.data?.pages?.[0]?.content?.[0];
        if (first) {
          await markRead({ roomId, messageId: first.id });
        }
        return { ok: true };
      } catch {
        return { ok: true };
      }
    },
    [markRead, messagesQ.data],
  );

  const closeChat = useCallback(() => setActiveRoomId(null), []);

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

  const unreadCount = notifUnread.data ?? 0;

  return {
    backend: true as const,
    liveAlerts,
    liveChats,
    liveMessages,
    activeRoomId,
    messagesLoading: notifications.isLoading || roomsQ.isLoading,
    unreadCount,
    msgBadge: badgeLabel(unreadCount) ?? '',
    openChat,
    closeChat,
    onSendChat,
  };
}
