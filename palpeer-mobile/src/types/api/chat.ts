import type { IsoInstant, Uuid } from './common';

/**
 * VERIFIED: `ChatRoomResponse`. One room per P2P order; A = requester, B = acceptor. The
 * `LastReadAt` fields are the `createdAt` of the latest message each participant has read.
 */
export type ChatRoomResponse = {
  id: Uuid;
  p2pOrderId: Uuid;
  participantAId: Uuid;
  participantBId: Uuid;
  createdAt: IsoInstant;
  participantALastReadAt: IsoInstant | null;
  participantBLastReadAt: IsoInstant | null;
};

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
