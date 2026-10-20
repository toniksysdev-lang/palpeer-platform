import type { IsoInstant, Uuid } from './common';

/**
 * VERIFIED: `ChatRoomResponse`. Scoped to a P2P order or a negotiation.
 * A = requester, B = counterparty/acceptor. The `LastReadAt` fields are the `createdAt`
 * of the latest message each participant has read.
 */
export type ChatRoomResponse = {
  id: Uuid;
  p2pOrderId: Uuid | null;
  negotiationId: Uuid | null;
  participantAId: Uuid;
  participantBId: Uuid;
  createdAt: IsoInstant;
  participantALastReadAt: IsoInstant | null;
  participantBLastReadAt: IsoInstant | null;
  /** Messages from the other participant after my last-read marker. */
  unreadCount: number;
};

/** VERIFIED: `GET /chat/unread-count` body (`{ count }`). */
export type ChatUnreadCountResponse = { count: number };

/**
 * VERIFIED: `ChatMessageResponse`, from REST (inside the envelope) and from STOMP
 * `/topic/rooms.{roomId}` (raw, not wrapped).
 */
export type ChatMessageResponse = {
  id: Uuid;
  roomId: Uuid;
  senderId: Uuid;
  content: string;
  clientMessageId: string | null;
  createdAt: IsoInstant;
};

/** VERIFIED: `SendChatMessageRequest`; content 1..4000 (trimmed), clientMessageId ≤ 100. */
export type SendChatMessageRequest = { content: string; clientMessageId: string };

/** VERIFIED: `MarkChatReadRequest`; the message must belong to the room. */
export type MarkChatReadRequest = { messageId: Uuid };

/**
 * VERIFIED: `ChatReadReceiptResponse`, raw on STOMP `/topic/rooms.{roomId}.reads`, sent only when
 * a participant's read marker moves forward.
 */
export type ChatReadReceipt = { roomId: Uuid; userId: Uuid; lastReadAt: IsoInstant };

/** Open (or return) a room for exactly one of order / negotiation. */
export type OpenChatRoomRequest =
  | { p2pOrderId: Uuid; negotiationId?: never }
  | { negotiationId: Uuid; p2pOrderId?: never };
