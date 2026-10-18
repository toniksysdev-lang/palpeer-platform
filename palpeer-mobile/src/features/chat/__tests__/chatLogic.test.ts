import { createAppError } from '@/services/api/errors';
import type { OutboxMessage } from '@/store/slices/chatOutboxSlice';
import type { ChatMessageResponse, ChatRoomResponse } from '@/types/api/chat';

import {
  buildChatItems,
  chatErrorMessage,
  connectionNotice,
  negotiationAmountMessage,
  seenMessageId,
  unreadIncoming,
} from '../logic';

describe('negotiationAmountMessage', () => {
  it('prefixes a formatted amount', () => {
    expect(negotiationAmountMessage('100.00 CAD')).toBe('Proposed amount: 100.00 CAD');
  });
});

const msg = (id: string, overrides: Partial<ChatMessageResponse> = {}): ChatMessageResponse => ({
  id,
  roomId: 'room-1',
  senderId: 'u-2',
  content: `text ${id}`,
  clientMessageId: null,
  createdAt: '2026-09-29T10:00:00Z',
  ...overrides,
});

const queued = (
  clientMessageId: string,
  status: OutboxMessage['status'] = 'sending',
): OutboxMessage => ({
  clientMessageId,
  content: `draft ${clientMessageId}`,
  queuedAt: '2026-09-29T10:05:00Z',
  status,
  error: null,
});

describe('buildChatItems', () => {
  it('lists unconfirmed messages newest first above the history', () => {
    const items = buildChatItems(
      [{ content: [msg('m-2'), msg('m-1', { senderId: 'u-1' })] }],
      [queued('c-1'), queued('c-2', 'failed')],
      'u-1',
    );
    expect(items.map((item) => item.key)).toEqual(['outbox-c-2', 'outbox-c-1', 'm-2', 'm-1']);
    expect(items[2]).toMatchObject({ kind: 'message', mine: false });
    expect(items[3]).toMatchObject({ kind: 'message', mine: true });
  });

  it('hides an outbox entry once its message is in the history', () => {
    const items = buildChatItems(
      [{ content: [msg('m-3', { senderId: 'u-1', clientMessageId: 'c-1' })] }],
      [queued('c-1')],
      'u-1',
    );
    expect(items.map((item) => item.key)).toEqual(['m-3']);
  });

  it('drops a message repeated across pages after new messages shift the pages', () => {
    const items = buildChatItems(
      [{ content: [msg('m-2'), msg('m-1')] }, { content: [msg('m-1'), msg('m-0')] }],
      [],
      'u-1',
    );
    expect(items.map((item) => item.key)).toEqual(['m-2', 'm-1', 'm-0']);
  });
});

describe('connectionNotice', () => {
  it('only shows a banner when live updates are not working', () => {
    expect(connectionNotice('connected', true)).toBeNull();
    expect(connectionNotice('idle', true)).toBeNull();
    expect(connectionNotice('connected', false)).toMatch(/offline/);
    expect(connectionNotice('offline', null)).toMatch(/offline/);
    expect(connectionNotice('reconnecting', true)).toMatch(/Reconnecting/);
    expect(connectionNotice('connecting', true)).toBe('Connecting…');
    expect(connectionNotice('unconfigured', true)).toMatch(/Pull down/);
  });
});

describe('chatErrorMessage', () => {
  it('explains send failures', () => {
    expect(chatErrorMessage(createAppError('offline'))).toBe('Not sent. Check your connection.');
    expect(
      chatErrorMessage(createAppError('forbidden', { status: 403, code: 'CHAT_NOT_PARTICIPANT' })),
    ).toBe("You're not part of this conversation.");
  });
});

describe('read receipts', () => {
  const room = (a: string | null, b: string | null): ChatRoomResponse => ({
    id: 'room-1',
    p2pOrderId: 'o-1',
    negotiationId: null,
    participantAId: 'u-1',
    participantBId: 'u-2',
    createdAt: '2026-09-29T09:00:00Z',
    participantALastReadAt: a,
    participantBLastReadAt: b,
  });
  const pages = [
    {
      content: [
        msg('m-3', { senderId: 'u-1', createdAt: '2026-09-29T10:02:00Z' }),
        msg('m-2', { senderId: 'u-2', createdAt: '2026-09-29T10:01:00.5Z' }),
        msg('m-1', { senderId: 'u-1', createdAt: '2026-09-29T10:00:00Z' }),
      ],
    },
  ];

  it('reports the newest incoming message until my marker reaches it', () => {
    expect(unreadIncoming(pages, room(null, null), 'u-1')?.id).toBe('m-2');
    expect(unreadIncoming(pages, room('2026-09-29T10:01:00Z', null), 'u-1')?.id).toBe('m-2');
    // Fractional seconds compare by time, not as text.
    expect(unreadIncoming(pages, room('2026-09-29T10:01:00.500000Z', null), 'u-1')).toBeNull();
    expect(unreadIncoming(pages, room(null, null), 'u-2')?.id).toBe('m-3');
    expect(unreadIncoming(pages, undefined, 'u-1')).toBeNull();
    expect(unreadIncoming([{ content: [] }], room(null, null), 'u-1')).toBeNull();
  });

  it('marks only my newest message as seen, once the other side has read it', () => {
    expect(seenMessageId(pages, room(null, '2026-09-29T10:01:59Z'), 'u-1')).toBeNull();
    expect(seenMessageId(pages, room(null, '2026-09-29T10:02:00Z'), 'u-1')).toBe('m-3');
    expect(seenMessageId(pages, room('2026-09-29T10:05:00Z', null), 'u-2')).toBe('m-2');
    expect(seenMessageId(pages, room(null, null), 'u-1')).toBeNull();
  });
});
