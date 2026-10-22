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

/** Which offer terms a suggested message can plug into. */
export type NegotiationPrefillFields = 'none' | 'amount' | 'rate' | 'both';

/** Send runs a negotiation action instead of only posting chat text. */
export type NegotiationPrefillAction = 'accept_amount' | 'accept_rate' | 'accept_both';

export type NegotiationPrefillAudience = 'buyer' | 'seller' | 'both';

export type NegotiationPrefill = {
  id: string;
  /** Shown in the picker. */
  label: string;
  /** When not `none`, Amount and/or Rate stay editable so the user can fill the message. */
  fields: NegotiationPrefillFields;
  /** Who sees this suggestion. Defaults to both. */
  audience?: NegotiationPrefillAudience;
  /** When set, Send performs this action (accept / partial accept). */
  action?: NegotiationPrefillAction;
  /** Chat body. Callers pass formatted amount / rate line when `fields` needs them. */
  build: (ctx: { amount?: string; rateLine?: string }) => string;
};

export function prefillUsesAmount(fields: NegotiationPrefillFields): boolean {
  return fields === 'amount' || fields === 'both';
}

export function prefillUsesRate(fields: NegotiationPrefillFields): boolean {
  return fields === 'rate' || fields === 'both';
}

export function isNegotiationPrefillAction(
  value: string | undefined,
): value is NegotiationPrefillAction {
  return value === 'accept_amount' || value === 'accept_rate' || value === 'accept_both';
}

/** Prefills visible for this viewer; accept actions only when it is their turn to act. */
export function negotiationPrefillsFor(args: {
  isSeller: boolean;
  canAct: boolean;
}): NegotiationPrefill[] {
  return NEGOTIATION_PREFILLS.filter((item) => {
    const audience = item.audience ?? 'both';
    if (audience === 'seller' && !args.isSeller) return false;
    if (audience === 'buyer' && args.isSeller) return false;
    if (item.action && !args.canAct) return false;
    return true;
  });
}

/** Prefills for negotiation chat. Amount/rate ones insert the composer values on send. */
export const NEGOTIATION_PREFILLS: readonly NegotiationPrefill[] = [
  {
    id: 'accept-amount',
    label: 'I Accept amount',
    fields: 'rate',
    action: 'accept_amount',
    audience: 'both',
    build: ({ amount }) =>
      amount ? `I Accept amount (${amount}).` : 'I Accept amount.',
  },
  {
    id: 'accept-rate',
    label: 'I Accept rate',
    fields: 'amount',
    action: 'accept_rate',
    audience: 'both',
    build: ({ rateLine }) =>
      rateLine ? `I Accept rate (${rateLine}).` : 'I Accept rate.',
  },
  {
    id: 'accept-both',
    label: 'I Accept the amount and the rate',
    fields: 'none',
    action: 'accept_both',
    audience: 'both',
    build: () => 'I Accept the amount and the rate.',
  },
  {
    id: 'seller-amount-ok',
    label: 'The amount works for me.',
    fields: 'none',
    audience: 'seller',
    build: () => 'The amount works for me.',
  },
  {
    id: 'seller-rate-ok',
    label: 'The rate works for me.',
    fields: 'none',
    audience: 'seller',
    build: () => 'The rate works for me.',
  },
  {
    id: 'seller-need-better-rate',
    label: 'I need a better rate to proceed.',
    fields: 'rate',
    audience: 'seller',
    build: ({ rateLine }) =>
      rateLine
        ? `I need a better rate to proceed. How about ${rateLine}?`
        : 'I need a better rate to proceed.',
  },
  {
    id: 'seller-meet-halfway',
    label: 'I can meet halfway on the rate.',
    fields: 'rate',
    audience: 'seller',
    build: ({ rateLine }) =>
      rateLine
        ? `I can meet halfway on the rate at ${rateLine}.`
        : 'I can meet halfway on the rate.',
  },
  {
    id: 'seller-amount-if-rate',
    label: 'I can do that amount if we adjust the rate.',
    fields: 'rate',
    audience: 'seller',
    build: ({ rateLine }) =>
      rateLine
        ? `I can do that amount if we adjust the rate to ${rateLine}.`
        : 'I can do that amount if we adjust the rate.',
  },
  {
    id: 'seller-confirm-complete',
    label: 'Please confirm so we can complete.',
    fields: 'none',
    audience: 'seller',
    build: () => 'Please confirm so we can complete.',
  },
  {
    id: 'seller-ready-when-you-are',
    label: "I'm ready to accept when you are.",
    fields: 'none',
    audience: 'seller',
    build: () => "I'm ready to accept when you are.",
  },
  {
    id: 'meet-both',
    label: 'Can you meet at this amount and rate?',
    fields: 'both',
    audience: 'buyer',
    build: ({ amount, rateLine }) =>
      amount && rateLine
        ? `Can you meet at ${amount} and ${rateLine}?`
        : 'Can you meet at this amount and rate?',
  },
  {
    id: 'propose-both',
    label: 'Does this amount and rate work for you?',
    fields: 'both',
    audience: 'buyer',
    build: ({ amount, rateLine }) =>
      amount && rateLine
        ? `Does ${amount} at ${rateLine} work for you?`
        : 'Does this amount and rate work for you?',
  },
  {
    id: 'propose-amount',
    label: 'How about this amount?',
    fields: 'amount',
    audience: 'buyer',
    build: ({ amount }) => (amount ? `How about ${amount}?` : 'How about this amount?'),
  },
  {
    id: 'settle-amount',
    label: 'Can we settle on this amount?',
    fields: 'amount',
    audience: 'buyer',
    build: ({ amount }) =>
      amount ? `Can we settle on ${amount}?` : 'Can we settle on this amount?',
  },
  {
    id: 'propose-rate',
    label: 'Would this rate work for you?',
    fields: 'rate',
    audience: 'buyer',
    build: ({ rateLine }) =>
      rateLine ? `Would ${rateLine} work for you?` : 'Would this rate work for you?',
  },
  {
    id: 'meet-rate',
    label: 'Can you meet this rate?',
    fields: 'rate',
    audience: 'buyer',
    build: ({ rateLine }) =>
      rateLine ? `Can you meet ${rateLine}?` : 'Can you meet this rate?',
  },
  {
    id: 'please-counter',
    label: 'Please send a counter on amount or rate.',
    fields: 'none',
    audience: 'buyer',
    build: () => 'Please send a counter on amount or rate.',
  },
  {
    id: 'what-works',
    label: 'Happy to discuss — what works for you?',
    fields: 'none',
    audience: 'both',
    build: () => 'Happy to discuss — what works for you?',
  },
  {
    id: 'need-time',
    label: 'I need a bit more time and will reply shortly.',
    fields: 'none',
    audience: 'both',
    build: () => 'I need a bit more time and will reply shortly.',
  },
  {
    id: 'thanks-close',
    label: 'Thanks — looking forward to closing this.',
    fields: 'none',
    audience: 'both',
    build: () => 'Thanks — looking forward to closing this.',
  },
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
    ? `I Accept amount (${formattedValue}). Sending a counter with my rate.`
    : `I Accept rate (${formattedValue}). Sending a counter with my amount.`;
}

/** Message when accepting the full pending offer. */
export function negotiationAcceptBothMessage(): string {
  return 'I Accept the amount and the rate.';
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
