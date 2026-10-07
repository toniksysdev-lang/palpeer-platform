import { Client, ReconnectionTimeMode, type StompSubscription } from '@stomp/stompjs';

import type { ChatMessageResponse } from '@/types/api/chat';
import { logger } from '@/utils/logger';

import { parseChatMessage } from './events';

export type RealtimeStatus =
  /** No WebSocket URL configured (or mock mode). */
  | 'unconfigured'
  /** Nothing to listen to, or signed out. */
  | 'idle'
  | 'connecting'
  | 'connected'
  /** Lost the socket; STOMP is retrying with backoff. */
  | 'reconnecting'
  | 'offline'
  /** Disconnected after the app stayed in the background. */
  | 'paused';

export type RealtimeDeps = {
  url: string | null;
  /** Current access token, refreshing it if needed; null when there is no usable session. */
  getAccessToken: () => Promise<string | null>;
  /** Called after the server rejects a CONNECT; should refresh the access token. */
  refreshAccessToken: () => Promise<string | null>;
  backgroundGraceMs?: number;
};

type MessageHandler = (message: ChatMessageResponse) => void;
export type FrameHandler = (body: string) => void;
type Listener = () => void;

/** CLIENT rule: keep the socket through short app switches, drop it after this long. */
export const BACKGROUND_GRACE_MS = 30_000;
const RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 10_000;

const roomTopic = (roomId: string) => `/topic/rooms.${roomId}`;

/**
 * The app's single STOMP connection (screens never open sockets). It connects only while signed
 * in, online, in the foreground (or within the background grace period) and at least one
 * destination is listened to. Subscriptions are re-sent after every reconnect, and `onConnected`
 * listeners run so screens can backfill state missed while disconnected. The server sends no
 * heartbeats.
 */
export class RealtimeConnection {
  private readonly deps: Required<RealtimeDeps>;
  private client: Client | null = null;
  private status: RealtimeStatus;
  private authenticated = false;
  private online: boolean | null = null;
  private foreground = true;
  private backgroundExpired = false;
  private backgroundTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly destinations = new Map<string, Set<FrameHandler>>();
  private readonly stompSubscriptions = new Map<string, StompSubscription>();
  private readonly statusListeners = new Set<Listener>();
  private readonly connectedListeners = new Set<Listener>();

  constructor(deps: RealtimeDeps) {
    this.deps = { backgroundGraceMs: BACKGROUND_GRACE_MS, ...deps };
    this.status = deps.url ? 'idle' : 'unconfigured';
  }

  getStatus(): RealtimeStatus {
    return this.status;
  }

