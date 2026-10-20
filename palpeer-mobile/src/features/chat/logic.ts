import type { AppError } from '@/services/api/errors';
import type { RealtimeStatus } from '@/services/websocket/connection';
import type { OutboxMessage } from '@/store/slices/chatOutboxSlice';
import type { ChatMessageResponse, ChatRoomResponse } from '@/types/api/chat';
import type { P2POrderSummaryResponse } from '@/types/api/p2p';

/** VERIFIED: `SendChatMessageRequest.content` @Size(max = 4000). */
export const CHAT_MESSAGE_MAX = 4000;

export type ChatItem =
  | { kind: 'message'; key: string; message: ChatMessageResponse; mine: boolean }
  | { kind: 'outbox'; key: string; item: OutboxMessage };

/**
 * Oldest first for a normal (non-inverted) list: history chronologically, then unconfirmed
 * outbox messages at the bottom. An outbox entry whose `clientMessageId` already reached the
 * history (e.g. via STOMP before the REST reply) is hidden so it never shows twice.
 */
export function buildChatItems(
  pages: readonly { content: readonly ChatMessageResponse[] }[] | undefined,
  outbox: readonly OutboxMessage[],
  userId: string | null,
): ChatItem[] {
  const history = (pages ?? []).flatMap((page) => page.content);
  const seenIds = new Set<string>();
  const seenClientIds = new Set<string>();
  const messages: ChatItem[] = [];
  for (const message of history) {
    if (seenIds.has(message.id)) continue;
    seenIds.add(message.id);
    if (message.clientMessageId) seenClientIds.add(message.clientMessageId);
    messages.push({ kind: 'message', key: message.id, message, mine: message.senderId === userId });
  }
  // API pages are newest-first; reverse so the thread reads top → bottom.
  messages.reverse();
  const pending: ChatItem[] = outbox
    .filter((item) => !seenClientIds.has(item.clientMessageId))
    .map((item) => ({ kind: 'outbox' as const, key: `outbox-${item.clientMessageId}`, item }));
  return [...messages, ...pending];
}

type Pages = readonly { content: readonly ChatMessageResponse[] }[] | undefined;

function readAtLeast(lastReadAt: string | null, createdAt: string): boolean {
  return !!lastReadAt && Date.parse(lastReadAt) >= Date.parse(createdAt);
}

function readMarkers(room: ChatRoomResponse, userId: string | null) {
  const iAmA = room.participantAId === userId;
  return {
    mine: iAmA ? room.participantALastReadAt : room.participantBLastReadAt,
    theirs: iAmA ? room.participantBLastReadAt : room.participantALastReadAt,
  };
}

/**
 * The newest message from the other participant that my read marker hasn't reached yet, i.e.
 * the one to report with `POST /chat/rooms/{id}/read`; null when there is nothing new.
 */
export function unreadIncoming(
  pages: Pages,
  room: ChatRoomResponse | undefined,
  userId: string | null,
): ChatMessageResponse | null {
  if (!room || !userId) return null;
  const newest = (pages ?? [])
    .flatMap((page) => page.content)
    .find((message) => message.senderId !== userId);
  if (!newest || readAtLeast(readMarkers(room, userId).mine, newest.createdAt)) return null;
  return newest;
}

/** My newest sent message, if the other participant has read it (shown as "Seen"). */
export function seenMessageId(
  pages: Pages,
  room: ChatRoomResponse | undefined,
  userId: string | null,
): string | null {
  if (!room || !userId) return null;
  const newestMine = (pages ?? [])
    .flatMap((page) => page.content)
    .find((message) => message.senderId === userId);
  if (!newestMine) return null;
  return readAtLeast(readMarkers(room, userId).theirs, newestMine.createdAt) ? newestMine.id : null;
}

/**
 * A failed read report is worth retrying unless the server refused it for good (the room or
 * message is gone, or I'm not a participant).
 */
export function isRetryableReadError(error: AppError): boolean {
  const status = error.status ?? 0;
  return !(status >= 400 && status < 500 && status !== 408 && status !== 429);
}

/** Connection banner text; null when live updates are working. */
export function connectionNotice(status: RealtimeStatus, isOnline: boolean | null): string | null {
  if (isOnline === false || status === 'offline') {
    return "You're offline. New messages will appear when you reconnect.";
  }
  switch (status) {
    case 'connecting':
      return 'Connecting…';
    case 'reconnecting':
      return 'Reconnecting… New messages will appear when the connection is back.';
    case 'unconfigured':
      return "Live updates aren't available. Pull down to check for new messages.";
    default:
      return null;
  }
}

export function orderPairLabel(order: P2POrderSummaryResponse | undefined): string {
  if (!order?.baseCurrencyCode || !order.quoteCurrencyCode) return 'P2P order';
  return `${order.baseCurrencyCode}/${order.quoteCurrencyCode} order`;
}

export function negotiationPairLabel(base?: string | null, quote?: string | null): string {
  if (!base || !quote) return 'Negotiation';
  return `${base}/${quote} negotiation`;
}

/** Prefill chips for negotiation chat (sent as-is; amount/rate composer is separate). */
export const NEGOTIATION_PREFILLS: readonly string[] = [
  'Can you meet at this amount and rate?',
  "I'm ready to accept when you are.",
  'Please send a counter on amount or rate.',
  'Thanks — looking forward to closing this.',
];

/** Message body when the user sends a currency amount in a negotiation chat. */
export function negotiationAmountMessage(formattedAmount: string): string {
  return `Proposed amount: ${formattedAmount}`;
}

/** Message body when the user proposes both amount and rate. */
export function negotiationTermsMessage(formattedAmount: string, rateLine: string): string {
  return `My offer: ${formattedAmount} at ${rateLine}`;
}

/** Message when accepting only one side of the current offer. */
export function negotiationAcceptFieldMessage(
  field: 'amount' | 'rate',
  formattedValue: string,
): string {
  return field === 'amount'
    ? `I accept the amount (${formattedValue}). Sending a counter with my rate.`
    : `I accept the rate (${formattedValue}). Sending a counter with my amount.`;
}

/** VERIFIED codes from `ChatService`. */
const MESSAGES: Record<string, string> = {
  CHAT_NOT_PARTICIPANT: "You're not part of this conversation.",
  CHAT_SCOPE_REQUIRED: "Couldn't open this chat. Pull to refresh and try again.",
};

export function chatErrorMessage(error: AppError): string {
  if (error.kind === 'offline' || error.kind === 'timeout')
    return 'Not sent. Check your connection.';
  return (error.code && MESSAGES[error.code]) || error.message;
}
