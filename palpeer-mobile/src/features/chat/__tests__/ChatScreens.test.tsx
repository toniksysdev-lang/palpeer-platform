import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { sessionManager } from '@/services/auth/session';
import { secureStorage } from '@/services/storage/secureStorage';
import { RealtimeContext } from '@/services/websocket/realtime';
import type { AppStore } from '@/store';
import { connectivityChanged } from '@/store/slices/networkSlice';
import { sessionStarted } from '@/store/slices/sessionSlice';
import type { ChatMessageResponse, ChatRoomResponse } from '@/types/api/chat';
import { fakeRealtime } from '@/tests/fakeRealtime';
import { fail, installFetchMock, ok, type RecordedCall } from '@/tests/fetchMock';
import { router, setSearchParams } from '@/tests/mocks/expoRouter';
import { renderWithProviders } from '@/tests/render';

import { created, CURRENCIES, ME, orderSummary, OTHER } from '../../p2p/__tests__/fixtures';
import { ChatRoomScreen } from '../screens/ChatRoomScreen';
import { ChatRoomsScreen } from '../screens/ChatRoomsScreen';

jest.mock('expo-router', () => require('../../../tests/mocks/expoRouter'));

const signedIn = {
  prepareStore: (store: AppStore) => {
    store.dispatch(sessionStarted({ userId: ME, email: null }));
    store.dispatch(connectivityChanged({ isOnline: true, at: '2026-09-29T10:00:00Z' }));
  },
};

const callsTo = (calls: RecordedCall[], method: string, path: string) =>
  calls.filter((call) => call.method === method && call.path === path);

/** Lets in-flight requests finish and their state updates land inside act(). */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

const ROOM: ChatRoomResponse = {
  id: 'room-1',
  p2pOrderId: 'o-1',
  negotiationId: null,
  participantAId: OTHER,
  participantBId: ME,
  createdAt: '2026-09-29T09:00:00Z',
  participantALastReadAt: null,
  participantBLastReadAt: null,
  unreadCount: 0,
};

const msg = (id: string, overrides: Partial<ChatMessageResponse> = {}): ChatMessageResponse => ({
  id,
  roomId: 'room-1',
  senderId: OTHER,
  content: `Message ${id}`,
  clientMessageId: null,
  createdAt: '2026-09-29T10:00:00Z',
  ...overrides,
});

const page = (content: ChatMessageResponse[], number = 0, last = true) =>
  ok({
    content,
    number,
    size: 50,
    totalElements: content.length,
    totalPages: 1,
    first: number === 0,
    last,
    empty: content.length === 0,
  });

async function renderRoom(realtime = fakeRealtime()) {
  setSearchParams({ roomId: 'room-1' });
  const result = await renderWithProviders(
    <RealtimeContext.Provider value={realtime.connection}>
      <ChatRoomScreen />
    </RealtimeContext.Provider>,
    signedIn,
  );
  return { ...result, realtime };
}

// Already read up to now, so tests about other things don't fire read reports.
const baseRoutes = {
  'GET /currencies': CURRENCIES,
  'GET /chat/rooms/room-1': ok({ ...ROOM, participantBLastReadAt: '2026-09-29T23:00:00Z' }),
  'GET /p2p/me/orders': ok([orderSummary()]),
  'POST /chat/rooms/room-1/read': ok(ROOM),
};

beforeEach(async () => {
  jest.clearAllMocks();
  setSearchParams({});
  await secureStorage.clearAll();
  await sessionManager.start(
    { userId: ME, accessToken: 'access-0', refreshToken: 'refresh-0', tokenType: 'Bearer' },
    null,
  );
});