  onStatusChange(listener: Listener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Runs after every successful (re)connect, once room subscriptions are in place. */
  onConnected(listener: Listener): () => void {
    this.connectedListeners.add(listener);
    return () => this.connectedListeners.delete(listener);
  }

  setAuthenticated(authenticated: boolean) {
    if (this.authenticated === authenticated) return;
    this.authenticated = authenticated;
    this.evaluate();
  }

  setOnline(online: boolean | null) {
    if (this.online === online) return;
    this.online = online;
    // Offline stops the client, so coming back starts a fresh one now instead of after a backoff.
    this.evaluate();
  }

  setForeground(foreground: boolean) {
    if (this.foreground === foreground) return;
    this.foreground = foreground;
    if (this.backgroundTimer) {
      clearTimeout(this.backgroundTimer);
      this.backgroundTimer = null;
    }
    if (foreground) {
      this.backgroundExpired = false;
      if (this.client?.connected) {
        // Frames may have been missed while the app was suspended.
        this.notifyConnected();
      } else if (this.client?.active) {
        void this.restart();
        return;
      }
      this.evaluate();
      return;
    }
    this.backgroundTimer = setTimeout(() => {
      this.backgroundTimer = null;
      this.backgroundExpired = true;
      this.evaluate();
    }, this.deps.backgroundGraceMs);
  }

  /** Listen to a chat room's messages. The returned function stops listening. */
  subscribe(roomId: string, handler: MessageHandler): () => void {
    return this.listen(roomTopic(roomId), (body) => {
      const message = parseChatMessage(body);
      if (message && message.roomId === roomId) handler(message);
    });
  }

  /**
   * Listen to any permitted destination (`/topic/rooms.{id}.reads`, `/user/queue/...`) with the
   * raw frame body. Listeners of one destination share a single STOMP subscription.
   */
  listen(destination: string, handler: FrameHandler): () => void {
    let handlers = this.destinations.get(destination);
    if (!handlers) {
      handlers = new Set();
      this.destinations.set(destination, handlers);
      if (this.client?.connected) this.subscribeDestination(destination);
    }
    handlers.add(handler);
    this.evaluate();
    return () => {
      const current = this.destinations.get(destination);
      if (!current) return;
      current.delete(handler);
      if (current.size > 0) return;
      this.destinations.delete(destination);
      const subscription = this.stompSubscriptions.get(destination);
      this.stompSubscriptions.delete(destination);
      if (subscription && this.client?.connected) subscription.unsubscribe();
      this.evaluate();
    };
  }

  /** Drop the connection immediately (sign-out). */
  async shutdown() {
    this.authenticated = false;
    await this.stop();
  }

  private shouldConnect(): boolean {
    return (
      !!this.deps.url &&
      this.authenticated &&
      this.online !== false &&
      (this.foreground || !this.backgroundExpired) &&
      this.destinations.size > 0
    );
  }

  private idleStatus(): RealtimeStatus {
    if (!this.deps.url) return 'unconfigured';
    if (!this.authenticated || this.destinations.size === 0) return 'idle';
    if (this.online === false) return 'offline';
    return 'paused';
  }

  private evaluate() {
    if (this.shouldConnect()) {
      if (!this.client?.active) this.start();
    } else if (this.client) {
      void this.stop();
    } else {
      this.setStatus(this.idleStatus());
    }
  }

  private start() {
    const client = new Client({
      brokerURL: this.deps.url ?? undefined,
      reconnectDelay: RECONNECT_DELAY_MS,
      maxReconnectDelay: MAX_RECONNECT_DELAY_MS,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      heartbeatIncoming: 0,
      heartbeatOutgoing: 0,
      // Needed for STOMP over React Native's WebSocket implementation.
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      beforeConnect: async (stomp) => {
        const token = await this.deps.getAccessToken();
        if (!token) {
          this.setStatus('idle');
          void stomp.deactivate();
          return;
        }
        stomp.connectHeaders = { Authorization: `Bearer ${token}` };
      },
      onConnect: () => {
        if (this.client !== client) return;
        this.stompSubscriptions.clear();
        for (const destination of this.destinations.keys()) this.subscribeDestination(destination);
        this.setStatus('connected');
        this.notifyConnected();
      },
      onStompError: (frame) => {
        // The server answers a rejected CONNECT (expired token) with an ERROR frame.
        logger.warn('Realtime STOMP error', { message: frame.headers.message });
        void this.deps.refreshAccessToken();
      },
      onWebSocketClose: () => {
        if (this.client !== client) return;
        this.stompSubscriptions.clear();
        if (client.active) this.setStatus('reconnecting');
      },
    });
    this.client = client;
    this.setStatus('connecting');
    client.activate();
  }

  private async stop() {
    const client = this.client;
    this.client = null;
    this.stompSubscriptions.clear();
    this.setStatus(this.idleStatus());
    if (client) await client.deactivate();
  }

  private async restart() {
    await this.stop();
    this.evaluate();
  }

  private subscribeDestination(destination: string) {
    const client = this.client;
    if (!client?.connected || this.stompSubscriptions.has(destination)) return;
    const subscription = client.subscribe(destination, (frame) => {
      this.destinations.get(destination)?.forEach((handler) => handler(frame.body));
    });
    this.stompSubscriptions.set(destination, subscription);
  }

  private setStatus(status: RealtimeStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener());
  }

  private notifyConnected() {
    this.connectedListeners.forEach((listener) => listener());
  }
}
