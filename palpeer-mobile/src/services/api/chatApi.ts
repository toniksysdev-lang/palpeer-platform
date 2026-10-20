import type {
  ChatMessageResponse,
  ChatReadReceipt,
  ChatRoomResponse,
  ChatUnreadCountResponse,
  OpenChatRoomRequest,
  SendChatMessageRequest,
} from '@/types/api/chat';
import type { SpringPage } from '@/types/api/common';

import { baseApi } from './baseApi';

export const CHAT_PAGE_SIZE = 50;

export const CHAT_ROOMS = { type: 'ChatRoom' as const, id: 'LIST' };
export const CHAT_UNREAD = { type: 'ChatRoom' as const, id: 'UNREAD' };

export const chatApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getChatRooms: build.query<ChatRoomResponse[], void>({
      query: () => ({ path: '/chat/rooms' }),
      providesTags: [CHAT_ROOMS],
    }),
    getChatUnreadCount: build.query<number, void>({
      query: () => ({ path: '/chat/unread-count' }),
      transformResponse: (response: ChatUnreadCountResponse) => Number(response.count) || 0,
      providesTags: [CHAT_UNREAD],
    }),
    getChatRoom: build.query<ChatRoomResponse, string>({
      query: (roomId) => ({ path: `/chat/rooms/${encodeURIComponent(roomId)}` }),
      providesTags: (_result, _error, roomId) => [{ type: 'ChatRoom', id: roomId }],
    }),
    /** Returns the existing room for the order/negotiation if there is one (still 201). */
    openChatRoom: build.mutation<ChatRoomResponse, OpenChatRoomRequest>({
      // Send only the scoped id — never both keys (XOR) and never `undefined` (JSON omits it → {}).
      query: (request) => ({
        path: '/chat/rooms',
        method: 'POST',
        body:
          'negotiationId' in request
            ? { negotiationId: request.negotiationId }
            : { p2pOrderId: request.p2pOrderId },
      }),
      invalidatesTags: (_result, error) => (error ? [] : [CHAT_ROOMS]),
    }),
    /** History pages, newest first. Page 0 is re-read after a reconnect to backfill. */
    getChatMessages: build.infiniteQuery<SpringPage<ChatMessageResponse>, string, number>({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
      },
      query: ({ queryArg: roomId, pageParam }) => ({
        path: `/chat/rooms/${encodeURIComponent(roomId)}/messages`,
        query: { page: pageParam, size: CHAT_PAGE_SIZE },
      }),
      providesTags: (_result, _error, roomId) => [{ type: 'ChatMessage', id: roomId }],
    }),
    /**
     * Sent over REST for a confirmed result (STOMP sends report no errors). Resending the same
     * `clientMessageId` returns the original message instead of a duplicate.
     */
    sendChatMessage: build.mutation<
      ChatMessageResponse,
      { roomId: string; message: SendChatMessageRequest }
    >({
      query: ({ roomId, message }) => ({
        path: `/chat/rooms/${encodeURIComponent(roomId)}/messages`,
        method: 'POST',
        body: message,
      }),
      async onQueryStarted({ roomId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(insertChatMessage(roomId, data));
        } catch {
          // The outbox keeps the message as failed; the user can retry.
        }
      },
    }),
    /** Moves my read marker up to this message (never backwards) and returns the room. */
    markChatRead: build.mutation<ChatRoomResponse, { roomId: string; messageId: string }>({
      query: ({ roomId, messageId }) => ({
        path: `/chat/rooms/${encodeURIComponent(roomId)}/read`,
        method: 'POST',
        body: { messageId },
      }),
      invalidatesTags: (_result, error) => (error ? [] : [CHAT_UNREAD, CHAT_ROOMS]),
      async onQueryStarted({ roomId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(mergeReadMarkers(roomId, data));
        } catch {
          // Read receipts are best effort; the next incoming message tries again.
        }
      },
    }),
  }),
});

function later(current: string | null, next: string | null): string | null {
  if (!current || !next) return current ?? next;
  return Date.parse(next) > Date.parse(current) ? next : current;
}

/** A receipt may arrive before an older response; markers only ever move forward. */
function mergeReadMarkers(roomId: string, room: ChatRoomResponse) {
  return chatApi.util.updateQueryData('getChatRoom', roomId, (draft) => {
    draft.participantALastReadAt = later(draft.participantALastReadAt, room.participantALastReadAt);
    draft.participantBLastReadAt = later(draft.participantBLastReadAt, room.participantBLastReadAt);
    draft.unreadCount = room.unreadCount;
  });
}

/** Applies a STOMP read receipt to the cached room; markers only move forward. */
export function applyReadReceipt(receipt: ChatReadReceipt) {
  return chatApi.util.updateQueryData('getChatRoom', receipt.roomId, (draft) => {
    if (draft.participantAId === receipt.userId) {
      draft.participantALastReadAt = later(draft.participantALastReadAt, receipt.lastReadAt);
    } else if (draft.participantBId === receipt.userId) {
      draft.participantBLastReadAt = later(draft.participantBLastReadAt, receipt.lastReadAt);
    }
  });
}

/** Adds a message to the newest history page unless it is already there (by id or client id). */
export function insertChatMessage(roomId: string, message: ChatMessageResponse) {
  return chatApi.util.updateQueryData('getChatMessages', roomId, (draft) => {
    const first = draft.pages[0];
    if (!first) return;
    const known = draft.pages.some((page) =>
      page.content.some(
        (item) =>
          item.id === message.id ||
          (!!message.clientMessageId && item.clientMessageId === message.clientMessageId),
      ),
    );
    if (!known) first.content.unshift(message);
  });
}

export const {
  useGetChatRoomsQuery,
  useGetChatUnreadCountQuery,
  useGetChatRoomQuery,
  useOpenChatRoomMutation,
  useGetChatMessagesInfiniteQuery,
  useSendChatMessageMutation,
  useMarkChatReadMutation,
} = chatApi;