describe('ChatRoomScreen', () => {
  it('shows history newest first with the order pair, and listens to the room', async () => {
    installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1/messages': page([
        msg('m-2', { senderId: ME, content: 'Sounds good' }),
        msg('m-1', { content: 'Hi there' }),
      ]),
    });
    const { realtime } = await renderRoom();

    expect(await screen.findByTestId('chat-message-m-1')).toHaveTextContent(/Hi there/);
    expect(screen.getByTestId('chat-message-m-2')).toHaveTextContent(/Sounds good/);
    expect(screen.getByText('USD/NGN order')).toBeTruthy();
    const order = screen.getAllByTestId(/^chat-message-m-\d+$/).map((node) => node.props.testID);
    expect(order).toEqual(['chat-message-m-1', 'chat-message-m-2']);
    expect(realtime.rooms.has('room-1')).toBe(true);
    expect(screen.queryByTestId('chat-connection')).toBeNull();
  });

  it('adds messages that arrive over the socket, once', async () => {
    installFetchMock({ ...baseRoutes, 'GET /chat/rooms/room-1/messages': page([msg('m-1')]) });
    const { realtime } = await renderRoom();
    await screen.findByTestId('chat-message-m-1');

    await realtime.receive(msg('m-2', { content: 'Live one' }));
    expect(await screen.findByTestId('chat-message-m-2')).toHaveTextContent(/Live one/);
    await realtime.receive(msg('m-2', { content: 'Live one' }));
    expect(screen.getAllByTestId('chat-message-m-2')).toHaveLength(1);
  });

  it('sends over REST with a client id, and the socket echo does not duplicate it', async () => {
    let sent: ChatMessageResponse | null = null;
    const { calls } = installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1/messages': page([msg('m-1')]),
      'POST /chat/rooms/room-1/messages': ({ body }) => {
        const { content, clientMessageId } = body as { content: string; clientMessageId: string };
        sent = msg('m-mine', { senderId: ME, content, clientMessageId });
        return created(sent);
      },
    });
    const { realtime, store } = await renderRoom();
    await screen.findByTestId('chat-message-m-1');

    expect(screen.getByTestId('chat-send').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('chat-input'), '  Deal at 1,480?  ');
    await fireEvent.press(screen.getByTestId('chat-send'));

    expect(await screen.findByTestId('chat-message-m-mine')).toHaveTextContent(/Deal at 1,480\?/);
    expect(screen.getByTestId('chat-input').props.value).toBe('');
    const body = callsTo(calls, 'POST', '/chat/rooms/room-1/messages')[0]?.body as {
      content: string;
      clientMessageId: string;
    };
    expect(body.content).toBe('Deal at 1,480?');
    expect(body.clientMessageId).toMatch(/\S{8,}/);
    await waitFor(() => expect(store.getState().chatOutbox['room-1']).toEqual([]));

    await realtime.receive(sent as unknown as ChatMessageResponse);
    expect(screen.getAllByTestId('chat-message-m-mine')).toHaveLength(1);
    expect(screen.queryAllByTestId(/^chat-outbox-/)).toHaveLength(0);
  });

  it('disables the composer when the linked P2P order is completed', async () => {
    const { calls } = installFetchMock({
      ...baseRoutes,
      'GET /p2p/me/orders': ok([orderSummary({ status: 'COMPLETED' })]),
      'GET /chat/rooms/room-1/messages': page([msg('m-1')]),
      'POST /chat/rooms/room-1/messages': created(
        msg('m-mine', { senderId: ME, content: 'should not send' }),
      ),
    });
    await renderRoom();
    await screen.findByTestId('chat-message-m-1');

    expect(screen.getByTestId('chat-messaging-closed')).toHaveTextContent(
      'Messaging is closed for this completed order.',
    );
    expect(screen.queryByTestId('chat-input')).toBeNull();
    expect(screen.queryByTestId('chat-send')).toBeNull();
    expect(callsTo(calls, 'POST', '/chat/rooms/room-1/messages')).toHaveLength(0);
  });

  it('keeps a failed message with its text and retries it with the same client id', async () => {
    const { calls } = installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1/messages': page([]),
      'POST /chat/rooms/room-1/messages': [
        fail(500, 'INTERNAL_ERROR'),
        created(msg('m-9', { senderId: ME, content: 'Are you there?', clientMessageId: 'x' })),
      ],
    });
    await renderRoom();
    expect(await screen.findByText('No messages yet')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('chat-input'), 'Are you there?');
    await fireEvent.press(screen.getByTestId('chat-send'));

    const failed = await screen.findByLabelText(/Message not sent: Are you there\?/);
    expect(failed).toHaveTextContent(/Tap to retry/);
    await fireEvent.press(failed);

    expect(await screen.findByTestId('chat-message-m-9')).toBeTruthy();
    expect(screen.queryByLabelText(/Message not sent/)).toBeNull();
    const posts = callsTo(calls, 'POST', '/chat/rooms/room-1/messages').map(
      (call) => (call.body as { clientMessageId: string }).clientMessageId,
    );
    expect(posts).toHaveLength(2);
    expect(posts[0]).toBe(posts[1]);
  });

  it('backfills messages missed while disconnected when the connection comes back', async () => {
    const { calls } = installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1/messages': [
        page([msg('m-1')]),
        page([msg('m-2', { content: 'Sent while you were away' }), msg('m-1')]),
      ],
    });
    const { realtime } = await renderRoom();
    await screen.findByTestId('chat-message-m-1');

    await realtime.setStatus('reconnecting');
    expect(screen.getByTestId('chat-connection')).toHaveTextContent(/Reconnecting/);

    await realtime.setStatus('connected');
    await realtime.reconnected();
    expect(await screen.findByTestId('chat-message-m-2')).toHaveTextContent(/while you were away/);
    expect(screen.queryByTestId('chat-connection')).toBeNull();
    expect(callsTo(calls, 'GET', '/chat/rooms/room-1/messages')).toHaveLength(2);
  });

  it('tells the user when the device is offline', async () => {
    installFetchMock({ ...baseRoutes, 'GET /chat/rooms/room-1/messages': page([msg('m-1')]) });
    const { store, realtime } = await renderRoom();
    await screen.findByTestId('chat-message-m-1');

    await act(() => {
      store.dispatch(connectivityChanged({ isOnline: false, at: '2026-09-29T10:01:00Z' }));
    });
    await realtime.setStatus('offline');
    expect(screen.getByTestId('chat-connection')).toHaveTextContent(/You're offline/);
  });

  it('loads older pages from the history', async () => {
    const { calls } = installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1/messages': [
        page([msg('m-2')], 0, false),
        page([msg('m-1')], 1, true),
      ],
    });
    await renderRoom();
    await screen.findByTestId('chat-message-m-2');
    await fireEvent.press(await screen.findByTestId('chat-load-older'));
    expect(await screen.findByTestId('chat-message-m-1')).toBeTruthy();
    expect(callsTo(calls, 'GET', '/chat/rooms/room-1/messages').map((call) => call.query)).toEqual([
      '?page=0&size=50',
      '?page=1&size=50',
    ]);
  });

  it('reports the newest incoming message as read, once, and listens for receipts', async () => {
    const { calls } = installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1': ok(ROOM),
      'GET /chat/rooms/room-1/messages': page([
        msg('m-2', { senderId: ME }),
        msg('m-1', { createdAt: '2026-09-29T09:59:00Z' }),
      ]),
      'POST /chat/rooms/room-1/read': ok({
        ...ROOM,
        participantBLastReadAt: '2026-09-29T09:59:00Z',
      }),
    });
    const { realtime } = await renderRoom();
    await screen.findByTestId('chat-message-m-1');

    await waitFor(() => expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')).toHaveLength(1));
    expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')[0]?.body).toEqual({
      messageId: 'm-1',
    });
    expect(realtime.listening()).toContain('/topic/rooms.room-1.reads');

    await realtime.receive(msg('m-3', { createdAt: '2026-09-29T10:05:00Z' }));
    await waitFor(() => expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')).toHaveLength(2));
    expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')[1]?.body).toEqual({
      messageId: 'm-3',
    });
    await settle();
  });

  it('retries a failed read report when the connection comes back or the device is online again', async () => {
    const { calls } = installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1': ok(ROOM),
      'GET /chat/rooms/room-1/messages': page([msg('m-1')]),
      'POST /chat/rooms/room-1/read': [
        fail(500, 'INTERNAL_ERROR'),
        fail(503, 'SERVICE_UNAVAILABLE'),
        ok({ ...ROOM, participantBLastReadAt: '2026-09-29T10:00:00Z' }),
      ],
    });
    const { realtime, store } = await renderRoom();
    await screen.findByTestId('chat-message-m-1');
    await waitFor(() => expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')).toHaveLength(1));
    await settle();

    await realtime.setStatus('reconnecting');
    await realtime.setStatus('connected');
    await realtime.reconnected();
    await waitFor(() => expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')).toHaveLength(2));
    await settle();

    await act(() => {
      store.dispatch(connectivityChanged({ isOnline: false, at: '2026-09-29T10:01:00Z' }));
    });
    await act(() => {
      store.dispatch(connectivityChanged({ isOnline: true, at: '2026-09-29T10:02:00Z' }));
    });
    await waitFor(() => expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')).toHaveLength(3));
    await settle();
    expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read').map((call) => call.body)).toEqual([
      { messageId: 'm-1' },
      { messageId: 'm-1' },
      { messageId: 'm-1' },
    ]);
  });

  it("doesn't retry a read report the server refused for good", async () => {
    const { calls } = installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1': ok(ROOM),
      'GET /chat/rooms/room-1/messages': page([msg('m-1')]),
      'POST /chat/rooms/room-1/read': fail(404, 'RESOURCE_NOT_FOUND'),
    });
    const { realtime } = await renderRoom();
    await screen.findByTestId('chat-message-m-1');
    await waitFor(() => expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')).toHaveLength(1));
    await settle();

    await realtime.setStatus('reconnecting');
    await realtime.setStatus('connected');
    await realtime.reconnected();
    await settle();
    expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')).toHaveLength(1);
  });

  it("doesn't report messages I've already read", async () => {
    const { calls } = installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1': ok({ ...ROOM, participantBLastReadAt: '2026-09-29T10:00:00.000Z' }),
      'GET /chat/rooms/room-1/messages': page([msg('m-1')]),
    });
    await renderRoom();
    await screen.findByTestId('chat-message-m-1');
    await settle();
    expect(callsTo(calls, 'POST', '/chat/rooms/room-1/read')).toHaveLength(0);
  });

  it('shows Seen under my latest message once the other person has read it', async () => {
    installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1/messages': page([
        msg('m-3', { senderId: ME, createdAt: '2026-09-29T10:02:00Z' }),
        msg('m-2', { senderId: ME, createdAt: '2026-09-29T10:01:00Z' }),
        msg('m-1', { createdAt: '2026-09-29T10:00:00Z' }),
      ]),
    });
    const { realtime } = await renderRoom();
    await screen.findByTestId('chat-message-m-3');
    expect(screen.queryByTestId('chat-message-m-3-seen')).toBeNull();

    // Read up to m-2 only: my latest (m-3) is not seen yet.
    await realtime.push(
      '/topic/rooms.room-1.reads',
      JSON.stringify({ roomId: 'room-1', userId: OTHER, lastReadAt: '2026-09-29T10:01:00Z' }),
    );
    expect(screen.queryByTestId('chat-message-m-3-seen')).toBeNull();

    await realtime.push(
      '/topic/rooms.room-1.reads',
      JSON.stringify({
        roomId: 'room-1',
        userId: OTHER,
        lastReadAt: '2026-09-29T10:02:00.000000Z',
      }),
    );
    expect(await screen.findByTestId('chat-message-m-3-seen')).toHaveTextContent('Seen');
    expect(screen.queryByTestId('chat-message-m-2-seen')).toBeNull();

    // An older receipt never moves the marker back.
    await realtime.push(
      '/topic/rooms.room-1.reads',
      JSON.stringify({ roomId: 'room-1', userId: OTHER, lastReadAt: '2026-09-29T09:00:00Z' }),
    );
    expect(screen.getByTestId('chat-message-m-3-seen')).toBeTruthy();
  });

  it('ignores my own receipts and receipts for other rooms', async () => {
    installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1/messages': page([msg('m-2', { senderId: ME })]),
    });
    const { realtime } = await renderRoom();
    await screen.findByTestId('chat-message-m-2');
    await realtime.push(
      '/topic/rooms.room-1.reads',
      JSON.stringify({ roomId: 'room-1', userId: ME, lastReadAt: '2026-09-29T11:00:00Z' }),
    );
    await realtime.push(
      '/topic/rooms.room-1.reads',
      JSON.stringify({ roomId: 'room-2', userId: OTHER, lastReadAt: '2026-09-29T11:00:00Z' }),
    );
    expect(screen.queryByTestId('chat-message-m-2-seen')).toBeNull();
  });

  it('shows not found for rooms the user is not part of', async () => {
    installFetchMock({
      ...baseRoutes,
      'GET /chat/rooms/room-1': fail(404, 'RESOURCE_NOT_FOUND', 'Chat room not found'),
    });
    await renderRoom();
    expect(await screen.findByText('Chat room not found')).toBeTruthy();
  });
});

