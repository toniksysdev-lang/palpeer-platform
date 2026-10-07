import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';

import { appConfig } from '@/config/env';
import { sessionManager } from '@/services/auth/session';
import type { ChatMessageResponse, ChatReadReceipt } from '@/types/api/chat';

import { RealtimeConnection, type RealtimeStatus } from './connection';
import { parseReadReceipt } from './events';
import { brokerUrl } from './url';

export const realtime = new RealtimeConnection({
  url: brokerUrl(appConfig.wsUrl),
  getAccessToken: async () =>
    sessionManager.getAccessToken() ?? (await sessionManager.refreshAccessToken()),
  refreshAccessToken: () => sessionManager.refreshAccessToken(),
});

/** Lets tests supply their own connection; the app always uses the singleton. */
export const RealtimeContext = createContext<RealtimeConnection>(realtime);

export function useRealtime(): RealtimeConnection {
  return useContext(RealtimeContext);
}

export function useRealtimeStatus(): RealtimeStatus {
  const connection = useRealtime();
  return useSyncExternalStore(
    (listener) => connection.onStatusChange(listener),
    () => connection.getStatus(),
  );
}

/**
 * Listens to one chat room (messages and read receipts) for as long as the calling screen is
 * mounted. `onConnected` runs after every (re)connect and on return to the foreground, so the
 * screen can backfill what it missed.
 */
export function useRoomRealtime(
  roomId: string | undefined,
  handlers: {
    onMessage: (message: ChatMessageResponse) => void;
    onReceipt?: (receipt: ChatReadReceipt) => void;
    onConnected: () => void;
  },
) {
  const connection = useRealtime();
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!roomId) return;
    const stopConnected = connection.onConnected(() => latest.current.onConnected());
    const stopRoom = connection.subscribe(roomId, (message) => latest.current.onMessage(message));
    const stopReads = connection.listen(`/topic/rooms.${roomId}.reads`, (body) => {
      const receipt = parseReadReceipt(body);
      if (receipt && receipt.roomId === roomId) latest.current.onReceipt?.(receipt);
    });
    return () => {
      stopReads();
      stopRoom();
      stopConnected();
    };
  }, [connection, roomId]);
}

/**
 * Listens to one destination (e.g. a `/user/queue/...` queue) while the calling component is
 * mounted, with the raw frame body. `onConnected` runs after every (re)connect.
 */
export function useRealtimeDestination(
  destination: string | null,
  handlers: { onFrame: (body: string) => void; onConnected?: () => void },
) {
  const connection = useRealtime();
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!destination) return;
    const stopConnected = connection.onConnected(() => latest.current.onConnected?.());
    const stop = connection.listen(destination, (body) => latest.current.onFrame(body));
    return () => {
      stop();
      stopConnected();
    };
  }, [connection, destination]);
}
