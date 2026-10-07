import { act } from '@testing-library/react-native';

import type { RealtimeConnection, RealtimeStatus } from '@/services/websocket/connection';
import type { ChatMessageResponse } from '@/types/api/chat';

/** Stands in for the app's single STOMP connection; supply it via `RealtimeContext.Provider`. */
export function fakeRealtime(initial: RealtimeStatus = 'connected') {
  let status = initial;
  const statusListeners = new Set<() => void>();
  const connectedListeners = new Set<() => void>();
  const rooms = new Map<string, (message: ChatMessageResponse) => void>();
  const destinations = new Map<string, Set<(body: string) => void>>();
  const connection = {
    getStatus: () => status,
    onStatusChange: (listener: () => void) => {
      statusListeners.add(listener);
      return () => void statusListeners.delete(listener);
    },
    onConnected: (listener: () => void) => {
      connectedListeners.add(listener);
      return () => void connectedListeners.delete(listener);
    },
    subscribe: (roomId: string, handler: (message: ChatMessageResponse) => void) => {
      rooms.set(roomId, handler);
      return () => void rooms.delete(roomId);
    },
    listen: (destination: string, handler: (body: string) => void) => {
      const handlers = destinations.get(destination) ?? new Set();
      handlers.add(handler);
      destinations.set(destination, handlers);
      return () => void handlers.delete(handler);
    },
  } as unknown as RealtimeConnection;
  return {
    connection,
    rooms,
    /** Destinations with at least one listener. */
    listening: () => [...destinations].filter(([, handlers]) => handlers.size > 0).map(([d]) => d),
    receive: (message: ChatMessageResponse) => act(() => rooms.get(message.roomId)?.(message)),
    push: (destination: string, body: string) =>
      act(() => destinations.get(destination)?.forEach((handler) => handler(body))),
    setStatus: (next: RealtimeStatus) =>
      act(() => {
        status = next;
        statusListeners.forEach((listener) => listener());
      }),
    reconnected: () => act(() => connectedListeners.forEach((listener) => listener())),
  };
}