describe('ChatRoomsScreen', () => {
  it('lists conversations by order pair and opens one', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /chat/rooms': ok([ROOM]),
      'GET /chat/unread-count': ok({ count: 0 }),
      'GET /p2p/me/orders': ok([orderSummary()]),
    });
    await renderWithProviders(<ChatRoomsScreen />, signedIn);
    const room = await screen.findByTestId('chat-room-room-1');
    await waitFor(() => expect(room).toHaveTextContent(/USD\/NGN order/));
    await fireEvent.press(room);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chat/[roomId]',
      params: { roomId: 'room-1' },
    });
  });

  it('shows an unread badge on rooms with new messages', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /chat/rooms': ok([{ ...ROOM, unreadCount: 3 }]),
      'GET /chat/unread-count': ok({ count: 3 }),
      'GET /p2p/me/orders': ok([orderSummary()]),
    });
    await renderWithProviders(<ChatRoomsScreen />, signedIn);
    expect(await screen.findByTestId('chat-room-unread-room-1')).toHaveTextContent('3');
  });

  it('explains how to start a conversation', async () => {
    installFetchMock({
      'GET /currencies': CURRENCIES,
      'GET /chat/rooms': ok([]),
      'GET /chat/unread-count': ok({ count: 0 }),
      'GET /p2p/me/orders': ok([]),
    });
    await renderWithProviders(<ChatRoomsScreen />, signedIn);
    expect(await screen.findByText('No conversations yet')).toBeTruthy();
  });
});
