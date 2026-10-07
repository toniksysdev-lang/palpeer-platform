import { parseJson } from '@/services/api/json';
import type { ChatMessageResponse, ChatReadReceipt } from '@/types/api/chat';
import type { NegotiationResponse } from '@/types/api/negotiation';

function instant(value: unknown): string | null {
  if (typeof value === 'number') return new Date(value * 1000).toISOString();
  return typeof value === 'string' ? value : null;
}

function parseObject(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** STOMP `/topic/rooms.{roomId}.reads` frame: a raw `ChatReadReceiptResponse`. */
export function parseReadReceipt(body: string): ChatReadReceipt | null {
  const raw = parseObject(body);
  if (!raw || typeof raw.roomId !== 'string' || typeof raw.userId !== 'string') return null;
  const lastReadAt = instant(raw.lastReadAt);
  if (!lastReadAt) return null;
  return { roomId: raw.roomId, userId: raw.userId, lastReadAt };
}

/**
 * STOMP `/user/queue/negotiations` frame: a raw `NegotiationResponse`. Parsed losslessly because
 * offers carry `amount` and `rate` as JSON numbers.
 */
export function parseNegotiation(body: string): NegotiationResponse | null {
  let raw: Partial<NegotiationResponse> | null;
  try {
    raw = parseJson<Partial<NegotiationResponse> | null>(body);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || typeof raw.p2pRequestId !== 'string') return null;
  if (typeof raw.status !== 'string' || !Array.isArray(raw.offers)) return null;
  return {
    ...(raw as NegotiationResponse),
    p2pOrderId: raw.p2pOrderId ?? null,
    closedReason: raw.closedReason ?? null,
    closedBy: raw.closedBy ?? null,
  };
}

/**
 * STOMP frames carry a raw `ChatMessageResponse` (no envelope) with an ISO `createdAt`. Epoch
 * seconds are also accepted in case the broker's JSON converter changes. Plain `JSON.parse` is
 * deliberate: the lossless parser rejects such numbers, and chat messages carry no money fields.
 */
export function parseChatMessage(body: string): ChatMessageResponse | null {
  const raw = parseObject(body);
  if (!raw) return null;
  if (typeof raw.id !== 'string' || typeof raw.roomId !== 'string') return null;
  if (typeof raw.senderId !== 'string' || typeof raw.content !== 'string') return null;
  return {
    id: raw.id,
    roomId: raw.roomId,
    senderId: raw.senderId,
    content: raw.content,
    clientMessageId: typeof raw.clientMessageId === 'string' ? raw.clientMessageId : null,
    createdAt: instant(raw.createdAt) ?? new Date().toISOString(),
  };
}
