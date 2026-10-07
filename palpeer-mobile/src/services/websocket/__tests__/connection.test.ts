import { logger } from '@/utils/logger';

import { RealtimeConnection } from '../connection';

type Frame = { body: string };
type Config = {
  brokerURL?: string;
  beforeConnect: (client: MockStompClient) => Promise<void>;
  onConnect: () => void;
  onStompError: (frame: { headers: Record<string, string> }) => void;
  onWebSocketClose: () => void;
};

class MockStompClient {
  static instances: MockStompClient[] = [];
  active = false;
  connected = false;
  connectHeaders: Record<string, string> = {};
  subscriptions: { destination: string; callback: (frame: Frame) => void; active: boolean }[] = [];
  deactivations = 0;

  constructor(public config: Config) {
    MockStompClient.instances.push(this);
  }

  activate() {
    this.active = true;
  }

  async deactivate() {
    this.deactivations += 1;
    this.active = false;
    this.connected = false;
  }

  subscribe(destination: string, callback: (frame: Frame) => void) {
    const entry = { destination, callback, active: true };
    this.subscriptions.push(entry);
    return { unsubscribe: () => (entry.active = false) };
  }

  /** What stompjs does on a successful (re)connect. */
  async connect() {
    await this.config.beforeConnect(this);
    if (!this.active) return;
    this.connected = true;
    this.config.onConnect();
  }

  /** Socket dropped (network blip, server restart); stompjs keeps `active` and retries. */
  drop() {
    this.connected = false;
    this.config.onWebSocketClose();
  }

  deliver(destination: string, body: string) {
    this.subscriptions
      .filter((entry) => entry.active && entry.destination === destination)
      .forEach((entry) => entry.callback({ body }));
  }
}

jest.mock('@stomp/stompjs', () => ({
  Client: jest.fn((config: Config) => new MockStompClient(config)),
  ReconnectionTimeMode: { LINEAR: 0, EXPONENTIAL: 1 },
}));

const URL = 'ws://api.test/ws/websocket';
const TOPIC = '/topic/rooms.room-1';

function message(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: 'm-1',
    roomId: 'room-1',
    senderId: 'u-2',
    content: 'Hello',
    clientMessageId: null,
    createdAt: '2026-09-29T10:00:00Z',
    ...overrides,
  });
}

async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function latest(): MockStompClient {
  const client = MockStompClient.instances[MockStompClient.instances.length - 1];
  if (!client) throw new Error('No STOMP client was created');
  return client;
}

function setup(overrides: Partial<ConstructorParameters<typeof RealtimeConnection>[0]> = {}) {
  const getAccessToken = jest.fn(async () => 'access-1');
  const refreshAccessToken = jest.fn(async () => 'access-2');
  const connection = new RealtimeConnection({
    url: URL,
    getAccessToken,
    refreshAccessToken,
    ...overrides,
  });
  const statuses: string[] = [];
  connection.onStatusChange(() => statuses.push(connection.getStatus()));
  const onConnected = jest.fn();
  connection.onConnected(onConnected);
  const onMessage = jest.fn();
  return { connection, getAccessToken, refreshAccessToken, statuses, onConnected, onMessage };
}

/** Signed in, online, foreground, listening to room-1, connected. */
async function connected() {
  const ctx = setup();
  ctx.connection.setOnline(true);
  ctx.connection.setAuthenticated(true);
  const unsubscribe = ctx.connection.subscribe('room-1', ctx.onMessage);
  await latest().connect();
  return { ...ctx, unsubscribe, client: latest() };
}

beforeEach(() => {
  MockStompClient.instances = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RealtimeConnection', () => {
  it('stays unconfigured without a broker URL and never opens a socket', () => {
    const { connection, onMessage } = setup({ url: null });
    connection.setAuthenticated(true);
    connection.subscribe('room-1', onMessage);
    expect(connection.getStatus()).toBe('unconfigured');
    expect(MockStompClient.instances).toHaveLength(0);
  });

  it('connects only when signed in with a room to listen to', async () => {
    const { connection, onMessage } = setup();
    connection.subscribe('room-1', onMessage);
    expect(MockStompClient.instances).toHaveLength(0);
    expect(connection.getStatus()).toBe('idle');
    connection.setAuthenticated(true);
    expect(MockStompClient.instances).toHaveLength(1);
    expect(latest().config.brokerURL).toBe(URL);
    expect(connection.getStatus()).toBe('connecting');
  });

  describe('normal connection', () => {
    it('authenticates the CONNECT, subscribes the room and delivers messages', async () => {
      const { connection, client, onMessage, onConnected, statuses } = await connected();
      expect(client.connectHeaders).toEqual({ Authorization: 'Bearer access-1' });
      expect(client.subscriptions.map((entry) => entry.destination)).toEqual([TOPIC]);
      expect(connection.getStatus()).toBe('connected');
      expect(statuses).toEqual(['connecting', 'connected']);
      expect(onConnected).toHaveBeenCalledTimes(1);

      client.deliver(TOPIC, message());
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm-1', content: 'Hello', senderId: 'u-2' }),
      );
    });

    it('ignores malformed frames and messages for another room', async () => {
      const { client, onMessage } = await connected();
      client.deliver(TOPIC, 'not json');
      client.deliver(TOPIC, JSON.stringify({ id: 'x' }));
      client.deliver(TOPIC, message({ roomId: 'room-2' }));
      expect(onMessage).not.toHaveBeenCalled();
    });

    it('shares one STOMP subscription between listeners of the same room', async () => {
      const { connection, client, onMessage } = await connected();
      const second = jest.fn();
      const stopSecond = connection.subscribe('room-1', second);
      expect(client.subscriptions).toHaveLength(1);
      client.deliver(TOPIC, message());
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      stopSecond();
      expect(client.subscriptions[0]?.active).toBe(true);
    });

    it('subscribes a room opened after connecting and disconnects when the last room closes', async () => {
      const { connection, client, unsubscribe } = await connected();
      const stopOther = connection.subscribe('room-2', jest.fn());
      expect(client.subscriptions.map((entry) => entry.destination)).toEqual([
        TOPIC,
        '/topic/rooms.room-2',
      ]);
      stopOther();
      expect(client.subscriptions[1]?.active).toBe(false);
      unsubscribe();
      await flush();
      expect(client.deactivations).toBe(1);
      expect(connection.getStatus()).toBe('idle');
    });
  });

  describe('other destinations', () => {
    it('connects for a user queue alone and hands listeners the raw frame body', async () => {
      const { connection } = setup();
      connection.setAuthenticated(true);
      const onFrame = jest.fn();
      const stop = connection.listen('/user/queue/negotiations', onFrame);
      await latest().connect();
      expect(latest().subscriptions.map((entry) => entry.destination)).toEqual([
        '/user/queue/negotiations',
      ]);
      latest().deliver('/user/queue/negotiations', '{"id":"n-1"}');
      expect(onFrame).toHaveBeenCalledWith('{"id":"n-1"}');

      stop();
      await flush();
      expect(latest().deactivations).toBe(1);
      expect(connection.getStatus()).toBe('idle');
    });

    it('keeps room messages and read receipts on separate subscriptions, resent after reconnect', async () => {
      const { connection, client, onMessage } = await connected();
      const onReceipt = jest.fn();
      connection.listen('/topic/rooms.room-1.reads', onReceipt);
      client.deliver('/topic/rooms.room-1.reads', '{"userId":"u-2"}');
      expect(onReceipt).toHaveBeenCalledTimes(1);
      expect(onMessage).not.toHaveBeenCalled();

      client.drop();
      await client.connect();
      // The mock keeps pre-drop entries; the reconnect adds one fresh subscription per destination.
      expect(client.subscriptions.slice(2).map((entry) => entry.destination)).toEqual([
        TOPIC,
        '/topic/rooms.room-1.reads',
      ]);
    });
  });

  describe('network loss', () => {
    it('disconnects while offline and reconnects with the rooms and a backfill when back', async () => {
      const { connection, client, onConnected } = await connected();
      connection.setOnline(false);
      await flush();
      expect(client.deactivations).toBe(1);
      expect(connection.getStatus()).toBe('offline');

      connection.setOnline(true);
      expect(MockStompClient.instances).toHaveLength(2);
      expect(connection.getStatus()).toBe('connecting');
      const next = latest();
      await next.connect();
      expect(next.subscriptions.map((entry) => entry.destination)).toEqual([TOPIC]);
      expect(connection.getStatus()).toBe('connected');
      expect(onConnected).toHaveBeenCalledTimes(2);
    });

    it("doesn't connect while offline", () => {
      const { connection, onMessage } = setup();
      connection.setOnline(false);
      connection.setAuthenticated(true);
      connection.subscribe('room-1', onMessage);
      expect(MockStompClient.instances).toHaveLength(0);
      expect(connection.getStatus()).toBe('offline');
    });
  });

  describe('reconnection', () => {
    it('shows reconnecting after a dropped socket, then resubscribes and backfills', async () => {
      const { connection, client, onConnected, onMessage } = await connected();
      client.drop();
      expect(connection.getStatus()).toBe('reconnecting');
      expect(client.deactivations).toBe(0);

      // stompjs reconnects the same client after its backoff delay.
      await client.connect();
      expect(connection.getStatus()).toBe('connected');
      expect(client.subscriptions.filter((entry) => entry.destination === TOPIC)).toHaveLength(2);
      expect(onConnected).toHaveBeenCalledTimes(2);
      client.deliver(TOPIC, message({ id: 'm-2' }));
      expect(onMessage).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'm-2' }));
    });

    it('refreshes the token when the server rejects the CONNECT, without logging it', async () => {
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const { client, refreshAccessToken, getAccessToken } = await connected();
      client.drop();
      client.config.onStompError({ headers: { message: 'Invalid token' } });
      await flush();
      expect(refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warn.mock.calls)).not.toContain('access-');

      getAccessToken.mockResolvedValueOnce('access-2');
      await client.connect();
      expect(client.connectHeaders).toEqual({ Authorization: 'Bearer access-2' });
      warn.mockRestore();
    });

    it('stops when there is no session token', async () => {
      const { connection, onMessage } = setup({ getAccessToken: async () => null });
      connection.setAuthenticated(true);
      connection.subscribe('room-1', onMessage);
      await latest().connect();
      expect(latest().connected).toBe(false);
      expect(latest().active).toBe(false);
      expect(connection.getStatus()).toBe('idle');
    });
  });

  describe('app background and foreground', () => {
    it('keeps the socket through a short app switch and backfills on return', async () => {
      jest.useFakeTimers();
      const { connection, client, onConnected } = await connected();
      connection.setForeground(false);
      jest.advanceTimersByTime(10_000);
      expect(client.deactivations).toBe(0);
      expect(connection.getStatus()).toBe('connected');

      connection.setForeground(true);
      expect(onConnected).toHaveBeenCalledTimes(2);
      jest.advanceTimersByTime(60_000);
      expect(client.deactivations).toBe(0);
    });

    it('pauses after the background grace period and reconnects in the foreground', async () => {
      jest.useFakeTimers();
      const { connection, client, onConnected } = await connected();
      connection.setForeground(false);
      jest.advanceTimersByTime(29_999);
      expect(client.deactivations).toBe(0);
      jest.advanceTimersByTime(1);
      await flush();
      expect(client.deactivations).toBe(1);
      expect(connection.getStatus()).toBe('paused');

      connection.setForeground(true);
      expect(MockStompClient.instances).toHaveLength(2);
      await latest().connect();
      expect(connection.getStatus()).toBe('connected');
      expect(latest().subscriptions.map((entry) => entry.destination)).toEqual([TOPIC]);
      expect(onConnected).toHaveBeenCalledTimes(2);
    });

    it('restarts a socket that dropped while in the background', async () => {
      jest.useFakeTimers();
      const { connection, client } = await connected();
      connection.setForeground(false);
      client.drop();
      expect(connection.getStatus()).toBe('reconnecting');
      connection.setForeground(true);
      await flush();
      expect(client.deactivations).toBe(1);
      expect(MockStompClient.instances).toHaveLength(2);
      expect(connection.getStatus()).toBe('connecting');
    });
  });

  it('disconnects on sign-out', async () => {
    const { connection, client } = await connected();
    connection.setAuthenticated(false);
    await flush();
    expect(client.deactivations).toBe(1);
    expect(connection.getStatus()).toBe('idle');
  });
});
